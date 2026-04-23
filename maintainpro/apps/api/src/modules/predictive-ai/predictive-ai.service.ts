import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Priority, Prisma, RoleName, WorkOrderStatus } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";
import { MaintenanceService } from "../maintenance/maintenance.service";
import { ReportsService } from "../reports/reports.service";
import { WorkOrdersService } from "../work-orders/work-orders.service";
import {
  AssignTechnicianActionDto,
  type CopilotReportType,
  CreateWorkOrderActionDto,
  GenerateReportActionDto,
  ScheduleMaintenanceActionDto
} from "./dto/copilot-actions.dto";
import {
  type CopilotFocusArea,
  type CopilotMode,
  CopilotChatDto
} from "./dto/copilot-chat.dto";
import {
  CopilotCreateConversationDto,
  CopilotLogsQueryDto
} from "./dto/copilot-query.dto";

type CopilotUser = {
  sub: string;
  role: RoleName;
  tenantId?: string | null;
  email?: string;
} | null;

type CopilotSuggestedAction = {
  id: string;
  label: string;
  actionType:
    | "CREATE_WORK_ORDER"
    | "SCHEDULE_MAINTENANCE"
    | "ASSIGN_TECHNICIAN"
    | "GENERATE_REPORT";
  endpoint: string;
  description: string;
  payload: Record<string, unknown>;
};

type CopilotContextBundle = {
  generatedAt: string;
  userScope: {
    userId: string | null;
    role: RoleName | "ANONYMOUS";
    tenantId: string | null;
    visibility: "full" | "summary" | "assigned-only";
  };
  metrics: {
    activeWorkOrders: number;
    overdueWorkOrders: number;
    overdueMaintenanceTasks: number;
    fleetVehicles: number;
    fleetUnavailable: number;
    fuelAnomalies: number;
    utilityAnomalies: number;
    overdueUtilityBills: number;
    lowStockParts: number;
    cleaningOpenIssues: number;
  };
  highlights: {
    activeWorkOrders: Array<Record<string, unknown>>;
    overdueWorkOrders: Array<Record<string, unknown>>;
    unassignedWorkOrders: Array<Record<string, unknown>>;
    overdueMaintenance: Array<Record<string, unknown>>;
    fuelAnomalies: Array<Record<string, unknown>>;
    utilityAnomalies: Array<Record<string, unknown>>;
    lowStockParts: Array<Record<string, unknown>>;
    stockoutRisk: Array<Record<string, unknown>>;
  };
  insightCards: Array<{
    id: string;
    title: string;
    value: number;
    severity: "neutral" | "warning" | "critical";
    description: string;
  }>;
  suggestionChips: string[];
};

const ACTIVE_WORK_ORDER_STATUSES: WorkOrderStatus[] = [
  WorkOrderStatus.OPEN,
  WorkOrderStatus.IN_PROGRESS,
  WorkOrderStatus.ON_HOLD
];

@Injectable()
export class PredictiveAiService {
  private readonly logger = new Logger(PredictiveAiService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(WorkOrdersService) private readonly workOrdersService: WorkOrdersService,
    @Inject(MaintenanceService) private readonly maintenanceService: MaintenanceService,
    @Inject(ReportsService) private readonly reportsService: ReportsService
  ) {}

  async copilotChat(dto: CopilotChatDto, user: CopilotUser = null) {
    const focusArea = dto.focusArea ?? "GENERAL";
    const mode = dto.mode ?? "CHAT";
    const markdown = dto.markdown ?? true;

    const context = await this.getCopilotContext(user, focusArea, mode);
    const conversation = await this.resolveConversation(user, dto, focusArea, mode);

    if (conversation) {
      await this.prisma.copilotMessage.create({
        data: {
          conversationId: conversation.id,
          role: "USER",
          content: dto.message,
          focusArea,
          mode
        }
      });
    }

    const history = conversation
      ? await this.prisma.copilotMessage.findMany({
          where: { conversationId: conversation.id },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            role: true,
            content: true,
            createdAt: true
          }
        })
      : [];

    const requestBody = {
      message: this.buildProjectAwareMessage({
        message: dto.message,
        focusArea,
        mode,
        user,
        context,
        history: history.reverse()
      }),
      conversation_id: conversation?.providerConversationId ?? dto.conversationId ?? null,
      mode,
      markdown
    };

    const apiKey = this.configService.get<string>("RAPIDAPI_COPILOT_API_KEY")?.trim();
    const host =
      this.configService.get<string>("RAPIDAPI_COPILOT_HOST")?.trim() ||
      "copilot5.p.rapidapi.com";

    if (!apiKey) {
      this.logger.warn(
        "Predictive AI assistant is not configured; using structured local fallback insights"
      );

      const fallback = this.buildFallbackResponse({
        dto,
        context,
        conversation,
        code: "assistant_not_configured",
        reason: "RAPIDAPI_COPILOT_API_KEY is missing"
      });

      await this.persistAssistantArtifacts({
        user,
        dto,
        context,
        conversation,
        responseText: fallback.response.text,
        fallbackCode: "assistant_not_configured",
        provider: "maintainpro-local-fallback",
        suggestedActions: fallback.response.suggestedActions,
        raw: fallback.response.raw
      });

      return fallback;
    }

    let responseText = "";
    let parsedBody: unknown = null;

    try {
      const response = await fetch(`https://${host}/copilot`, {
        method: "POST",
        headers: {
          "x-rapidapi-key": apiKey,
          "x-rapidapi-host": host,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(30_000)
      });

      responseText = await response.text();
      parsedBody = this.parseJsonSafely(responseText);

      if (!response.ok) {
        const reason = this.extractErrorMessage(parsedBody, responseText);

        this.logger.warn(
          `Copilot upstream returned ${response.status}; using structured fallback: ${reason}`
        );

        const fallback = this.buildFallbackResponse({
          dto,
          context,
          conversation,
          code: `upstream_${response.status}`,
          reason
        });

        await this.persistAssistantArtifacts({
          user,
          dto,
          context,
          conversation,
          responseText: fallback.response.text,
          fallbackCode: `upstream_${response.status}`,
          provider: "maintainpro-local-fallback",
          suggestedActions: fallback.response.suggestedActions,
          raw: fallback.response.raw
        });

        return fallback;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown provider failure";

      this.logger.error(
        `RapidAPI Copilot request failed; using structured fallback: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined
      );

      const fallback = this.buildFallbackResponse({
        dto,
        context,
        conversation,
        code: "upstream_request_failed",
        reason: errorMessage
      });

      await this.persistAssistantArtifacts({
        user,
        dto,
        context,
        conversation,
        responseText: fallback.response.text,
        fallbackCode: "upstream_request_failed",
        provider: "maintainpro-local-fallback",
        suggestedActions: fallback.response.suggestedActions,
        raw: fallback.response.raw
      });

      return fallback;
    }

    const upstreamConversationId = this.extractConversationId(parsedBody);
    const assistantText = this.extractAssistantText(parsedBody, responseText);
    const localActions = this.buildSuggestedActions(focusArea, mode, context);
    const suggestedActions = this.mergeAssistantActions(
      this.extractAssistantActions(parsedBody),
      localActions
    );

    if (conversation && upstreamConversationId) {
      await this.prisma.copilotConversation.update({
        where: { id: conversation.id },
        data: {
          providerConversationId: upstreamConversationId,
          focusArea,
          mode
        }
      });
    }

    const result = this.buildResponse({
      dto,
      context,
      conversation,
      text: assistantText,
      raw: parsedBody,
      providerConversationId: upstreamConversationId,
      suggestedActions,
      fallback: false
    });

    await this.persistAssistantArtifacts({
      user,
      dto,
      context,
      conversation,
      responseText: assistantText,
      fallbackCode: null,
      provider: "rapidapi-copilot",
      suggestedActions,
      raw: parsedBody
    });

    return result;
  }

  async getCopilotContext(
    user: CopilotUser,
    focusArea: CopilotFocusArea = "GENERAL",
    mode: CopilotMode = "CHAT"
  ) {
    if (!user?.sub) {
      return this.buildEmptyContext(focusArea, mode);
    }

    const now = new Date();
    const tenantId = user?.tenantId ?? null;
    const role = user?.role ?? "ANONYMOUS";
    const visibility = this.resolveVisibility(user?.role ?? null);

    const workOrderScope = this.buildWorkOrderScope(user);
    const vehicleScope = this.buildVehicleScope(user);
    const meterScope = this.buildMeterScope(user);
    const partScope = this.buildPartScope(user);

    const overdueWorkOrderWhere: Prisma.WorkOrderWhereInput = {
      ...workOrderScope,
      OR: [
        {
          status: WorkOrderStatus.OVERDUE
        },
        {
          dueDate: { lt: now },
          status: { in: ACTIVE_WORK_ORDER_STATUSES }
        }
      ]
    };

    const activeWorkOrderWhere: Prisma.WorkOrderWhereInput = {
      ...workOrderScope,
      status: { in: ACTIVE_WORK_ORDER_STATUSES }
    };

    const maintenanceScope: Prisma.MaintenanceScheduleWhereInput = {
      isActive: true,
      nextDueDate: { not: null }
    };

    if (tenantId) {
      maintenanceScope.OR = [
        { asset: { tenantId } },
        { vehicle: { tenantId } }
      ];
    }

    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      activeWorkOrdersCount,
      overdueWorkOrdersCount,
      activeWorkOrders,
      overdueWorkOrders,
      unassignedWorkOrders,
      overdueMaintenanceCount,
      overdueMaintenance,
      vehicles,
      fuelLogs,
      utilityReadings,
      overdueUtilityBills,
      spareParts,
      stockMovements,
      cleaningOpenIssues
    ] = await Promise.all([
      this.prisma.workOrder.count({ where: activeWorkOrderWhere }),
      this.prisma.workOrder.count({ where: overdueWorkOrderWhere }),
      this.prisma.workOrder.findMany({
        where: activeWorkOrderWhere,
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        take: 8,
        include: {
          asset: {
            select: {
              name: true,
              assetTag: true
            }
          },
          vehicle: {
            select: {
              registrationNo: true
            }
          }
        }
      }),
      this.prisma.workOrder.findMany({
        where: overdueWorkOrderWhere,
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
        take: 8,
        include: {
          asset: {
            select: {
              name: true,
              assetTag: true
            }
          },
          vehicle: {
            select: {
              registrationNo: true
            }
          }
        }
      }),
      this.prisma.workOrder.findMany({
        where: {
          ...activeWorkOrderWhere,
          technicianId: null
        },
        orderBy: { createdAt: "asc" },
        take: 5,
        include: {
          asset: {
            select: {
              name: true,
              assetTag: true
            }
          },
          vehicle: {
            select: {
              registrationNo: true
            }
          }
        }
      }),
      this.prisma.maintenanceSchedule.count({
        where: {
          ...maintenanceScope,
          nextDueDate: { lt: now }
        }
      }),
      this.prisma.maintenanceSchedule.findMany({
        where: {
          ...maintenanceScope,
          nextDueDate: { lt: now }
        },
        orderBy: { nextDueDate: "asc" },
        take: 8,
        include: {
          asset: {
            select: {
              name: true,
              assetTag: true
            }
          },
          vehicle: {
            select: {
              registrationNo: true
            }
          }
        }
      }),
      this.prisma.vehicle.findMany({
        where: vehicleScope,
        select: {
          id: true,
          registrationNo: true,
          status: true,
          nextServiceDate: true
        }
      }),
      this.prisma.fuelLog.findMany({
        where: {
          vehicle: vehicleScope,
          date: {
            gte: sixtyDaysAgo
          }
        },
        orderBy: [{ vehicleId: "asc" }, { date: "desc" }],
        take: 600,
        select: {
          vehicleId: true,
          liters: true,
          date: true,
          vehicle: {
            select: {
              registrationNo: true
            }
          }
        }
      }),
      this.prisma.meterReading.findMany({
        where: {
          meter: meterScope,
          readingDate: {
            gte: sixtyDaysAgo
          }
        },
        orderBy: [{ meterId: "asc" }, { readingDate: "desc" }],
        take: 800,
        select: {
          meterId: true,
          consumption: true,
          readingDate: true,
          meter: {
            select: {
              meterNumber: true,
              type: true,
              location: true
            }
          }
        }
      }),
      this.prisma.utilityBill.count({
        where: {
          ...(tenantId ? { tenantId } : {}),
          OR: [
            {
              status: "OVERDUE"
            },
            {
              status: "UNPAID",
              dueDate: {
                lt: now
              }
            }
          ]
        }
      }),
      this.prisma.sparePart.findMany({
        where: partScope,
        select: {
          id: true,
          partNumber: true,
          name: true,
          quantityInStock: true,
          reorderPoint: true,
          minimumStock: true
        }
      }),
      this.prisma.stockMovement.findMany({
        where: {
          type: "OUT",
          createdAt: {
            gte: thirtyDaysAgo
          },
          part: partScope
        },
        select: {
          partId: true,
          quantity: true,
          part: {
            select: {
              partNumber: true,
              name: true,
              quantityInStock: true,
              reorderPoint: true
            }
          }
        }
      }),
      this.prisma.facilityIssue.count({
        where: {
          ...(tenantId ? { tenantId } : {}),
          status: {
            in: ["OPEN", "IN_PROGRESS"]
          }
        }
      })
    ]);

    const fleetUnavailable = vehicles.filter((vehicle) =>
      ["UNDER_MAINTENANCE", "OUT_OF_SERVICE"].includes(vehicle.status)
    ).length;

    const fuelAnomalies = this.detectFuelAnomalies(fuelLogs);
    const utilityAnomalies = this.detectUtilityAnomalies(utilityReadings);

    const lowStockParts = spareParts.filter(
      (part) => part.quantityInStock <= Math.max(part.reorderPoint, 0)
    );

    const stockoutRisk = this.buildStockoutRisk(stockMovements);

    const metrics = {
      activeWorkOrders: activeWorkOrdersCount,
      overdueWorkOrders: overdueWorkOrdersCount,
      overdueMaintenanceTasks: overdueMaintenanceCount,
      fleetVehicles: vehicles.length,
      fleetUnavailable,
      fuelAnomalies: fuelAnomalies.length,
      utilityAnomalies: utilityAnomalies.length,
      overdueUtilityBills,
      lowStockParts: lowStockParts.length,
      cleaningOpenIssues
    };

    const highlightLimit = visibility === "full" ? 8 : 5;

    const highlights = {
      activeWorkOrders: activeWorkOrders.slice(0, highlightLimit).map((item) => ({
        id: item.id,
        woNumber: item.woNumber,
        title: item.title,
        priority: item.priority,
        status: item.status,
        dueDate: item.dueDate?.toISOString() ?? null,
        asset: item.asset?.name ?? item.asset?.assetTag ?? null,
        vehicle: item.vehicle?.registrationNo ?? null
      })),
      overdueWorkOrders: overdueWorkOrders.slice(0, highlightLimit).map((item) => ({
        id: item.id,
        woNumber: item.woNumber,
        title: item.title,
        priority: item.priority,
        status: item.status,
        dueDate: item.dueDate?.toISOString() ?? null,
        asset: item.asset?.name ?? item.asset?.assetTag ?? null,
        vehicle: item.vehicle?.registrationNo ?? null
      })),
      unassignedWorkOrders: unassignedWorkOrders.slice(0, 5).map((item) => ({
        id: item.id,
        woNumber: item.woNumber,
        title: item.title,
        priority: item.priority,
        asset: item.asset?.name ?? item.asset?.assetTag ?? null,
        vehicle: item.vehicle?.registrationNo ?? null
      })),
      overdueMaintenance: overdueMaintenance.slice(0, highlightLimit).map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        frequency: item.frequency,
        nextDueDate: item.nextDueDate?.toISOString() ?? null,
        asset: item.asset?.name ?? item.asset?.assetTag ?? null,
        vehicle: item.vehicle?.registrationNo ?? null
      })),
      fuelAnomalies: fuelAnomalies.slice(0, highlightLimit),
      utilityAnomalies: utilityAnomalies.slice(0, highlightLimit),
      lowStockParts: lowStockParts.slice(0, highlightLimit).map((part) => ({
        id: part.id,
        partNumber: part.partNumber,
        name: part.name,
        quantityInStock: part.quantityInStock,
        reorderPoint: part.reorderPoint
      })),
      stockoutRisk: stockoutRisk.slice(0, highlightLimit)
    };

    const insightCards: CopilotContextBundle["insightCards"] = [
      {
        id: "overdue-work-orders",
        title: "Overdue Work Orders",
        value: metrics.overdueWorkOrders,
        severity: metrics.overdueWorkOrders > 0 ? "critical" : "neutral",
        description: "Work orders that are overdue or already marked overdue."
      },
      {
        id: "fleet-anomalies",
        title: "Fuel / Fleet Anomalies",
        value: metrics.fuelAnomalies + metrics.fleetUnavailable,
        severity:
          metrics.fuelAnomalies + metrics.fleetUnavailable > 0 ? "warning" : "neutral",
        description: "Combined count of fuel anomalies and unavailable vehicles."
      },
      {
        id: "utility-anomalies",
        title: "Utility Alerts",
        value: metrics.utilityAnomalies + metrics.overdueUtilityBills,
        severity:
          metrics.utilityAnomalies + metrics.overdueUtilityBills > 0 ? "warning" : "neutral",
        description: "Potential utility spikes and overdue utility liabilities."
      },
      {
        id: "stock-risk",
        title: "Inventory Risk",
        value: metrics.lowStockParts,
        severity: metrics.lowStockParts > 0 ? "warning" : "neutral",
        description: "Active parts below or at reorder threshold."
      }
    ];

    const context: CopilotContextBundle = {
      generatedAt: now.toISOString(),
      userScope: {
        userId: user?.sub ?? null,
        role,
        tenantId,
        visibility
      },
      metrics,
      highlights,
      insightCards,
      suggestionChips: this.buildSuggestionChips(focusArea, metrics)
    };

    if (mode === "PREDICT") {
      context.suggestionChips = [
        "Predict next breakdown by asset",
        "Predict low stock depletion window",
        "Predict utility cost spikes for next cycle",
        ...context.suggestionChips
      ].slice(0, 8);
    }

    if (mode === "RECOMMEND") {
      context.suggestionChips = [
        "Recommend technician allocation",
        "Recommend maintenance schedule optimization",
        "Recommend fuel cost reduction actions",
        ...context.suggestionChips
      ].slice(0, 8);
    }

    return context;
  }

  async listConversations(user: CopilotUser, limit = 20) {
    if (!user?.sub) {
      return [];
    }

    const rows = await this.prisma.copilotConversation.findMany({
      where: {
        userId: user.sub,
        ...(user.tenantId ? { tenantId: user.tenantId } : {})
      },
      orderBy: { updatedAt: "desc" },
      take: Math.max(1, Math.min(limit, 100)),
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            role: true,
            content: true,
            createdAt: true
          }
        }
      }
    });

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      focusArea: row.focusArea,
      mode: row.mode,
      providerConversationId: row.providerConversationId,
      updatedAt: row.updatedAt.toISOString(),
      lastMessage: row.messages[0]
        ? {
            role: row.messages[0].role,
            content: row.messages[0].content,
            createdAt: row.messages[0].createdAt.toISOString()
          }
        : null
    }));
  }

  async createConversation(user: CopilotUser, dto: CopilotCreateConversationDto) {
    const authedUser = this.assertAuthedUser(user);

    const created = await this.prisma.copilotConversation.create({
      data: {
        userId: authedUser.sub,
        tenantId: authedUser.tenantId ?? null,
        title: dto.title?.trim() || "New Copilot Conversation",
        focusArea: dto.focusArea ?? "GENERAL",
        mode: dto.mode ?? "CHAT"
      }
    });

    return {
      id: created.id,
      title: created.title,
      focusArea: created.focusArea,
      mode: created.mode,
      providerConversationId: created.providerConversationId,
      updatedAt: created.updatedAt.toISOString(),
      messages: []
    };
  }

  async getConversation(user: CopilotUser, conversationId: string) {
    const authedUser = this.assertAuthedUser(user);

    const conversation = await this.prisma.copilotConversation.findFirst({
      where: {
        id: conversationId,
        userId: authedUser.sub,
        ...(authedUser.tenantId ? { tenantId: authedUser.tenantId } : {})
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 300
        }
      }
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    return {
      id: conversation.id,
      title: conversation.title,
      focusArea: conversation.focusArea,
      mode: conversation.mode,
      providerConversationId: conversation.providerConversationId,
      updatedAt: conversation.updatedAt.toISOString(),
      messages: conversation.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        focusArea: message.focusArea,
        mode: message.mode,
        suggestedActions: message.suggestedActions,
        metadata: message.metadata,
        createdAt: message.createdAt.toISOString()
      }))
    };
  }

  async logs(user: CopilotUser, query: CopilotLogsQueryDto) {
    const authedUser = this.assertAuthedUser(user);
    const limit = this.toPositiveInt(query.limit, 40, 1, 200);

    const where: Prisma.CopilotInteractionLogWhereInput = {};

    if (query.focusArea) {
      where.focusArea = query.focusArea;
    }

    if (query.mode) {
      where.mode = query.mode;
    }

    const fromDate = this.parseDate(query.from);
    const toDate = this.parseDate(query.to);

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) {
        where.createdAt.gte = fromDate;
      }
      if (toDate) {
        where.createdAt.lte = toDate;
      }
    }

    const fullAccess = this.hasFullLogAccess(authedUser.role);

    if (fullAccess && query.userId) {
      where.userId = query.userId;
    }

    if (!fullAccess) {
      where.userId = authedUser.sub;
    }

    if (authedUser.tenantId) {
      where.tenantId = authedUser.tenantId;
    }

    const rows = await this.prisma.copilotInteractionLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: {
              select: {
                name: true
              }
            }
          }
        },
        conversation: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });

    return rows.map((row) => ({
      id: row.id,
      query: row.query,
      response: row.response,
      focusArea: row.focusArea,
      mode: row.mode,
      timestamp: row.createdAt.toISOString(),
      fallbackCode: row.fallbackCode,
      provider: row.provider,
      user: {
        id: row.user.id,
        name: `${row.user.firstName} ${row.user.lastName}`.trim(),
        email: row.user.email,
        role: row.user.role.name
      },
      conversation: row.conversation
        ? {
            id: row.conversation.id,
            title: row.conversation.title
          }
        : null,
      contextSnapshot: row.contextSnapshot,
      metadata: row.metadata
    }));
  }

  async createWorkOrderAction(user: CopilotUser, dto: CreateWorkOrderActionDto) {
    const authedUser = this.assertAuthedUser(user);

    if (!dto.assetId && !dto.vehicleId) {
      throw new BadRequestException("Either assetId or vehicleId is required");
    }

    const created = await this.workOrdersService.create({
      title: dto.title,
      description: dto.description,
      priority: dto.priority ?? Priority.MEDIUM,
      type: dto.type ?? "CORRECTIVE",
      assetId: dto.assetId,
      vehicleId: dto.vehicleId,
      createdById: authedUser.sub,
      dueDate: dto.dueDate
    });

    return {
      action: "CREATE_WORK_ORDER",
      data: created
    };
  }

  async scheduleMaintenanceAction(user: CopilotUser, dto: ScheduleMaintenanceActionDto) {
    this.assertAuthedUser(user);

    if (!dto.assetId && !dto.vehicleId) {
      throw new BadRequestException("Either assetId or vehicleId is required");
    }

    const frequency = dto.frequency ?? "MONTHLY";
    const defaultIntervalByFrequency: Record<string, number> = {
      DAILY: 1,
      WEEKLY: 7,
      MONTHLY: 30,
      QUARTERLY: 90,
      BIANNUAL: 180,
      ANNUAL: 365,
      CUSTOM: 30,
      MILEAGE_BASED: 0
    };

    const schedule = await this.maintenanceService.createSchedule({
      name: dto.name,
      description: dto.description,
      type: dto.type ?? "PREVENTIVE",
      frequency,
      intervalDays:
        frequency === "MILEAGE_BASED"
          ? undefined
          : dto.intervalDays ?? defaultIntervalByFrequency[frequency],
      intervalMileage: frequency === "MILEAGE_BASED" ? dto.intervalMileage ?? 5_000 : dto.intervalMileage,
      assetId: dto.assetId,
      vehicleId: dto.vehicleId,
      nextDueDate:
        dto.nextDueDate ??
        new Date(Date.now() + (dto.intervalDays ?? 14) * 24 * 60 * 60 * 1000).toISOString()
    });

    return {
      action: "SCHEDULE_MAINTENANCE",
      data: schedule
    };
  }

  async assignTechnicianAction(user: CopilotUser, dto: AssignTechnicianActionDto) {
    this.assertAuthedUser(user);

    const assigned = await this.workOrdersService.assign(dto.workOrderId, dto.technicianId);

    return {
      action: "ASSIGN_TECHNICIAN",
      data: assigned
    };
  }

  async generateReportAction(user: CopilotUser, dto: GenerateReportActionDto) {
    this.assertAuthedUser(user);

    const reportMap: Record<CopilotReportType, () => Promise<unknown>> = {
      DASHBOARD: () => this.reportsService.dashboard(),
      MAINTENANCE_COST: () => this.reportsService.maintenanceCost(),
      FLEET_EFFICIENCY: () => this.reportsService.fleetEfficiency(),
      DOWNTIME: () => this.reportsService.downtime(),
      WORK_ORDERS: () => this.reportsService.workOrders(),
      INVENTORY: () => this.reportsService.inventory(),
      UTILITIES: () => this.reportsService.utilities()
    };

    const report = await reportMap[dto.reportType]();

    return {
      action: "GENERATE_REPORT",
      reportType: dto.reportType,
      data: report
    };
  }

  private buildResponse(params: {
    dto: CopilotChatDto;
    context: CopilotContextBundle;
    conversation: { id: string; title: string; updatedAt: Date; providerConversationId: string | null } | null;
    text: string;
    raw: unknown;
    providerConversationId: string | null;
    suggestedActions: CopilotSuggestedAction[];
    fallback: boolean;
  }) {
    const requestFocusArea = params.dto.focusArea ?? "GENERAL";
    const requestMode = params.dto.mode ?? "CHAT";

    return {
      conversation: params.conversation
        ? {
            id: params.conversation.id,
            title: params.conversation.title,
            updatedAt: params.conversation.updatedAt.toISOString(),
            providerConversationId: params.providerConversationId ?? params.conversation.providerConversationId
          }
        : null,
      request: {
        conversationId: params.dto.conversationId ?? null,
        focusArea: requestFocusArea,
        mode: requestMode,
        markdown: params.dto.markdown ?? true,
        message: params.dto.message
      },
      context: params.context,
      response: {
        conversationId:
          params.conversation?.id ??
          params.providerConversationId ??
          params.dto.conversationId ??
          `local-${Date.now().toString(36)}`,
        providerConversationId: params.providerConversationId,
        text: params.text,
        markdown: params.dto.markdown ?? true,
        suggestedActions: params.suggestedActions,
        fallback: params.fallback,
        raw: params.raw
      }
    };
  }

  private buildFallbackResponse(params: {
    dto: CopilotChatDto;
    context: CopilotContextBundle;
    conversation: { id: string; title: string; updatedAt: Date; providerConversationId: string | null } | null;
    code: string;
    reason: string;
  }) {
    const focusArea = params.dto.focusArea ?? "GENERAL";
    const mode = params.dto.mode ?? "CHAT";
    const text = this.buildFallbackText(focusArea, mode, params.dto.message, params.context);
    const suggestedActions = this.buildSuggestedActions(focusArea, mode, params.context);

    return this.buildResponse({
      dto: params.dto,
      context: params.context,
      conversation: params.conversation,
      text,
      raw: {
        source: "maintainpro-local-fallback",
        code: params.code,
        reason: params.reason
      },
      providerConversationId: params.conversation?.providerConversationId ?? null,
      suggestedActions,
      fallback: true
    });
  }

  private buildFallbackText(
    focusArea: CopilotFocusArea,
    mode: CopilotMode,
    message: string,
    context: CopilotContextBundle
  ) {
    const normalizedMessage = message.trim();

    if (/(^|\b)(hi|hello|hey)\b|say hello|greet/i.test(normalizedMessage)) {
      return "Hello from MaintainPro. I can help with maintenance, fleet, cleaning, inventory, utilities, and daily operations.";
    }

    const metrics = context.metrics;

    const guidanceByArea: Record<CopilotFocusArea, string[]> = {
      GENERAL: [
        `Active work orders: ${metrics.activeWorkOrders}`,
        `Overdue tasks: ${metrics.overdueWorkOrders + metrics.overdueMaintenanceTasks}`,
        `High-risk anomalies (fleet + utilities): ${metrics.fuelAnomalies + metrics.utilityAnomalies}`
      ],
      MAINTENANCE: [
        `Overdue work orders: ${metrics.overdueWorkOrders}`,
        `Overdue maintenance schedules: ${metrics.overdueMaintenanceTasks}`,
        "Prioritize critical assets and unassigned urgent work orders first."
      ],
      FLEET: [
        `Unavailable vehicles: ${metrics.fleetUnavailable}`,
        `Fuel anomalies detected: ${metrics.fuelAnomalies}`,
        "Focus dispatch on available vehicles with no imminent service conflicts."
      ],
      CLEANING: [
        `Open cleaning issues: ${metrics.cleaningOpenIssues}`,
        `Overdue operational tasks affecting facilities: ${metrics.overdueWorkOrders}`,
        "Escalate repeated issue locations to supervisors with timestamps."
      ],
      INVENTORY: [
        `Low stock parts: ${metrics.lowStockParts}`,
        `Potential stockout risks: ${context.highlights.stockoutRisk.length}`,
        "Link replenishment decisions to active and overdue work orders."
      ],
      UTILITIES: [
        `Utility anomalies detected: ${metrics.utilityAnomalies}`,
        `Overdue utility bills: ${metrics.overdueUtilityBills}`,
        "Validate meter spikes against site activity before escalation."
      ]
    };

    const nextSteps = guidanceByArea[focusArea]
      .map((step, index) => `${index + 1}. ${step}`)
      .join("\n");

    return [
      `Built-in MaintainPro guidance for ${focusArea.toLowerCase()} operations:`,
      `Mode: ${mode}`,
      nextSteps,
      "Suggested next commands:",
      context.suggestionChips.map((chip) => `- ${chip}`).join("\n"),
      `Original request: ${normalizedMessage}`
    ].join("\n\n");
  }

  private buildProjectAwareMessage(params: {
    message: string;
    focusArea: CopilotFocusArea;
    mode: CopilotMode;
    user: CopilotUser;
    context: CopilotContextBundle;
    history: Array<{ role: "USER" | "ASSISTANT" | "SYSTEM"; content: string; createdAt: Date }>;
  }) {
    const roleInstruction = this.roleInstruction(params.user?.role ?? null);

    const modeInstruction: Record<CopilotMode, string> = {
      CHAT:
        "Respond conversationally but always ground your advice in the provided metrics and highlights.",
      ANALYZE:
        "Provide a concise analysis with trends, likely causes, and where to investigate first.",
      PREDICT:
        "Forecast near-term risks and likely failure points with confidence notes where possible.",
      RECOMMEND:
        "Recommend optimization actions ordered by impact and execution speed."
    };

    const areaInstruction: Record<CopilotFocusArea, string> = {
      GENERAL:
        "You are MaintainPro's operations copilot across maintenance, fleet, inventory, utilities, and cleaning.",
      MAINTENANCE:
        "You are MaintainPro's maintenance copilot focused on work orders, preventive planning, and downtime reduction.",
      FLEET:
        "You are MaintainPro's fleet copilot focused on utilization, anomalies, service timing, and dispatch continuity.",
      CLEANING:
        "You are MaintainPro's cleaning copilot focused on compliance, visit quality, and issue closure.",
      INVENTORY:
        "You are MaintainPro's inventory copilot focused on stock health, replenishment risk, and spares readiness.",
      UTILITIES:
        "You are MaintainPro's utilities copilot focused on abnormal consumption, cost variance, and service continuity."
    };

    const compactHistory = params.history.map((entry) => ({
      role: entry.role,
      content: entry.content.slice(0, 500),
      createdAt: entry.createdAt.toISOString()
    }));

    const contextPacket = {
      userScope: params.context.userScope,
      metrics: params.context.metrics,
      highlights: params.context.highlights,
      suggestionChips: params.context.suggestionChips,
      history: compactHistory
    };

    return [
      areaInstruction[params.focusArea],
      roleInstruction,
      modeInstruction[params.mode],
      "Use only provided MaintainPro context. Do not invent data.",
      "Always include a final section named 'Suggested Actions' with 2-4 practical actions.",
      "Return markdown with clear headings, bullets, and a table when useful.",
      "MaintainPro Context JSON:",
      JSON.stringify(contextPacket, null, 2),
      "User request:",
      params.message.trim()
    ].join("\n\n");
  }

  private roleInstruction(role: RoleName | null) {
    switch (role) {
      case RoleName.SUPER_ADMIN:
      case RoleName.ADMIN:
        return "User role scope: admin. Provide full operational insights and action pathways.";
      case RoleName.MANAGER:
      case RoleName.SUPERVISOR:
      case RoleName.ASSET_MANAGER:
        return "User role scope: manager. Prioritize summaries, alerts, and escalation-ready recommendations.";
      case RoleName.TECHNICIAN:
      case RoleName.MECHANIC:
      case RoleName.CLEANER:
      case RoleName.DRIVER:
      case RoleName.INVENTORY_KEEPER:
        return "User role scope: assigned-only. Focus on assigned tasks and immediate execution guidance.";
      default:
        return "User role scope: restricted. Keep recommendations concise and operational.";
    }
  }

  private async resolveConversation(
    user: CopilotUser,
    dto: CopilotChatDto,
    focusArea: CopilotFocusArea,
    mode: CopilotMode
  ) {
    if (!user?.sub) {
      return null;
    }

    const incoming = dto.conversationId?.trim();
    if (incoming) {
      const existing = await this.prisma.copilotConversation.findFirst({
        where: {
          userId: user.sub,
          ...(user.tenantId ? { tenantId: user.tenantId } : {}),
          OR: [{ id: incoming }, { providerConversationId: incoming }]
        }
      });

      if (existing) {
        return existing;
      }
    }

    const created = await this.prisma.copilotConversation.create({
      data: {
        userId: user.sub,
        tenantId: user.tenantId ?? null,
        title: dto.conversationTitle?.trim() || this.deriveConversationTitle(dto.message),
        focusArea,
        mode,
        providerConversationId: incoming && incoming !== "" ? incoming : null
      }
    });

    return created;
  }

  private deriveConversationTitle(message: string) {
    const clean = message.replace(/\s+/g, " ").trim();
    if (!clean) {
      return "Operations Conversation";
    }

    return clean.length <= 70 ? clean : `${clean.slice(0, 67)}...`;
  }

  private buildSuggestedActions(
    focusArea: CopilotFocusArea,
    _mode: CopilotMode,
    context: CopilotContextBundle
  ) {
    const actions: CopilotSuggestedAction[] = [];
    const overdueCandidate = context.highlights.overdueWorkOrders[0] as
      | { title?: string; id?: string; asset?: string | null; vehicle?: string | null }
      | undefined;
    const unassignedCandidate = context.highlights.unassignedWorkOrders[0] as
      | { id?: string; title?: string }
      | undefined;
    const overdueMaintenance = context.highlights.overdueMaintenance[0] as
      | { asset?: string | null; vehicle?: string | null }
      | undefined;

    if (["GENERAL", "MAINTENANCE", "FLEET"].includes(focusArea)) {
      actions.push({
        id: "create-work-order",
        label: "Create Work Order",
        actionType: "CREATE_WORK_ORDER",
        endpoint: "/ai/actions/create-work-order",
        description: "Open a new work order from the copilot suggestion.",
        payload: {
          title: overdueCandidate?.title
            ? `Follow-up: ${overdueCandidate.title}`
            : "Copilot generated work order",
          description: "Generated from copilot recommendation.",
          priority: context.metrics.overdueWorkOrders > 0 ? "HIGH" : "MEDIUM",
          type: "CORRECTIVE"
        }
      });
    }

    if (context.metrics.overdueMaintenanceTasks > 0 || focusArea === "MAINTENANCE") {
      actions.push({
        id: "schedule-maintenance",
        label: "Schedule Maintenance",
        actionType: "SCHEDULE_MAINTENANCE",
        endpoint: "/ai/actions/schedule-maintenance",
        description: "Create a preventive maintenance schedule from current risk signals.",
        payload: {
          name: "Copilot preventive schedule",
          type: "PREVENTIVE",
          frequency: "MONTHLY",
          nextDueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          assetHint: overdueMaintenance?.asset,
          vehicleHint: overdueMaintenance?.vehicle
        }
      });
    }

    if (unassignedCandidate?.id) {
      actions.push({
        id: "assign-technician",
        label: "Assign Technician",
        actionType: "ASSIGN_TECHNICIAN",
        endpoint: "/ai/actions/assign-technician",
        description: "Assign a technician to an unassigned active work order.",
        payload: {
          workOrderId: unassignedCandidate.id,
          technicianId: ""
        }
      });
    }

    const defaultReportType: CopilotReportType =
      focusArea === "FLEET"
        ? "FLEET_EFFICIENCY"
        : focusArea === "UTILITIES"
          ? "UTILITIES"
          : focusArea === "INVENTORY"
            ? "INVENTORY"
            : focusArea === "MAINTENANCE"
              ? "MAINTENANCE_COST"
              : "DASHBOARD";

    actions.push({
      id: "generate-report",
      label: "Generate Report",
      actionType: "GENERATE_REPORT",
      endpoint: "/ai/actions/generate-report",
      description: "Generate a focused report for the current copilot focus area.",
      payload: {
        reportType: defaultReportType
      }
    });

    return actions.slice(0, 4);
  }

  private mergeAssistantActions(
    extracted: CopilotSuggestedAction[],
    fallback: CopilotSuggestedAction[]
  ) {
    const result: CopilotSuggestedAction[] = [];
    const seen = new Set<string>();

    for (const action of [...extracted, ...fallback]) {
      if (seen.has(action.actionType)) {
        continue;
      }
      seen.add(action.actionType);
      result.push(action);
    }

    return result;
  }

  private extractAssistantActions(payload: unknown) {
    if (!payload || typeof payload !== "object") {
      return [];
    }

    const record = payload as Record<string, unknown>;
    const maybeActions =
      record.suggestedActions ??
      record.actions ??
      (record.data && typeof record.data === "object"
        ? (record.data as Record<string, unknown>).suggestedActions
        : null);

    if (!Array.isArray(maybeActions)) {
      return [];
    }

    const normalized: CopilotSuggestedAction[] = [];

    for (const item of maybeActions) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const action = item as Record<string, unknown>;
      const label = typeof action.label === "string" ? action.label : null;
      const actionType =
        typeof action.actionType === "string" ? action.actionType.toUpperCase() : null;

      if (!label || !actionType) {
        continue;
      }

      if (
        ![
          "CREATE_WORK_ORDER",
          "SCHEDULE_MAINTENANCE",
          "ASSIGN_TECHNICIAN",
          "GENERATE_REPORT"
        ].includes(actionType)
      ) {
        continue;
      }

      normalized.push({
        id: `${actionType.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}`,
        label,
        actionType: actionType as CopilotSuggestedAction["actionType"],
        endpoint:
          actionType === "CREATE_WORK_ORDER"
            ? "/ai/actions/create-work-order"
            : actionType === "SCHEDULE_MAINTENANCE"
              ? "/ai/actions/schedule-maintenance"
              : actionType === "ASSIGN_TECHNICIAN"
                ? "/ai/actions/assign-technician"
                : "/ai/actions/generate-report",
        description:
          typeof action.description === "string"
            ? action.description
            : "Action suggested by assistant response.",
        payload:
          action.payload && typeof action.payload === "object"
            ? (action.payload as Record<string, unknown>)
            : {}
      });
    }

    return normalized;
  }

  private async persistAssistantArtifacts(params: {
    user: CopilotUser;
    dto: CopilotChatDto;
    context: CopilotContextBundle;
    conversation: { id: string } | null;
    responseText: string;
    fallbackCode: string | null;
    provider: string;
    suggestedActions: CopilotSuggestedAction[];
    raw: unknown;
  }) {
    if (params.conversation) {
      await this.prisma.copilotMessage.create({
        data: {
          conversationId: params.conversation.id,
          role: "ASSISTANT",
          content: params.responseText,
          focusArea: params.dto.focusArea ?? "GENERAL",
          mode: params.dto.mode ?? "CHAT",
          suggestedActions: params.suggestedActions as unknown as Prisma.InputJsonValue,
          metadata: {
            fallbackCode: params.fallbackCode,
            provider: params.provider
          }
        }
      });

      await this.prisma.copilotConversation.update({
        where: { id: params.conversation.id },
        data: {
          focusArea: params.dto.focusArea ?? "GENERAL",
          mode: params.dto.mode ?? "CHAT"
        }
      });
    }

    if (!params.user?.sub) {
      return;
    }

    await this.prisma.copilotInteractionLog.create({
      data: {
        conversationId: params.conversation?.id,
        userId: params.user.sub,
        tenantId: params.user.tenantId ?? null,
        query: params.dto.message,
        response: params.responseText,
        focusArea: params.dto.focusArea ?? "GENERAL",
        mode: params.dto.mode ?? "CHAT",
        contextSnapshot: params.context as unknown as Prisma.InputJsonValue,
        fallbackCode: params.fallbackCode,
        provider: params.provider,
        metadata: {
          raw: params.raw,
          markdown: params.dto.markdown ?? true,
          suggestedActions: params.suggestedActions
        }
      }
    });
  }

  private detectFuelAnomalies(
    fuelLogs: Array<{
      vehicleId: string;
      liters: Prisma.Decimal;
      date: Date;
      vehicle: {
        registrationNo: string;
      };
    }>
  ) {
    const logsByVehicle = new Map<
      string,
      Array<{ liters: number; date: string; registrationNo: string }>
    >();

    for (const log of fuelLogs) {
      const existing = logsByVehicle.get(log.vehicleId) ?? [];
      existing.push({
        liters: Number(log.liters),
        date: log.date.toISOString(),
        registrationNo: log.vehicle.registrationNo
      });
      logsByVehicle.set(log.vehicleId, existing);
    }

    const anomalies: Array<Record<string, unknown>> = [];

    for (const [vehicleId, logs] of logsByVehicle.entries()) {
      if (logs.length < 4) {
        continue;
      }

      const current = logs[0].liters;
      const baselineList = logs.slice(1, 4).map((entry) => entry.liters);
      const baseline = baselineList.reduce((sum, value) => sum + value, 0) / baselineList.length;

      if (baseline <= 0 || current <= baseline * 1.15) {
        continue;
      }

      anomalies.push({
        vehicleId,
        registrationNo: logs[0].registrationNo,
        latestLiters: Number(current.toFixed(2)),
        baselineLiters: Number(baseline.toFixed(2)),
        deltaPercent: Number((((current - baseline) / baseline) * 100).toFixed(1)),
        latestDate: logs[0].date
      });
    }

    return anomalies.sort((left, right) => Number(right.deltaPercent) - Number(left.deltaPercent));
  }

  private detectUtilityAnomalies(
    utilityReadings: Array<{
      meterId: string;
      consumption: Prisma.Decimal | null;
      readingDate: Date;
      meter: {
        meterNumber: string;
        type: string;
        location: string;
      };
    }>
  ) {
    const byMeter = new Map<
      string,
      Array<{
        consumption: number;
        readingDate: string;
        meterNumber: string;
        type: string;
        location: string;
      }>
    >();

    for (const reading of utilityReadings) {
      const existing = byMeter.get(reading.meterId) ?? [];
      existing.push({
        consumption: Number(reading.consumption ?? 0),
        readingDate: reading.readingDate.toISOString(),
        meterNumber: reading.meter.meterNumber,
        type: reading.meter.type,
        location: reading.meter.location
      });
      byMeter.set(reading.meterId, existing);
    }

    const anomalies: Array<Record<string, unknown>> = [];

    for (const [meterId, entries] of byMeter.entries()) {
      if (entries.length < 4) {
        continue;
      }

      const latest = entries[0];
      const baselineList = entries.slice(1, 4).map((entry) => entry.consumption);
      const baseline = baselineList.reduce((sum, value) => sum + value, 0) / baselineList.length;

      if (baseline <= 0 || latest.consumption <= baseline * 1.2) {
        continue;
      }

      anomalies.push({
        meterId,
        meterNumber: latest.meterNumber,
        type: latest.type,
        location: latest.location,
        latestConsumption: Number(latest.consumption.toFixed(2)),
        baselineConsumption: Number(baseline.toFixed(2)),
        deltaPercent: Number((((latest.consumption - baseline) / baseline) * 100).toFixed(1)),
        latestDate: latest.readingDate
      });
    }

    return anomalies.sort((left, right) => Number(right.deltaPercent) - Number(left.deltaPercent));
  }

  private buildStockoutRisk(
    stockMovements: Array<{
      partId: string;
      quantity: number;
      part: {
        partNumber: string;
        name: string;
        quantityInStock: number;
        reorderPoint: number;
      };
    }>
  ) {
    const usageByPart = new Map<
      string,
      {
        partNumber: string;
        name: string;
        quantityInStock: number;
        reorderPoint: number;
        outQuantity: number;
      }
    >();

    for (const movement of stockMovements) {
      const existing = usageByPart.get(movement.partId);

      if (existing) {
        existing.outQuantity += movement.quantity;
        continue;
      }

      usageByPart.set(movement.partId, {
        partNumber: movement.part.partNumber,
        name: movement.part.name,
        quantityInStock: movement.part.quantityInStock,
        reorderPoint: movement.part.reorderPoint,
        outQuantity: movement.quantity
      });
    }

    const result = Array.from(usageByPart.entries()).map(([partId, item]) => {
      const avgDailyUsage = item.outQuantity / 30;
      const predictedDaysToStockout = avgDailyUsage > 0 ? item.quantityInStock / avgDailyUsage : null;

      return {
        partId,
        partNumber: item.partNumber,
        name: item.name,
        quantityInStock: item.quantityInStock,
        reorderPoint: item.reorderPoint,
        avgDailyUsage: Number(avgDailyUsage.toFixed(2)),
        predictedDaysToStockout:
          predictedDaysToStockout === null ? null : Number(predictedDaysToStockout.toFixed(1))
      };
    });

    return result
      .filter((item) => item.predictedDaysToStockout !== null && item.predictedDaysToStockout <= 21)
      .sort(
        (left, right) =>
          Number(left.predictedDaysToStockout ?? Number.MAX_SAFE_INTEGER) -
          Number(right.predictedDaysToStockout ?? Number.MAX_SAFE_INTEGER)
      );
  }

  private buildEmptyContext(focusArea: CopilotFocusArea, _mode: CopilotMode): CopilotContextBundle {
    const metrics: CopilotContextBundle["metrics"] = {
      activeWorkOrders: 0,
      overdueWorkOrders: 0,
      overdueMaintenanceTasks: 0,
      fleetVehicles: 0,
      fleetUnavailable: 0,
      fuelAnomalies: 0,
      utilityAnomalies: 0,
      overdueUtilityBills: 0,
      lowStockParts: 0,
      cleaningOpenIssues: 0
    };

    return {
      generatedAt: new Date().toISOString(),
      userScope: {
        userId: null,
        role: "ANONYMOUS",
        tenantId: null,
        visibility: "summary"
      },
      metrics,
      highlights: {
        activeWorkOrders: [],
        overdueWorkOrders: [],
        unassignedWorkOrders: [],
        overdueMaintenance: [],
        fuelAnomalies: [],
        utilityAnomalies: [],
        lowStockParts: [],
        stockoutRisk: []
      },
      insightCards: [
        {
          id: "overdue-work-orders",
          title: "Overdue Work Orders",
          value: 0,
          severity: "neutral",
          description: "No operational context loaded."
        }
      ],
      suggestionChips: this.buildSuggestionChips(focusArea, metrics)
    };
  }

  private buildSuggestionChips(
    focusArea: CopilotFocusArea,
    metrics: CopilotContextBundle["metrics"]
  ) {
    const chips: string[] = [];

    if (metrics.overdueWorkOrders > 0) {
      chips.push("Show overdue maintenance");
    }
    if (metrics.fuelAnomalies > 0) {
      chips.push("Analyze fuel usage");
    }
    if (metrics.utilityAnomalies > 0) {
      chips.push("Detect abnormal utility consumption");
    }
    if (metrics.lowStockParts > 0) {
      chips.push("Predict low stock risk");
    }
    if (metrics.overdueMaintenanceTasks > 0) {
      chips.push("Schedule overdue maintenance");
    }

    const byArea: Record<CopilotFocusArea, string[]> = {
      GENERAL: [
        "Summarize top operational risks",
        "Recommend today task priorities",
        "Generate operational dashboard report"
      ],
      MAINTENANCE: [
        "Prioritize critical work orders",
        "Predict next breakdown",
        "Recommend technician allocation"
      ],
      FLEET: [
        "Review unavailable vehicles",
        "Analyze fleet anomalies",
        "Generate fleet efficiency report"
      ],
      CLEANING: [
        "Show pending cleaning issues",
        "Recommend supervisor follow-ups",
        "Summarize cleaning risk hotspots"
      ],
      INVENTORY: [
        "Show low stock spares",
        "Predict part stockouts",
        "Generate inventory exposure report"
      ],
      UTILITIES: [
        "Analyze utility anomalies",
        "Show overdue utility liabilities",
        "Generate utility report"
      ]
    };

    for (const item of byArea[focusArea]) {
      if (!chips.includes(item)) {
        chips.push(item);
      }
    }

    return chips.slice(0, 8);
  }

  private buildWorkOrderScope(user: CopilotUser): Prisma.WorkOrderWhereInput {
    const scope: Prisma.WorkOrderWhereInput = {};

    if (user?.tenantId) {
      scope.tenantId = user.tenantId;
    }

    if (!user?.role || !user.sub) {
      return scope;
    }

    if ([RoleName.TECHNICIAN, RoleName.MECHANIC].includes(user.role)) {
      scope.technicianId = user.sub;
    }

    if (user.role === RoleName.DRIVER) {
      scope.vehicle = {
        driver: {
          userId: user.sub
        }
      };
    }

    return scope;
  }

  private buildVehicleScope(user: CopilotUser): Prisma.VehicleWhereInput {
    const scope: Prisma.VehicleWhereInput = {};

    if (user?.tenantId) {
      scope.tenantId = user.tenantId;
    }

    if (user?.role === RoleName.DRIVER && user.sub) {
      scope.driver = {
        userId: user.sub
      };
    }

    return scope;
  }

  private buildMeterScope(user: CopilotUser): Prisma.UtilityMeterWhereInput {
    const scope: Prisma.UtilityMeterWhereInput = {
      isActive: true
    };

    if (user?.tenantId) {
      scope.tenantId = user.tenantId;
    }

    return scope;
  }

  private buildPartScope(user: CopilotUser): Prisma.SparePartWhereInput {
    const scope: Prisma.SparePartWhereInput = {
      isActive: true
    };

    if (user?.tenantId) {
      scope.tenantId = user.tenantId;
    }

    return scope;
  }

  private resolveVisibility(role: RoleName | null): "full" | "summary" | "assigned-only" {
    if (!role) {
      return "summary";
    }

    if ([RoleName.SUPER_ADMIN, RoleName.ADMIN].includes(role)) {
      return "full";
    }

    if ([RoleName.MANAGER, RoleName.SUPERVISOR, RoleName.ASSET_MANAGER].includes(role)) {
      return "summary";
    }

    return "assigned-only";
  }

  private hasFullLogAccess(role: RoleName) {
    return [RoleName.SUPER_ADMIN, RoleName.ADMIN].includes(role);
  }

  private assertAuthedUser(user: CopilotUser) {
    if (!user?.sub) {
      throw new ForbiddenException("Authenticated user is required");
    }
    return user;
  }

  private toPositiveInt(
    value: string | undefined,
    fallback: number,
    min: number,
    max: number
  ) {
    if (!value) {
      return fallback;
    }

    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Math.min(max, Math.max(min, Math.floor(parsed)));
  }

  private parseDate(value: string | undefined) {
    if (!value) {
      return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date;
  }

  private parseJsonSafely(value: string) {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  }

  private extractErrorMessage(parsedBody: unknown, fallbackText: string) {
    return (
      this.findFirstString(parsedBody, ["message", "error", "detail", "details"]) ??
      fallbackText ??
      "Predictive AI assistant request failed"
    );
  }

  private extractConversationId(payload: unknown) {
    return this.findFirstString(payload, ["conversation_id", "conversationId"]);
  }

  private extractAssistantText(payload: unknown, fallbackText: string) {
    const preferred = this.findFirstString(payload, [
      "reply",
      "response",
      "content",
      "text",
      "message",
      "assistant",
      "result",
      "output"
    ]);

    if (preferred) {
      return preferred;
    }

    if (typeof payload === "string" && payload.trim()) {
      return payload;
    }

    return fallbackText || "No assistant response content returned.";
  }

  private findFirstString(
    value: unknown,
    priorityKeys: string[],
    seen = new Set<unknown>()
  ): string | null {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    }

    if (!value || typeof value !== "object") {
      return null;
    }

    if (seen.has(value)) {
      return null;
    }
    seen.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = this.findFirstString(item, priorityKeys, seen);
        if (found) {
          return found;
        }
      }
      return null;
    }

    const record = value as Record<string, unknown>;

    for (const key of priorityKeys) {
      if (key in record) {
        const found = this.findFirstString(record[key], priorityKeys, seen);
        if (found) {
          return found;
        }
      }
    }

    for (const entry of Object.values(record)) {
      if (!entry || typeof entry !== "object") {
        continue;
      }

      const found = this.findFirstString(entry, priorityKeys, seen);
      if (found) {
        return found;
      }
    }

    return null;
  }
}
