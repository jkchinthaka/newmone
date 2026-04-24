import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  NotificationPriority,
  NotificationType,
  Prisma,
  Priority,
  RoleName,
  WorkOrderStatus
} from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import { NotificationsService } from "../notifications/notifications.service";
import {
  COPILOT_FOCUS_AREAS,
  COPILOT_MODES,
  type CopilotFocusArea,
  type CopilotMode,
  CopilotChatDto
} from "./dto/copilot-chat.dto";
import {
  type CopilotReportType,
  AssignTechnicianActionDto,
  CreateWorkOrderActionDto,
  GenerateReportActionDto,
  ScheduleMaintenanceActionDto
} from "./dto/copilot-actions.dto";
import {
  CopilotContextQueryDto,
  CopilotCreateConversationDto,
  CopilotLogsQueryDto
} from "./dto/copilot-query.dto";

export type CopilotActor = Pick<JwtPayload, "sub" | "role" | "email" | "tenantId">;

type CopilotRoleScope = "ADMIN" | "MANAGER" | "TECHNICIAN" | "VIEWER";

type SuggestedActionType =
  | "CREATE_WORK_ORDER"
  | "SCHEDULE_MAINTENANCE"
  | "ASSIGN_TECHNICIAN"
  | "GENERATE_REPORT";

type ConversationListOptions = {
  limit?: string;
  userId?: string;
};

type CopilotSummary = {
  activeWorkOrders: number;
  overdueTasks: number;
  assignedToMe: number;
  fleetOutOfService: number;
  utilityAnomalies: number;
  lowStockItems: number;
};

type CopilotActionSuggestion = {
  id: string;
  type: SuggestedActionType;
  label: string;
  description: string;
  payload: Record<string, unknown>;
  enabled: boolean;
  disabledReason?: string;
};

type ContextWorkOrder = {
  id: string;
  woNumber: string;
  title: string;
  priority: string;
  status: string;
  dueDate: string | null;
  technicianId: string | null;
};

type ContextMaintenanceSchedule = {
  id: string;
  name: string;
  nextDueDate: string | null;
  assetId: string | null;
  vehicleId: string | null;
};

type ContextFleetIdleVehicle = {
  id: string;
  registrationNo: string;
  lastUpdatedAt: string;
  daysIdle: number;
};

type ContextFuelAnomaly = {
  vehicleId: string;
  registrationNo: string;
  averageCostPerLiter: number;
  globalAverageCostPerLiter: number;
  variancePercent: number;
};

type ContextUtilityAnomaly = {
  meterId: string;
  meterNumber: string;
  location: string;
  utilityType: string;
  latestAmount: number;
  previousAmount: number;
  variancePercent: number;
  billingMonth: string;
};

type ContextLowStockPart = {
  id: string;
  partNumber: string;
  name: string;
  quantityInStock: number;
  reorderPoint: number;
};

type ContextProjectedStockout = {
  partId: string;
  partNumber: string;
  name: string;
  quantityInStock: number;
  avgDailyUsage: number;
  projectedDaysLeft: number;
};

type CopilotContextSnapshot = {
  generatedAt: string;
  roleScope: CopilotRoleScope;
  focusArea: CopilotFocusArea;
  mode: CopilotMode;
  summary: CopilotSummary;
  maintenance: {
    activeWorkOrders: ContextWorkOrder[];
    overdueWorkOrders: ContextWorkOrder[];
    assignedToMe: ContextWorkOrder[];
    overdueSchedules: ContextMaintenanceSchedule[];
  };
  fleet: {
    statusCounts: Record<string, number>;
    overdueServiceVehicles: Array<{
      id: string;
      registrationNo: string;
      status: string;
      nextServiceDate: string | null;
    }>;
    idleVehicles: ContextFleetIdleVehicle[];
    fuelAnomalies: ContextFuelAnomaly[];
  };
  utilities: {
    overdueBills: number;
    anomalies: ContextUtilityAnomaly[];
  };
  inventory: {
    lowStockParts: ContextLowStockPart[];
    projectedStockouts: ContextProjectedStockout[];
  };
  smartSuggestions: string[];
};

const ACTIVE_WORK_ORDER_STATUSES: WorkOrderStatus[] = ["OPEN", "IN_PROGRESS", "ON_HOLD"];
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class PredictiveAiService {
  private readonly logger = new Logger(PredictiveAiService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(NotificationsService) private readonly notificationsService: NotificationsService
  ) {}

  async copilotChat(dto: CopilotChatDto, actor: CopilotActor | null = null) {
    const focusArea = this.normalizeFocusArea(dto.focusArea);
    const mode = this.normalizeMode(dto.mode);
    const markdown = dto.markdown ?? true;

    const context = await this.getCopilotContext(actor, focusArea, mode);

    const conversation = actor
      ? await this.resolveConversation(actor, dto, focusArea, mode)
      : null;

    const createdUserMessage = actor && conversation
      ? await this.prisma.copilotMessage.create({
          data: {
            conversationId: conversation.id,
            userId: actor.sub,
            role: "USER",
            focusArea,
            mode,
            content: dto.message,
            metadata: {
              requestedStream: dto.stream ?? false
            }
          }
        })
      : null;

    const apiKey = this.configService.get<string>("RAPIDAPI_COPILOT_API_KEY")?.trim();
    const host =
      this.configService.get<string>("RAPIDAPI_COPILOT_HOST")?.trim() ||
      "copilot5.p.rapidapi.com";

    let responseText = "";
    let parsedBody: unknown = null;
    let source: "upstream" | "fallback" = "upstream";
    let fallbackCode: string | null = null;
    let fallbackReason: string | null = null;

    if (!apiKey) {
      this.logger.warn(
        "Predictive AI assistant is not configured; using built-in fallback response"
      );
      source = "fallback";
      fallbackCode = "assistant_not_configured";
      responseText = this.buildFallbackText(focusArea, dto.message, context);
      parsedBody = {
        source: "maintainpro-local-fallback",
        code: fallbackCode,
        reason: null
      };
    } else {
      const requestBody = {
        message: this.buildProjectAwareMessage(focusArea, mode, dto.message, context),
        conversation_id: conversation?.providerConversationId ?? null,
        mode: "CHAT",
        markdown: true
      };

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

        const upstreamText = await response.text();
        parsedBody = this.parseJsonSafely(upstreamText);

        if (!response.ok) {
          source = "fallback";
          fallbackCode = `upstream_${response.status}`;
          fallbackReason = this.extractErrorMessage(parsedBody, upstreamText);
          responseText = this.buildFallbackText(focusArea, dto.message, context);
          parsedBody = {
            source: "maintainpro-local-fallback",
            code: fallbackCode,
            reason: fallbackReason
          };

          this.logger.warn(
            `Copilot upstream returned ${response.status}; using built-in fallback: ${fallbackReason}`
          );
        } else {
          responseText = this.extractAssistantText(parsedBody, upstreamText);
        }
      } catch (error) {
        source = "fallback";
        fallbackCode = "upstream_request_failed";
        fallbackReason = error instanceof Error ? error.message : "Unknown provider failure";
        responseText = this.buildFallbackText(focusArea, dto.message, context);
        parsedBody = {
          source: "maintainpro-local-fallback",
          code: fallbackCode,
          reason: fallbackReason
        };

        this.logger.error(
          `RapidAPI Copilot request failed; using built-in fallback: ${fallbackReason}`,
          error instanceof Error ? error.stack : undefined
        );
      }
    }

    const suggestedActions = this.buildSuggestedActions(actor, focusArea, mode, context);
    const suggestedPrompts = context.smartSuggestions.slice(0, 6);
    const providerConversationId = this.extractConversationId(parsedBody);

    let updatedConversation = conversation;
    let createdAssistantMessage: {
      id: string;
      role: string;
      content: string;
      createdAt: Date;
      focusArea: string;
      mode: string;
      actions: unknown;
    } | null = null;

    if (actor && conversation) {
      updatedConversation = await this.prisma.copilotConversation.update({
        where: { id: conversation.id },
        data: {
          focusArea,
          mode,
          providerConversationId:
            providerConversationId ?? conversation.providerConversationId ?? null,
          lastMessageAt: new Date()
        }
      });

      createdAssistantMessage = await this.prisma.copilotMessage.create({
        data: {
          conversationId: conversation.id,
          userId: actor.sub,
          role: "ASSISTANT",
          focusArea,
          mode,
          content: responseText,
          actions: suggestedActions as unknown as Prisma.InputJsonValue,
          metadata: {
            source,
            fallbackCode,
            fallbackReason
          }
        }
      });

      await this.prisma.copilotExchangeLog.create({
        data: {
          conversationId: conversation.id,
          userId: actor.sub,
          focusArea,
          mode,
          query: dto.message,
          response: responseText,
          source
        }
      });
    }

    const responseConversationId = updatedConversation?.id ?? dto.conversationId ?? providerConversationId;

    return {
      request: {
        conversationId: dto.conversationId ?? null,
        focusArea,
        mode,
        markdown,
        stream: dto.stream ?? false,
        message: dto.message
      },
      conversation: updatedConversation
        ? {
            id: updatedConversation.id,
            title: updatedConversation.title,
            focusArea: updatedConversation.focusArea,
            mode: updatedConversation.mode,
            providerConversationId: updatedConversation.providerConversationId,
            lastMessageAt: updatedConversation.lastMessageAt.toISOString(),
            createdAt: updatedConversation.createdAt.toISOString()
          }
        : null,
      context,
      response: {
        conversationId: responseConversationId,
        providerConversationId:
          updatedConversation?.providerConversationId ?? providerConversationId ?? null,
        text: responseText,
        markdown,
        source,
        suggestedActions,
        suggestedPrompts,
        generatedAt: new Date().toISOString(),
        raw: parsedBody
      },
      exchange: {
        userMessage: createdUserMessage ? this.mapStoredMessage(createdUserMessage) : null,
        assistantMessage: createdAssistantMessage
          ? this.mapStoredMessage(createdAssistantMessage)
          : null
      }
    };
  }

  async getCopilotContext(
    actor: CopilotActor | null,
    focusAreaRaw?: CopilotContextQueryDto["focusArea"] | string,
    modeRaw?: CopilotContextQueryDto["mode"] | string
  ): Promise<CopilotContextSnapshot> {
    const focusArea = this.normalizeFocusArea(focusAreaRaw);
    const mode = this.normalizeMode(modeRaw);

    if (!actor) {
      return this.buildSyntheticContext(focusArea, mode, "VIEWER");
    }

    const roleScope = this.resolveRoleScope(actor.role);
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * DAY_MS);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);
    const oneHundredTwentyDaysAgo = new Date(now.getTime() - 120 * DAY_MS);

    const [
      activeWorkOrders,
      overdueWorkOrders,
      assignedToMe,
      overdueSchedules,
      vehicleStatusRows,
      overdueServiceVehicles,
      idleVehicles,
      fuelLogs,
      spareParts,
      stockOutMovements,
      utilityBills,
      overdueBills
    ] = await Promise.all([
      this.prisma.workOrder.findMany({
        where: {
          status: { in: ACTIVE_WORK_ORDER_STATUSES },
          ...(roleScope === "TECHNICIAN" ? { technicianId: actor.sub } : {})
        },
        select: {
          id: true,
          woNumber: true,
          title: true,
          priority: true,
          status: true,
          dueDate: true,
          technicianId: true
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: 12
      }),
      this.prisma.workOrder.findMany({
        where: {
          status: { in: ACTIVE_WORK_ORDER_STATUSES },
          dueDate: { lt: now },
          ...(roleScope === "TECHNICIAN" ? { technicianId: actor.sub } : {})
        },
        select: {
          id: true,
          woNumber: true,
          title: true,
          priority: true,
          status: true,
          dueDate: true,
          technicianId: true
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: 12
      }),
      this.prisma.workOrder.findMany({
        where: {
          status: { in: ACTIVE_WORK_ORDER_STATUSES },
          technicianId: actor.sub
        },
        select: {
          id: true,
          woNumber: true,
          title: true,
          priority: true,
          status: true,
          dueDate: true,
          technicianId: true
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: 8
      }),
      this.prisma.maintenanceSchedule.findMany({
        where: {
          isActive: true,
          nextDueDate: { lt: now }
        },
        select: {
          id: true,
          name: true,
          nextDueDate: true,
          assetId: true,
          vehicleId: true
        },
        orderBy: [{ nextDueDate: "asc" }, { createdAt: "desc" }],
        take: roleScope === "ADMIN" ? 10 : 6
      }),
      this.prisma.vehicle.groupBy({
        by: ["status"],
        _count: {
          _all: true
        }
      }),
      this.prisma.vehicle.findMany({
        where: {
          nextServiceDate: { lt: now },
          status: {
            notIn: ["DISPOSED"]
          }
        },
        select: {
          id: true,
          registrationNo: true,
          status: true,
          nextServiceDate: true
        },
        orderBy: [{ nextServiceDate: "asc" }, { createdAt: "desc" }],
        take: 10
      }),
      this.prisma.vehicle.findMany({
        where: {
          status: "AVAILABLE",
          updatedAt: { lt: fourteenDaysAgo }
        },
        select: {
          id: true,
          registrationNo: true,
          updatedAt: true
        },
        orderBy: {
          updatedAt: "asc"
        },
        take: 10
      }),
      this.prisma.fuelLog.findMany({
        where: {
          date: {
            gte: thirtyDaysAgo
          }
        },
        include: {
          vehicle: {
            select: {
              id: true,
              registrationNo: true
            }
          }
        },
        orderBy: {
          date: "desc"
        },
        take: 1200
      }),
      this.prisma.sparePart.findMany({
        where: {
          isActive: true
        },
        select: {
          id: true,
          partNumber: true,
          name: true,
          quantityInStock: true,
          reorderPoint: true
        },
        orderBy: {
          quantityInStock: "asc"
        },
        take: 400
      }),
      this.prisma.stockMovement.findMany({
        where: {
          type: "OUT",
          createdAt: {
            gte: thirtyDaysAgo
          },
          part: {
            isActive: true
          }
        },
        select: {
          quantity: true,
          part: {
            select: {
              id: true,
              partNumber: true,
              name: true,
              quantityInStock: true,
              reorderPoint: true,
              isActive: true
            }
          }
        }
      }),
      this.prisma.utilityBill.findMany({
        where: {
          billingPeriodStart: {
            gte: oneHundredTwentyDaysAgo
          }
        },
        select: {
          meterId: true,
          billingPeriodStart: true,
          totalAmount: true,
          meter: {
            select: {
              meterNumber: true,
              location: true,
              type: true
            }
          }
        },
        orderBy: {
          billingPeriodStart: "desc"
        },
        take: 250
      }),
      this.prisma.utilityBill.count({
        where: {
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
      })
    ]);

    const fleetStatusCounts = vehicleStatusRows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = row._count._all;
      return acc;
    }, {});

    const fuelAnomalies = this.detectFuelAnomalies(fuelLogs);
    const utilityAnomalies = this.detectUtilityAnomalies(utilityBills);
    const lowStockParts = spareParts
      .filter((part) => part.quantityInStock <= part.reorderPoint)
      .map((part) => ({
        id: part.id,
        partNumber: part.partNumber,
        name: part.name,
        quantityInStock: part.quantityInStock,
        reorderPoint: part.reorderPoint
      }));
    const projectedStockouts = this.projectStockouts(stockOutMovements);

    const activeWorkOrderRows = activeWorkOrders.map((item) => this.mapContextWorkOrder(item));
    const overdueWorkOrderRows = overdueWorkOrders.map((item) => this.mapContextWorkOrder(item));
    const assignedWorkOrderRows = assignedToMe.map((item) => this.mapContextWorkOrder(item));

    const scopedMaintenanceActive =
      roleScope === "TECHNICIAN" ? assignedWorkOrderRows : activeWorkOrderRows;
    const scopedMaintenanceOverdue =
      roleScope === "TECHNICIAN"
        ? assignedWorkOrderRows.filter((item) => Boolean(item.dueDate) && new Date(item.dueDate as string) < now)
        : overdueWorkOrderRows;

    const scopedUtilityAnomalies = roleScope === "TECHNICIAN" ? [] : utilityAnomalies;
    const scopedLowStock = roleScope === "TECHNICIAN" ? [] : lowStockParts;
    const scopedProjectedStockouts = roleScope === "TECHNICIAN" ? [] : projectedStockouts;

    const summary: CopilotSummary = {
      activeWorkOrders: scopedMaintenanceActive.length,
      overdueTasks:
        scopedMaintenanceOverdue.length +
        (roleScope === "TECHNICIAN" ? 0 : overdueSchedules.length + overdueBills),
      assignedToMe: assignedWorkOrderRows.length,
      fleetOutOfService:
        Number(fleetStatusCounts.OUT_OF_SERVICE ?? 0) + Number(fleetStatusCounts.UNDER_MAINTENANCE ?? 0),
      utilityAnomalies: scopedUtilityAnomalies.length,
      lowStockItems: scopedLowStock.length
    };

    const context: CopilotContextSnapshot = {
      generatedAt: new Date().toISOString(),
      roleScope,
      focusArea,
      mode,
      summary,
      maintenance: {
        activeWorkOrders: scopedMaintenanceActive.slice(0, roleScope === "ADMIN" ? 10 : 6),
        overdueWorkOrders: scopedMaintenanceOverdue.slice(0, roleScope === "ADMIN" ? 10 : 6),
        assignedToMe: assignedWorkOrderRows.slice(0, 8),
        overdueSchedules:
          roleScope === "TECHNICIAN"
            ? []
            : overdueSchedules.slice(0, 6).map((item) => ({
                id: item.id,
                name: item.name,
                nextDueDate: item.nextDueDate ? item.nextDueDate.toISOString() : null,
                assetId: item.assetId,
                vehicleId: item.vehicleId
              }))
      },
      fleet: {
        statusCounts: fleetStatusCounts,
        overdueServiceVehicles:
          roleScope === "TECHNICIAN"
            ? []
            : overdueServiceVehicles.slice(0, 8).map((item) => ({
                id: item.id,
                registrationNo: item.registrationNo,
                status: item.status,
                nextServiceDate: item.nextServiceDate ? item.nextServiceDate.toISOString() : null
              })),
        idleVehicles:
          roleScope === "TECHNICIAN"
            ? []
            : idleVehicles.slice(0, 6).map((item) => ({
                id: item.id,
                registrationNo: item.registrationNo,
                lastUpdatedAt: item.updatedAt.toISOString(),
                daysIdle: Math.max(1, Math.floor((now.getTime() - item.updatedAt.getTime()) / DAY_MS))
              })),
        fuelAnomalies: roleScope === "TECHNICIAN" ? [] : fuelAnomalies.slice(0, 6)
      },
      utilities: {
        overdueBills: roleScope === "TECHNICIAN" ? 0 : overdueBills,
        anomalies: scopedUtilityAnomalies.slice(0, 6)
      },
      inventory: {
        lowStockParts: scopedLowStock.slice(0, 8),
        projectedStockouts: scopedProjectedStockouts.slice(0, 8)
      },
      smartSuggestions: []
    };

    context.smartSuggestions = this.buildSmartSuggestions(context);

    return context;
  }

  async listConversations(actor: CopilotActor | null, options: ConversationListOptions = {}) {
    const currentActor = this.requireActor(actor);
    const limit = this.toPositiveInt(options.limit, 20, 1, 100);
    const ownerId = this.resolveOwnerId(currentActor, options.userId);

    const conversations = await this.prisma.copilotConversation.findMany({
      where: {
        userId: ownerId
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1,
          select: {
            content: true,
            role: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        lastMessageAt: "desc"
      },
      take: limit
    });

    return conversations.map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      focusArea: conversation.focusArea,
      mode: conversation.mode,
      providerConversationId: conversation.providerConversationId,
      lastMessageAt: conversation.lastMessageAt.toISOString(),
      createdAt: conversation.createdAt.toISOString(),
      preview: conversation.messages[0]?.content ?? "",
      lastRole: conversation.messages[0]?.role ?? null,
      lastMessageCreatedAt: conversation.messages[0]?.createdAt
        ? conversation.messages[0]?.createdAt.toISOString()
        : null
    }));
  }

  async createConversation(actor: CopilotActor | null, dto: CopilotCreateConversationDto) {
    const currentActor = this.requireActor(actor);
    const focusArea = this.normalizeFocusArea(dto.focusArea);
    const mode = this.normalizeMode(dto.mode);

    const title = dto.title?.trim() || `Copilot ${focusArea.toLowerCase()} session`;

    const conversation = await this.prisma.copilotConversation.create({
      data: {
        userId: currentActor.sub,
        title,
        focusArea,
        mode,
        lastMessageAt: new Date()
      }
    });

    return {
      id: conversation.id,
      title: conversation.title,
      focusArea: conversation.focusArea,
      mode: conversation.mode,
      providerConversationId: conversation.providerConversationId,
      lastMessageAt: conversation.lastMessageAt.toISOString(),
      createdAt: conversation.createdAt.toISOString()
    };
  }

  async getConversation(actor: CopilotActor | null, conversationId: string, limitRaw?: string) {
    const currentActor = this.requireActor(actor);
    const limit = this.toPositiveInt(limitRaw, 120, 1, 300);

    const conversation = await this.getAccessibleConversation(currentActor, conversationId);

    const messages = await this.prisma.copilotMessage.findMany({
      where: {
        conversationId: conversation.id
      },
      orderBy: {
        createdAt: "asc"
      },
      take: limit
    });

    return {
      id: conversation.id,
      title: conversation.title,
      focusArea: conversation.focusArea,
      mode: conversation.mode,
      providerConversationId: conversation.providerConversationId,
      lastMessageAt: conversation.lastMessageAt.toISOString(),
      createdAt: conversation.createdAt.toISOString(),
      messages: messages.map((message) => this.mapStoredMessage(message))
    };
  }

  async getConversationMessages(actor: CopilotActor | null, conversationId: string, limitRaw?: string) {
    const currentActor = this.requireActor(actor);
    const limit = this.toPositiveInt(limitRaw, 120, 1, 300);

    const conversation = await this.getAccessibleConversation(currentActor, conversationId);

    const messages = await this.prisma.copilotMessage.findMany({
      where: {
        conversationId: conversation.id
      },
      orderBy: {
        createdAt: "asc"
      },
      take: limit
    });

    return messages.map((message) => this.mapStoredMessage(message));
  }

  async logs(actor: CopilotActor | null, query: CopilotLogsQueryDto) {
    const currentActor = this.requireActor(actor);
    const limit = this.toPositiveInt(query.limit, 50, 1, 300);

    const from = this.safeParseDate(query.from);
    const to = this.safeParseDate(query.to);

    if (query.userId && !this.isPrivilegedRole(currentActor.role) && query.userId !== currentActor.sub) {
      throw new ForbiddenException("You can only access your own AI logs");
    }

    const ownerId = this.resolveOwnerId(currentActor, query.userId);

    const logs = await this.prisma.copilotExchangeLog.findMany({
      where: {
        ...(ownerId ? { userId: ownerId } : {}),
        ...(query.focusArea ? { focusArea: query.focusArea } : {}),
        ...(query.mode ? { mode: query.mode } : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {})
              }
            }
          : {})
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        conversation: {
          select: {
            id: true,
            title: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: limit
    });

    return logs.map((log) => ({
      id: log.id,
      query: log.query,
      response: log.response,
      focusArea: log.focusArea,
      mode: log.mode,
      source: log.source,
      timestamp: log.createdAt.toISOString(),
      user: {
        id: log.user.id,
        name: `${log.user.firstName} ${log.user.lastName}`.trim(),
        email: log.user.email
      },
      conversation: log.conversation
        ? {
            id: log.conversation.id,
            title: log.conversation.title
          }
        : null
    }));
  }

  predictiveLogs() {
    return this.prisma.predictiveLog.findMany({
      include: {
        asset: true
      },
      orderBy: { analyzedAt: "desc" }
    });
  }

  async createWorkOrderAction(actor: CopilotActor | null, dto: CreateWorkOrderActionDto) {
    const currentActor = this.requireActor(actor);
    this.assertOperationsRole(currentActor.role);

    const title = dto.title?.trim();
    const description = dto.description?.trim();

    if (!title) {
      throw new BadRequestException("title is required");
    }

    if (!description) {
      throw new BadRequestException("description is required");
    }

    if (!dto.assetId && !dto.vehicleId) {
      throw new BadRequestException("Either assetId or vehicleId is required");
    }

    const dueDate = dto.dueDate ? this.parseDateOrThrow(dto.dueDate, "dueDate") : undefined;

    const created = await this.prisma.workOrder.create({
      data: {
        woNumber: await this.nextWorkOrderNumber(),
        title,
        description,
        priority: dto.priority ?? Priority.MEDIUM,
        type: dto.type ?? "CORRECTIVE",
        assetId: dto.assetId,
        vehicleId: dto.vehicleId,
        createdById: currentActor.sub,
        dueDate
      }
    });

    return created;
  }

  async scheduleMaintenanceAction(actor: CopilotActor | null, dto: ScheduleMaintenanceActionDto) {
    const currentActor = this.requireActor(actor);
    this.assertOperationsRole(currentActor.role);

    const name = dto.name?.trim();
    if (!name) {
      throw new BadRequestException("name is required");
    }

    if (!dto.assetId && !dto.vehicleId) {
      throw new BadRequestException("Either assetId or vehicleId is required");
    }

    const nextDueDate = dto.nextDueDate
      ? this.parseDateOrThrow(dto.nextDueDate, "nextDueDate")
      : new Date(Date.now() + 14 * DAY_MS);

    const created = await this.prisma.maintenanceSchedule.create({
      data: {
        name,
        description: dto.description,
        type: dto.type ?? "PREVENTIVE",
        frequency: dto.frequency ?? "MONTHLY",
        intervalDays: dto.intervalDays,
        intervalMileage: dto.intervalMileage,
        assetId: dto.assetId,
        vehicleId: dto.vehicleId,
        nextDueDate,
        nextDueMileage: dto.intervalMileage,
        isActive: true
      }
    });

    return created;
  }

  async assignTechnicianAction(actor: CopilotActor | null, dto: AssignTechnicianActionDto) {
    const currentActor = this.requireActor(actor);
    this.assertOperationsRole(currentActor.role);

    if (!dto.workOrderId) {
      throw new BadRequestException("workOrderId is required");
    }

    if (!dto.technicianId) {
      throw new BadRequestException("technicianId is required");
    }

    return this.assignTechnicianInternal(dto.workOrderId, dto.technicianId);
  }

  async generateReportAction(actor: CopilotActor | null, dto: GenerateReportActionDto) {
    const currentActor = this.requireActor(actor);
    this.assertReportRole(currentActor.role);

    const type = dto.reportType;

    switch (type) {
      case "DASHBOARD":
        return this.generateDashboardReport();
      case "MAINTENANCE_COST":
        return this.generateMaintenanceCostReport();
      case "FLEET_EFFICIENCY":
        return this.generateFleetEfficiencyReport();
      case "DOWNTIME":
        return this.generateDowntimeReport();
      case "WORK_ORDERS":
        return this.generateWorkOrderReport();
      case "INVENTORY":
        return this.generateInventoryReport();
      case "UTILITIES":
      default:
        return this.generateUtilitiesReport();
    }
  }

  private async resolveConversation(
    actor: CopilotActor,
    dto: CopilotChatDto,
    focusArea: CopilotFocusArea,
    mode: CopilotMode
  ) {
    if (dto.conversationId) {
      const existing = await this.prisma.copilotConversation.findUnique({
        where: {
          id: dto.conversationId
        }
      });

      if (existing) {
        if (existing.userId !== actor.sub && !this.isPrivilegedRole(actor.role)) {
          throw new ForbiddenException("You cannot access another user's conversation");
        }

        return this.prisma.copilotConversation.update({
          where: {
            id: existing.id
          },
          data: {
            focusArea,
            mode,
            lastMessageAt: new Date()
          }
        });
      }
    }

    const conversationTitle = dto.conversationTitle?.trim() || this.deriveConversationTitle(dto.message);

    return this.prisma.copilotConversation.create({
      data: {
        userId: actor.sub,
        title: conversationTitle,
        focusArea,
        mode,
        lastMessageAt: new Date()
      }
    });
  }

  private async getAccessibleConversation(actor: CopilotActor, conversationId: string) {
    const conversation = await this.prisma.copilotConversation.findUnique({
      where: {
        id: conversationId
      }
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    if (conversation.userId !== actor.sub && !this.isPrivilegedRole(actor.role)) {
      throw new ForbiddenException("You cannot access another user's conversation");
    }

    return conversation;
  }

  private normalizeFocusArea(value?: string | null): CopilotFocusArea {
    if (!value) {
      return "GENERAL";
    }

    const upper = value.toUpperCase();
    return COPILOT_FOCUS_AREAS.includes(upper as CopilotFocusArea)
      ? (upper as CopilotFocusArea)
      : "GENERAL";
  }

  private normalizeMode(value?: string | null): CopilotMode {
    if (!value) {
      return "CHAT";
    }

    const upper = value.toUpperCase();
    return COPILOT_MODES.includes(upper as CopilotMode) ? (upper as CopilotMode) : "CHAT";
  }

  private resolveRoleScope(role: RoleName): CopilotRoleScope {
    if (role === "SUPER_ADMIN" || role === "ADMIN") {
      return "ADMIN";
    }

    if (role === "MANAGER" || role === "ASSET_MANAGER" || role === "SUPERVISOR") {
      return "MANAGER";
    }

    if (role === "TECHNICIAN" || role === "MECHANIC") {
      return "TECHNICIAN";
    }

    return "VIEWER";
  }

  private isPrivilegedRole(role: RoleName): boolean {
    return ["SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MANAGER"].includes(role);
  }

  private assertOperationsRole(role: RoleName) {
    if (!["SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MANAGER"].includes(role)) {
      throw new ForbiddenException("Your role cannot execute this AI action");
    }
  }

  private assertReportRole(role: RoleName) {
    if (!["SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR", "MANAGER"].includes(role)) {
      throw new ForbiddenException("Your role cannot generate reports from AI actions");
    }
  }

  private requireActor(actor: CopilotActor | null): CopilotActor {
    if (!actor || !actor.sub) {
      throw new ForbiddenException("Authenticated user context is required");
    }

    return actor;
  }

  private resolveOwnerId(actor: CopilotActor, requestedUserId?: string): string {
    if (requestedUserId && this.isPrivilegedRole(actor.role)) {
      return requestedUserId;
    }

    return actor.sub;
  }

  private mapStoredMessage(message: {
    id: string;
    role: string;
    content: string;
    createdAt: Date;
    focusArea: string;
    mode: string;
    actions: unknown;
  }) {
    return {
      id: message.id,
      role: message.role === "ASSISTANT" ? "assistant" : "user",
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      focusArea: message.focusArea,
      mode: message.mode,
      actions: Array.isArray(message.actions) ? message.actions : []
    };
  }

  private mapContextWorkOrder(item: {
    id: string;
    woNumber: string;
    title: string;
    priority: Priority;
    status: WorkOrderStatus;
    dueDate: Date | null;
    technicianId: string | null;
  }): ContextWorkOrder {
    return {
      id: item.id,
      woNumber: item.woNumber,
      title: item.title,
      priority: item.priority,
      status: item.status,
      dueDate: item.dueDate ? item.dueDate.toISOString() : null,
      technicianId: item.technicianId
    };
  }

  private detectFuelAnomalies(
    logs: Array<{
      liters: unknown;
      totalCost: unknown;
      vehicle: {
        id: string;
        registrationNo: string;
      };
    }>
  ): ContextFuelAnomaly[] {
    let totalLiters = 0;
    let totalCost = 0;

    type VehicleBucket = {
      liters: number;
      cost: number;
      vehicleId: string;
      registrationNo: string;
    };

    const byVehicle = new Map<string, VehicleBucket>();

    for (const log of logs) {
      const liters = Number(log.liters ?? 0);
      const cost = Number(log.totalCost ?? 0);

      if (!Number.isFinite(liters) || !Number.isFinite(cost) || liters <= 0) {
        continue;
      }

      totalLiters += liters;
      totalCost += cost;

      const current = byVehicle.get(log.vehicle.id) ?? {
        liters: 0,
        cost: 0,
        vehicleId: log.vehicle.id,
        registrationNo: log.vehicle.registrationNo
      };

      current.liters += liters;
      current.cost += cost;
      byVehicle.set(log.vehicle.id, current);
    }

    if (totalLiters <= 0) {
      return [];
    }

    const globalAverageCostPerLiter = totalCost / totalLiters;

    const anomalies: ContextFuelAnomaly[] = [];
    for (const bucket of byVehicle.values()) {
      if (bucket.liters <= 0) {
        continue;
      }

      const averageCostPerLiter = bucket.cost / bucket.liters;
      const variancePercent = ((averageCostPerLiter - globalAverageCostPerLiter) / globalAverageCostPerLiter) * 100;

      if (variancePercent >= 20) {
        anomalies.push({
          vehicleId: bucket.vehicleId,
          registrationNo: bucket.registrationNo,
          averageCostPerLiter: Number(averageCostPerLiter.toFixed(2)),
          globalAverageCostPerLiter: Number(globalAverageCostPerLiter.toFixed(2)),
          variancePercent: Number(variancePercent.toFixed(1))
        });
      }
    }

    return anomalies.sort((left, right) => right.variancePercent - left.variancePercent);
  }

  private detectUtilityAnomalies(
    bills: Array<{
      meterId: string;
      billingPeriodStart: Date;
      totalAmount: unknown;
      meter: {
        meterNumber: string;
        location: string;
        type: string;
      };
    }>
  ): ContextUtilityAnomaly[] {
    const byMeter = new Map<string, typeof bills>();

    for (const bill of bills) {
      const group = byMeter.get(bill.meterId) ?? [];
      group.push(bill);
      byMeter.set(bill.meterId, group);
    }

    const anomalies: ContextUtilityAnomaly[] = [];

    for (const [meterId, meterBills] of byMeter.entries()) {
      const sorted = [...meterBills].sort(
        (left, right) => right.billingPeriodStart.getTime() - left.billingPeriodStart.getTime()
      );

      if (sorted.length < 2) {
        continue;
      }

      const latest = sorted[0];
      const previous = sorted[1];

      const latestAmount = Number(latest.totalAmount ?? 0);
      const previousAmount = Number(previous.totalAmount ?? 0);

      if (previousAmount <= 0 || !Number.isFinite(latestAmount) || !Number.isFinite(previousAmount)) {
        continue;
      }

      const variancePercent = ((latestAmount - previousAmount) / previousAmount) * 100;

      if (variancePercent >= 20) {
        anomalies.push({
          meterId,
          meterNumber: latest.meter.meterNumber,
          location: latest.meter.location,
          utilityType: latest.meter.type,
          latestAmount: Number(latestAmount.toFixed(2)),
          previousAmount: Number(previousAmount.toFixed(2)),
          variancePercent: Number(variancePercent.toFixed(1)),
          billingMonth: latest.billingPeriodStart.toISOString().slice(0, 7)
        });
      }
    }

    return anomalies.sort((left, right) => right.variancePercent - left.variancePercent);
  }

  private projectStockouts(
    stockMovements: Array<{
      quantity: number;
      part: {
        id: string;
        partNumber: string;
        name: string;
        quantityInStock: number;
        reorderPoint: number;
        isActive: boolean;
      };
    }>
  ): ContextProjectedStockout[] {
    type ProjectionBucket = {
      partId: string;
      partNumber: string;
      name: string;
      quantityInStock: number;
      totalOut: number;
    };

    const byPart = new Map<string, ProjectionBucket>();

    for (const movement of stockMovements) {
      if (!movement.part.isActive) {
        continue;
      }

      const current = byPart.get(movement.part.id) ?? {
        partId: movement.part.id,
        partNumber: movement.part.partNumber,
        name: movement.part.name,
        quantityInStock: movement.part.quantityInStock,
        totalOut: 0
      };

      current.totalOut += movement.quantity;
      current.quantityInStock = movement.part.quantityInStock;
      byPart.set(movement.part.id, current);
    }

    const projected: ContextProjectedStockout[] = [];

    for (const bucket of byPart.values()) {
      const avgDailyUsage = bucket.totalOut / 30;
      if (avgDailyUsage <= 0) {
        continue;
      }

      const projectedDaysLeft = bucket.quantityInStock / avgDailyUsage;

      if (projectedDaysLeft <= 21) {
        projected.push({
          partId: bucket.partId,
          partNumber: bucket.partNumber,
          name: bucket.name,
          quantityInStock: bucket.quantityInStock,
          avgDailyUsage: Number(avgDailyUsage.toFixed(2)),
          projectedDaysLeft: Number(projectedDaysLeft.toFixed(1))
        });
      }
    }

    return projected.sort((left, right) => left.projectedDaysLeft - right.projectedDaysLeft);
  }

  private buildSmartSuggestions(context: CopilotContextSnapshot): string[] {
    const suggestions: string[] = [];

    if (context.summary.overdueTasks > 0) {
      suggestions.push("Show overdue maintenance");
    }

    if (context.fleet.fuelAnomalies.length > 0) {
      suggestions.push("Analyze fuel usage");
    }

    if (context.maintenance.overdueWorkOrders.length > 0) {
      suggestions.push("Predict next breakdown");
    }

    if (context.inventory.lowStockParts.length > 0) {
      suggestions.push("Highlight low stock spare parts");
    }

    if (context.utilities.anomalies.length > 0) {
      suggestions.push("Explain utility anomaly trend");
    }

    switch (context.focusArea) {
      case "MAINTENANCE":
        suggestions.push("List critical overdue work orders");
        suggestions.push("Recommend preventive schedule updates");
        break;
      case "FLEET":
        suggestions.push("Show vehicles at service risk");
        suggestions.push("Identify idle vehicles older than 14 days");
        break;
      case "UTILITIES":
        suggestions.push("Generate utilities anomaly report");
        suggestions.push("Compare latest utility costs by location");
        break;
      case "INVENTORY":
        suggestions.push("Forecast stockout timeline");
        suggestions.push("Suggest reorder priorities");
        break;
      case "CLEANING":
        suggestions.push("Summarize unresolved cleaning issues");
        suggestions.push("Prioritize supervisor sign-off queue");
        break;
      case "GENERAL":
      default:
        suggestions.push("Summarize today's highest operational risks");
        suggestions.push("Recommend top 3 actions for this shift");
        break;
    }

    return Array.from(new Set(suggestions)).slice(0, 8);
  }

  private buildSuggestedActions(
    actor: CopilotActor | null,
    focusArea: CopilotFocusArea,
    mode: CopilotMode,
    context: CopilotContextSnapshot
  ): CopilotActionSuggestion[] {
    const operationsEnabled = Boolean(
      actor && ["SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MANAGER"].includes(actor.role)
    );
    const reportEnabled = Boolean(
      actor && ["SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR", "MANAGER"].includes(actor.role)
    );

    const defaultCreatePayload: Record<string, unknown> = {
      title: this.suggestWorkOrderTitle(focusArea, mode),
      description: "Generated from MaintainPro AI Copilot recommendation",
      priority: context.summary.overdueTasks >= 5 ? "HIGH" : "MEDIUM",
      type: focusArea === "MAINTENANCE" ? "PREVENTIVE" : "CORRECTIVE"
    };

    const defaultSchedulePayload: Record<string, unknown> = {
      name: this.suggestScheduleName(focusArea),
      description: "Generated from MaintainPro AI Copilot recommendation",
      type: "PREVENTIVE",
      frequency: "MONTHLY",
      nextDueDate: new Date(Date.now() + 7 * DAY_MS).toISOString()
    };

    const unassigned = context.maintenance.activeWorkOrders.find((item) => !item.technicianId);
    const assignPayload: Record<string, unknown> = {
      workOrderId: unassigned?.id ?? "",
      technicianId: ""
    };

    const reportType = this.reportTypeForFocus(focusArea);

    const disabledReason = "Role does not have permission for this operation";

    return [
      {
        id: "action-create-task",
        type: "CREATE_WORK_ORDER",
        label: "Create Task",
        description: "Create a work order from the copilot recommendation.",
        payload: defaultCreatePayload,
        enabled: operationsEnabled,
        disabledReason: operationsEnabled ? undefined : disabledReason
      },
      {
        id: "action-schedule-maintenance",
        type: "SCHEDULE_MAINTENANCE",
        label: "Schedule Maintenance",
        description: "Create a preventive maintenance schedule.",
        payload: defaultSchedulePayload,
        enabled: operationsEnabled,
        disabledReason: operationsEnabled ? undefined : disabledReason
      },
      {
        id: "action-assign-technician",
        type: "ASSIGN_TECHNICIAN",
        label: "Assign Technician",
        description: "Assign an available technician to the selected work order.",
        payload: assignPayload,
        enabled: operationsEnabled && Boolean(unassigned),
        disabledReason: operationsEnabled
          ? unassigned
            ? undefined
            : "No unassigned active work orders available"
          : disabledReason
      },
      {
        id: "action-generate-report",
        type: "GENERATE_REPORT",
        label: "Generate Report",
        description: "Generate a module report for current insights.",
        payload: {
          reportType
        },
        enabled: reportEnabled,
        disabledReason: reportEnabled ? undefined : disabledReason
      }
    ];
  }

  private suggestWorkOrderTitle(focusArea: CopilotFocusArea, mode: CopilotMode) {
    const label = focusArea === "GENERAL" ? "Operations" : focusArea;
    return `${label} ${mode.toLowerCase()} follow-up`;
  }

  private suggestScheduleName(focusArea: CopilotFocusArea) {
    if (focusArea === "MAINTENANCE") {
      return "Preventive maintenance optimization cycle";
    }

    if (focusArea === "FLEET") {
      return "Fleet reliability preventive cycle";
    }

    if (focusArea === "UTILITIES") {
      return "Utility systems preventive inspection";
    }

    return "Copilot recommended preventive cycle";
  }

  private reportTypeForFocus(focusArea: CopilotFocusArea): CopilotReportType {
    switch (focusArea) {
      case "FLEET":
        return "FLEET_EFFICIENCY";
      case "UTILITIES":
        return "UTILITIES";
      case "INVENTORY":
        return "INVENTORY";
      case "MAINTENANCE":
        return "MAINTENANCE_COST";
      case "GENERAL":
      case "CLEANING":
      default:
        return "DASHBOARD";
    }
  }

  private buildProjectAwareMessage(
    focusArea: CopilotFocusArea,
    mode: CopilotMode,
    message: string,
    context: CopilotContextSnapshot
  ) {
    const trimmedMessage = message.trim();

    const modeGuidance: Record<CopilotMode, string> = {
      CHAT: "Answer directly and concisely using real system context.",
      ANALYZE:
        "Provide data-backed operational analysis, identify patterns, and explain what matters most now.",
      PREDICT:
        "Predict near-term risks and likely failures using the provided context and suggest early mitigations.",
      RECOMMEND:
        "Recommend concrete optimization actions with priority, owner role, and expected impact."
    };

    const focusGuidance: Record<CopilotFocusArea, string> = {
      GENERAL:
        "You are MaintainPro's operations copilot across maintenance, fleet, utilities, cleaning, and inventory.",
      MAINTENANCE:
        "Focus on preventive maintenance optimization, overdue work orders, and failure prevention.",
      FLEET:
        "Focus on fleet status, fuel anomalies, idle vehicles, and service risk.",
      CLEANING:
        "Focus on cleaning visit compliance, sign-off quality, and unresolved facility issues.",
      INVENTORY:
        "Focus on low stock prediction, reorder urgency, and spare part risk.",
      UTILITIES:
        "Focus on utility anomalies, consumption variance, and cost-control actions."
    };

    const promptContext = {
      generatedAt: context.generatedAt,
      roleScope: context.roleScope,
      summary: context.summary,
      maintenance: {
        overdueWorkOrders: context.maintenance.overdueWorkOrders,
        overdueSchedules: context.maintenance.overdueSchedules
      },
      fleet: {
        statusCounts: context.fleet.statusCounts,
        overdueServiceVehicles: context.fleet.overdueServiceVehicles,
        fuelAnomalies: context.fleet.fuelAnomalies,
        idleVehicles: context.fleet.idleVehicles
      },
      utilities: context.utilities,
      inventory: {
        lowStockParts: context.inventory.lowStockParts,
        projectedStockouts: context.inventory.projectedStockouts
      }
    };

    return [
      "You are MaintainPro AI Copilot for production operations.",
      focusGuidance[focusArea],
      `Current mode: ${mode}. ${modeGuidance[mode]}`,
      "Use only the provided live context as the operational source of truth. Avoid generic advice.",
      "Respond using markdown with concise sections and actionable steps.",
      "Include a short section titled 'Actionable next steps'.",
      "Live system context:",
      JSON.stringify(promptContext, null, 2),
      "User request:",
      trimmedMessage
    ].join("\n\n");
  }

  private buildFallbackText(
    focusArea: CopilotFocusArea,
    message: string,
    context: CopilotContextSnapshot
  ) {
    const normalizedMessage = message.trim();

    if (/(^|\b)(hi|hello|hey)\b|say hello|greet/i.test(normalizedMessage)) {
      return "Hello from MaintainPro. I can help with maintenance, fleet, cleaning, inventory, utilities, and daily operations.";
    }

    const summary = context.summary;

    const fallbackByArea: Record<CopilotFocusArea, string[]> = {
      GENERAL: [
        "Prioritize overdue tasks that impact uptime, safety, or compliance.",
        "Resolve active blockers linking work orders, low stock, and utility issues.",
        "Escalate only risks that threaten today's operational continuity."
      ],
      MAINTENANCE: [
        "Start with critical overdue preventive and corrective work orders.",
        "Assign technicians to unassigned high-priority tasks before scheduling new work.",
        "Bundle repeat failures into a root-cause maintenance action plan."
      ],
      FLEET: [
        "Investigate vehicles that are out of service and overdue for maintenance first.",
        "Audit fuel anomalies to separate route effects from efficiency issues.",
        "Review idle vehicles for redeployment or maintenance scheduling."
      ],
      CLEANING: [
        "Prioritize unresolved facility issues and rejected sign-offs.",
        "Check for repeated location-level compliance misses.",
        "Close feedback loops with supervisors before next shift handover."
      ],
      INVENTORY: [
        "Start with low-stock critical spare parts and projected stockouts.",
        "Prioritize reorders for parts linked to active overdue work orders.",
        "Review usage velocity and supplier lead time before adjusting thresholds."
      ],
      UTILITIES: [
        "Validate major month-over-month utility cost variances by meter and location.",
        "Address overdue utility bills and abnormal usage in the same response cycle.",
        "Plan immediate containment and medium-term efficiency actions."
      ]
    };

    const nextSteps = fallbackByArea[focusArea]
      .map((step, index) => `${index + 1}. ${step}`)
      .join("\n");

    return [
      `Built-in MaintainPro guidance for ${focusArea.toLowerCase()} operations:`,
      `Current snapshot: ${summary.activeWorkOrders} active work orders, ${summary.overdueTasks} overdue tasks, ${summary.fleetOutOfService} fleet units out of service, ${summary.utilityAnomalies} utility anomalies, ${summary.lowStockItems} low-stock parts.`,
      "### Actionable next steps",
      nextSteps,
      `Original request: ${normalizedMessage}`
    ].join("\n\n");
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

  private buildSyntheticContext(
    focusArea: CopilotFocusArea,
    mode: CopilotMode,
    roleScope: CopilotRoleScope
  ): CopilotContextSnapshot {
    const context: CopilotContextSnapshot = {
      generatedAt: new Date().toISOString(),
      roleScope,
      focusArea,
      mode,
      summary: {
        activeWorkOrders: 0,
        overdueTasks: 0,
        assignedToMe: 0,
        fleetOutOfService: 0,
        utilityAnomalies: 0,
        lowStockItems: 0
      },
      maintenance: {
        activeWorkOrders: [],
        overdueWorkOrders: [],
        assignedToMe: [],
        overdueSchedules: []
      },
      fleet: {
        statusCounts: {},
        overdueServiceVehicles: [],
        idleVehicles: [],
        fuelAnomalies: []
      },
      utilities: {
        overdueBills: 0,
        anomalies: []
      },
      inventory: {
        lowStockParts: [],
        projectedStockouts: []
      },
      smartSuggestions: []
    };

    context.smartSuggestions = this.buildSmartSuggestions(context);
    return context;
  }

  private deriveConversationTitle(message: string) {
    const normalized = message.trim().replace(/\s+/g, " ");
    if (!normalized) {
      return "New Copilot Conversation";
    }

    if (normalized.length <= 68) {
      return normalized;
    }

    return `${normalized.slice(0, 65)}...`;
  }

  private async assignTechnicianInternal(workOrderId: string, technicianId: string) {
    const workOrder = await this.prisma.workOrder.findUnique({
      where: {
        id: workOrderId
      },
      select: {
        id: true,
        woNumber: true
      }
    });

    if (!workOrder) {
      throw new NotFoundException("Work order not found");
    }

    const technician = await this.prisma.user.findUnique({
      where: {
        id: technicianId
      },
      include: {
        role: true
      }
    });

    if (!technician) {
      throw new NotFoundException("Technician user not found");
    }

    if (["DRIVER", "VIEWER"].includes(technician.role.name)) {
      throw new BadRequestException("Cannot assign a work order to a DRIVER or VIEWER");
    }

    const updated = await this.prisma.workOrder.update({
      where: {
        id: workOrderId
      },
      data: {
        technicianId
      }
    });

    await this.notificationsService.createNotification({
      userId: technicianId,
      title: "Work order assigned",
      message: `Work order ${workOrder.woNumber} has been assigned to you`,
      type: NotificationType.WORK_ORDER_ASSIGNED,
      priority: NotificationPriority.WARNING,
      channel: "IN_APP",
      referenceId: workOrder.id,
      referenceType: "WorkOrder"
    });

    return updated;
  }

  private async nextWorkOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.workOrder.count({
      where: {
        createdAt: {
          gte: new Date(`${year}-01-01T00:00:00.000Z`),
          lte: new Date(`${year}-12-31T23:59:59.999Z`)
        }
      }
    });

    const sequence = String(count + 1).padStart(4, "0");
    return `WO-${year}-${sequence}`;
  }

  private async generateDashboardReport() {
    const [activeWorkOrders, overdueWorkOrders, fleetByStatus, parts, overdueBills] = await Promise.all([
      this.prisma.workOrder.count({
        where: {
          status: {
            in: ACTIVE_WORK_ORDER_STATUSES
          }
        }
      }),
      this.prisma.workOrder.count({
        where: {
          status: {
            in: ACTIVE_WORK_ORDER_STATUSES
          },
          dueDate: {
            lt: new Date()
          }
        }
      }),
      this.prisma.vehicle.groupBy({
        by: ["status"],
        _count: {
          _all: true
        }
      }),
      this.prisma.sparePart.findMany({
        where: {
          isActive: true
        },
        select: {
          quantityInStock: true,
          reorderPoint: true
        }
      }),
      this.prisma.utilityBill.count({
        where: {
          OR: [
            {
              status: "OVERDUE"
            },
            {
              status: "UNPAID",
              dueDate: {
                lt: new Date()
              }
            }
          ]
        }
      })
    ]);

    const lowStockCount = parts.filter((part) => part.quantityInStock <= part.reorderPoint).length;

    return {
      generatedAt: new Date().toISOString(),
      activeWorkOrders,
      overdueWorkOrders,
      fleetByStatus,
      lowStockCount,
      overdueBills
    };
  }

  private async generateMaintenanceCostReport() {
    const logs = await this.prisma.maintenanceLog.findMany({
      select: {
        performedAt: true,
        cost: true,
        vehicleId: true,
        assetId: true
      },
      orderBy: {
        performedAt: "asc"
      }
    });

    const byMonth = new Map<string, number>();
    for (const log of logs) {
      const month = log.performedAt.toISOString().slice(0, 7);
      byMonth.set(month, (byMonth.get(month) ?? 0) + Number(log.cost ?? 0));
    }

    return {
      generatedAt: new Date().toISOString(),
      totalsByMonth: Array.from(byMonth.entries()).map(([month, totalCost]) => ({
        month,
        totalCost: Number(totalCost.toFixed(2))
      })),
      records: logs.map((log) => ({
        performedAt: log.performedAt.toISOString(),
        cost: Number(log.cost ?? 0),
        vehicleId: log.vehicleId,
        assetId: log.assetId
      }))
    };
  }

  private async generateFleetEfficiencyReport() {
    const vehicles = await this.prisma.vehicle.findMany({
      include: {
        fuelLogs: true,
        tripLogs: true
      }
    });

    return vehicles.map((vehicle) => {
      const totalDistance = vehicle.tripLogs.reduce((sum, trip) => sum + Number(trip.distance), 0);
      const totalFuel = vehicle.fuelLogs.reduce((sum, log) => sum + Number(log.liters), 0);
      const totalCost = vehicle.fuelLogs.reduce((sum, log) => sum + Number(log.totalCost), 0);
      const averageFuelConsumption = totalDistance > 0 ? (totalFuel / totalDistance) * 100 : 0;

      return {
        vehicleId: vehicle.id,
        registrationNo: vehicle.registrationNo,
        totalDistance,
        averageFuelConsumption: Number(averageFuelConsumption.toFixed(2)),
        costPerKm: totalDistance > 0 ? Number((totalCost / totalDistance).toFixed(3)) : 0,
        utilizationRate: vehicle.status === "IN_USE" ? 1 : 0
      };
    });
  }

  private async generateDowntimeReport() {
    const orders = await this.prisma.workOrder.findMany({
      where: {
        completedDate: {
          not: null
        },
        startDate: {
          not: null
        }
      }
    });

    const records = orders.map((item) => {
      const start = item.startDate?.getTime() ?? 0;
      const end = item.completedDate?.getTime() ?? 0;
      const hours = Math.max(0, end - start) / (1000 * 60 * 60);

      return {
        workOrderId: item.id,
        assetId: item.assetId,
        vehicleId: item.vehicleId,
        downtimeHours: Number(hours.toFixed(2))
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      records,
      mttrHours:
        records.length > 0
          ? Number((records.reduce((sum, item) => sum + item.downtimeHours, 0) / records.length).toFixed(2))
          : 0,
      mtbfHours: records.length > 0 ? Number((720 / records.length).toFixed(2)) : 0
    };
  }

  private async generateWorkOrderReport() {
    const [total, completed, breached, byStatus, byPriority] = await Promise.all([
      this.prisma.workOrder.count(),
      this.prisma.workOrder.count({
        where: {
          status: "COMPLETED"
        }
      }),
      this.prisma.workOrder.count({
        where: {
          slaBreached: true
        }
      }),
      this.prisma.workOrder.groupBy({
        by: ["status"],
        _count: {
          _all: true
        }
      }),
      this.prisma.workOrder.groupBy({
        by: ["priority"],
        _count: {
          _all: true
        }
      })
    ]);

    return {
      generatedAt: new Date().toISOString(),
      completionRate: total > 0 ? Number((completed / total).toFixed(3)) : 0,
      slaComplianceRate: total > 0 ? Number(((total - breached) / total).toFixed(3)) : 0,
      byStatus,
      byPriority
    };
  }

  private async generateInventoryReport() {
    const [allParts, topUsed] = await Promise.all([
      this.prisma.sparePart.findMany({
        where: {
          isActive: true
        },
        select: {
          id: true,
          partNumber: true,
          name: true,
          quantityInStock: true,
          reorderPoint: true,
          unitCost: true
        },
        orderBy: {
          quantityInStock: "asc"
        },
        take: 500
      }),
      this.prisma.stockMovement.groupBy({
        by: ["partId"],
        where: {
          type: "OUT",
          createdAt: {
            gte: new Date(Date.now() - 30 * DAY_MS)
          }
        },
        _sum: {
          quantity: true
        },
        orderBy: {
          _sum: {
            quantity: "desc"
          }
        },
        take: 10
      })
    ]);

    const lowStock = allParts.filter((part) => part.quantityInStock <= part.reorderPoint).slice(0, 25);

    return {
      generatedAt: new Date().toISOString(),
      lowStock: lowStock.map((part) => ({
        id: part.id,
        partNumber: part.partNumber,
        name: part.name,
        quantityInStock: part.quantityInStock,
        reorderPoint: part.reorderPoint,
        estimatedStockValue: Number(part.unitCost) * part.quantityInStock
      })),
      topUsed
    };
  }

  private async generateUtilitiesReport() {
    const bills = await this.prisma.utilityBill.findMany({
      include: {
        meter: true
      },
      orderBy: {
        billingPeriodStart: "asc"
      }
    });

    const anomalies = this.detectUtilityAnomalies(
      bills.map((bill) => ({
        meterId: bill.meterId,
        billingPeriodStart: bill.billingPeriodStart,
        totalAmount: bill.totalAmount,
        meter: {
          meterNumber: bill.meter.meterNumber,
          location: bill.meter.location,
          type: bill.meter.type
        }
      }))
    );

    return {
      generatedAt: new Date().toISOString(),
      records: bills.map((bill) => ({
        utilityType: bill.meter.type,
        month: bill.billingPeriodStart.toISOString().slice(0, 7),
        consumption: Number(bill.totalConsumption),
        cost: Number(bill.totalAmount),
        location: bill.meter.location
      })),
      anomalies
    };
  }

  private toPositiveInt(
    raw: string | undefined,
    fallback: number,
    min: number,
    max: number
  ): number {
    if (!raw) {
      return fallback;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Math.min(max, Math.max(min, Math.floor(parsed)));
  }

  private parseDateOrThrow(value: string, field: string): Date {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} must be a valid ISO date`);
    }

    return parsed;
  }

  private safeParseDate(value?: string): Date | null {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed;
  }
}
