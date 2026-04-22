import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { PrismaService } from "../../database/prisma.service";
import {
  type CopilotFocusArea,
  type CopilotMode,
  CopilotChatDto
} from "./dto/copilot-chat.dto";

@Injectable()
export class PredictiveAiService {
  private readonly logger = new Logger(PredictiveAiService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly configService: ConfigService
  ) {}

  async copilotChat(dto: CopilotChatDto) {
    const apiKey = this.configService.get<string>("RAPIDAPI_COPILOT_API_KEY")?.trim();
    const host =
      this.configService.get<string>("RAPIDAPI_COPILOT_HOST")?.trim() ||
      "copilot5.p.rapidapi.com";

    if (!apiKey) {
      this.logger.warn(
        "Predictive AI assistant is not configured; using built-in fallback response"
      );

      return this.buildFallbackResponse(dto, "assistant_not_configured");
    }

    const requestBody = {
      message: this.buildProjectAwareMessage(dto.focusArea ?? "GENERAL", dto.message),
      conversation_id: dto.conversationId ?? null,
      mode: (dto.mode ?? "CHAT") as CopilotMode,
      markdown: dto.markdown ?? true
    };

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
          `Copilot upstream returned ${response.status}; using built-in fallback: ${reason}`
        );

        return this.buildFallbackResponse(dto, `upstream_${response.status}`, reason);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown provider failure";

      this.logger.error(
        `RapidAPI Copilot request failed; using built-in fallback: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined
      );

      return this.buildFallbackResponse(dto, "upstream_request_failed", errorMessage);
    }

    return this.buildResponse(dto, {
      conversationId: this.extractConversationId(parsedBody),
      text: this.extractAssistantText(parsedBody, responseText),
      raw: parsedBody
    });
  }

  logs() {
    return this.prisma.predictiveLog.findMany({
      include: {
        asset: true
      },
      orderBy: { analyzedAt: "desc" }
    });
  }

  private buildResponse(
    dto: CopilotChatDto,
    response: {
      conversationId: string | null;
      text: string;
      raw: unknown;
    }
  ) {
    return {
      request: {
        conversationId: dto.conversationId ?? null,
        focusArea: dto.focusArea ?? "GENERAL",
        mode: dto.mode ?? "CHAT",
        markdown: dto.markdown ?? true,
        message: dto.message
      },
      response
    };
  }

  private buildFallbackResponse(
    dto: CopilotChatDto,
    code: string,
    reason?: string
  ) {
    return this.buildResponse(dto, {
      conversationId: dto.conversationId ?? `local-${Date.now().toString(36)}`,
      text: this.buildFallbackText(dto.focusArea ?? "GENERAL", dto.message),
      raw: {
        source: "maintainpro-local-fallback",
        code,
        reason: reason ?? null
      }
    });
  }

  private buildFallbackText(focusArea: CopilotFocusArea, message: string) {
    const normalizedMessage = message.trim();

    if (/(^|\b)(hi|hello|hey)\b|say hello|greet/i.test(normalizedMessage)) {
      return "Hello from MaintainPro. I can help with maintenance, fleet, cleaning, inventory, utilities, and daily operations.";
    }

    const fallbackByArea: Record<CopilotFocusArea, string[]> = {
      GENERAL: [
        "Review overdue work orders, fleet exceptions, cleaning misses, and utility anomalies first.",
        "Confirm whether any blocked task depends on inventory shortages or unresolved supplier delays.",
        "Escalate only the risks that affect service continuity, safety, or compliance today."
      ],
      MAINTENANCE: [
        "Start with overdue preventive work orders on critical assets and vehicles.",
        "Group failures by repeat issue so technicians can resolve root causes instead of symptoms.",
        "Check spare-part availability before promising completion times."
      ],
      FLEET: [
        "Review live vehicle availability, delayed trips, and breakdown risk together.",
        "Prioritize dispatch decisions that protect route coverage and driver safety.",
        "Reassign vehicles only after confirming driver status, fuel readiness, and maintenance constraints."
      ],
      CLEANING: [
        "Check missed QR scans, rejected sign-offs, and open facility issues for the same location patterns.",
        "Escalate repeat compliance failures to supervisors with clear timestamps and location history.",
        "Close the loop by documenting corrective action before the next scheduled visit."
      ],
      INVENTORY: [
        "Start with critical items that are low stock, slow to replenish, or tied to open work orders.",
        "Separate urgent replenishment from routine restocking so lead times stay realistic.",
        "Review supplier performance before adjusting reorder thresholds."
      ],
      UTILITIES: [
        "Check the latest consumption spike, outage, or abnormal reading against recent operational changes.",
        "Validate meter readings and affected locations before escalating an incident.",
        "Prioritize actions that restore service first and then address cost variance."
      ]
    };

    const nextSteps = fallbackByArea[focusArea]
      .map((step, index) => `${index + 1}. ${step}`)
      .join("\n");

    return [
      `Built-in MaintainPro guidance for ${focusArea.toLowerCase()} operations:`,
      nextSteps,
      `Original request: ${normalizedMessage}`
    ].join("\n\n");
  }

  private buildProjectAwareMessage(focusArea: CopilotFocusArea, message: string) {
    const trimmedMessage = message.trim();

    const contextByArea: Record<CopilotFocusArea, string> = {
      GENERAL:
        "You are MaintainPro's operations copilot. Provide concise, practical guidance for asset, fleet, maintenance, utilities, and cleaning workflows.",
      MAINTENANCE:
        "You are MaintainPro's maintenance copilot. Prioritize preventive maintenance planning, work orders, downtime reduction, and technician coordination.",
      FLEET:
        "You are MaintainPro's fleet copilot. Focus on vehicle utilization, dispatching, live operations, driver coordination, and breakdown response.",
      CLEANING:
        "You are MaintainPro's cleaning operations copilot. Focus on visit compliance, QR scan workflows, supervisor sign-off, and facility issue handling.",
      INVENTORY:
        "You are MaintainPro's inventory copilot. Focus on stock levels, reorder risk, supplier planning, and spare part availability.",
      UTILITIES:
        "You are MaintainPro's utilities copilot. Focus on consumption trends, anomaly detection, outages, and cost control."
    };

    return `${contextByArea[focusArea]}\n\nUser request:\n${trimmedMessage}`;
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

  private findFirstString(value: unknown, priorityKeys: string[], seen = new Set<unknown>()): string | null {
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
