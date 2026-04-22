import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException
} from "@nestjs/common";
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
      throw new ServiceUnavailableException(
        "Predictive AI assistant is not configured for this environment"
      );
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
        this.logger.warn(`Copilot upstream returned ${response.status}: ${responseText}`);
        throw new BadGatewayException(this.extractErrorMessage(parsedBody, responseText));
      }
    } catch (error) {
      if (error instanceof BadGatewayException || error instanceof ServiceUnavailableException) {
        throw error;
      }

      this.logger.error("RapidAPI Copilot request failed", error as Error);
      throw new BadGatewayException("Predictive AI assistant request failed");
    }

    return {
      request: {
        conversationId: dto.conversationId ?? null,
        focusArea: dto.focusArea ?? "GENERAL",
        mode: dto.mode ?? "CHAT",
        markdown: dto.markdown ?? true,
        message: dto.message
      },
      response: {
        conversationId: this.extractConversationId(parsedBody),
        text: this.extractAssistantText(parsedBody, responseText),
        raw: parsedBody
      }
    };
  }

  logs() {
    return this.prisma.predictiveLog.findMany({
      include: {
        asset: true
      },
      orderBy: { analyzedAt: "desc" }
    });
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
      const found = this.findFirstString(entry, priorityKeys, seen);
      if (found) {
        return found;
      }
    }

    return null;
  }
}
