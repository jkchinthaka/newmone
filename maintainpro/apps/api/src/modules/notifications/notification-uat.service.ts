import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { EmailDispatchService } from "./email-dispatch.service";
import {
  describeNotificationUatControls,
  isNotificationUatTemplateKey,
  isRecipientAllowlisted,
  isValidUatEmailRecipient,
  isValidUatPhoneRecipient,
  maskUatRecipient,
  normalizeUatEmailRecipient,
  normalizeUatPhoneRecipient,
  NotificationUatControlsSummary,
  NotificationUatSendResult,
  NotificationUatTemplateKey,
  parseNotificationUatAllowlist
} from "./notification-uat.mapper";
import { NotificationTemplatesService } from "./notification-templates.service";
import { SmsDispatchService } from "./sms-dispatch.service";

type UatTemplateVariables = Record<string, string | undefined>;

@Injectable()
export class NotificationUatService {
  private readonly logger = new Logger(NotificationUatService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly emailDispatchService: EmailDispatchService,
    private readonly smsDispatchService: SmsDispatchService,
    private readonly notificationTemplatesService: NotificationTemplatesService
  ) {}

  describeControls(): NotificationUatControlsSummary {
    return describeNotificationUatControls({
      uatEnabled: this.isUatEnabled(),
      realSendsEnabled: this.isRealSendsEnabled(),
      allowlist: this.getAllowlist()
    });
  }

  async sendEmailTest(input: {
    recipient: string;
    templateKey: string;
    variables?: Record<string, string>;
  }): Promise<NotificationUatSendResult> {
    const recipient = input.recipient.trim();
    const templateKey = input.templateKey.trim();
    const maskedRecipient = maskUatRecipient(recipient, "email");

    const guardResult = this.guardUatSend("email", recipient, templateKey, maskedRecipient);
    if (guardResult) {
      return guardResult;
    }

    const resolvedTemplateKey = templateKey as NotificationUatTemplateKey;

    if (!isValidUatEmailRecipient(recipient)) {
      return this.result(
        "email",
        "rejected",
        "smtp",
        resolvedTemplateKey,
        maskedRecipient,
        "Recipient must be a valid email address."
      );
    }

    const emailProvider = this.emailDispatchService.describeProvider();
    if (emailProvider.mode === "disabled") {
      return this.result(
        "email",
        "not_configured",
        emailProvider.id,
        resolvedTemplateKey,
        maskedRecipient,
        "Email provider is disabled. Set EMAIL_MODE=live with SMTP settings before UAT email sends."
      );
    }

    if (!emailProvider.configured) {
      return this.result(
        "email",
        "misconfigured",
        emailProvider.id,
        resolvedTemplateKey,
        maskedRecipient,
        "EMAIL_MODE=live but SMTP settings are incomplete."
      );
    }

    const rendered = this.renderTemplate(resolvedTemplateKey, input.variables);
    if (this.notificationTemplatesService.templateContainsSecrets(rendered)) {
      throw new BadRequestException("Rendered template contains disallowed secret-like content.");
    }

    try {
      const delivery = await this.emailDispatchService.sendUatEmail({
        to: normalizeUatEmailRecipient(recipient),
        subject: rendered.subject,
        text: rendered.textBody,
        html: rendered.htmlBody
      });

      this.logger.log(
        `UAT email sent via ${emailProvider.id} to ${maskedRecipient} using template ${resolvedTemplateKey}`
      );

      return {
        channel: "email",
        status: "sent",
        provider: emailProvider.id,
        templateKey: resolvedTemplateKey,
        recipientMasked: maskedRecipient,
        messageId: delivery.messageId,
        sentAt: new Date().toISOString(),
        message: "UAT email accepted by SMTP provider."
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "UAT email send failed";
      this.logger.warn(`UAT email failed for ${maskedRecipient}: ${message}`);
      return this.result(
        "email",
        "misconfigured",
        emailProvider.id,
        resolvedTemplateKey,
        maskedRecipient,
        message
      );
    }
  }

  async sendSmsTest(input: {
    recipient: string;
    templateKey: string;
    variables?: Record<string, string>;
  }): Promise<NotificationUatSendResult> {
    const recipient = input.recipient.trim();
    const templateKey = input.templateKey.trim();
    const maskedRecipient = maskUatRecipient(recipient, "sms");

    const guardResult = this.guardUatSend("sms", recipient, templateKey, maskedRecipient);
    if (guardResult) {
      return guardResult;
    }

    const resolvedTemplateKey = templateKey as NotificationUatTemplateKey;

    if (!isValidUatPhoneRecipient(recipient)) {
      return this.result(
        "sms",
        "rejected",
        "generic-http-sms",
        resolvedTemplateKey,
        maskedRecipient,
        "Recipient must be a valid E.164-style phone number."
      );
    }

    const smsProvider = this.smsDispatchService.describeProvider();
    if (smsProvider.mode === "disabled") {
      return this.result(
        "sms",
        "not_configured",
        smsProvider.id,
        resolvedTemplateKey,
        maskedRecipient,
        "SMS provider is disabled. Set SMS_MODE=live with approved provider settings for real SMS UAT sends."
      );
    }

    const rendered = this.renderTemplate(resolvedTemplateKey, input.variables);
    if (this.notificationTemplatesService.templateContainsSecrets(rendered)) {
      throw new BadRequestException("Rendered template contains disallowed secret-like content.");
    }

    if (smsProvider.mode === "mock") {
      this.logger.warn(`UAT SMS mock send for ${maskedRecipient} using template ${resolvedTemplateKey}`);
      return {
        channel: "sms",
        status: "mock",
        provider: smsProvider.id,
        templateKey: resolvedTemplateKey,
        recipientMasked: maskedRecipient,
        messageId: null,
        sentAt: new Date().toISOString(),
        message: "SMS mock mode accepted the UAT request without calling an external provider."
      };
    }

    if (!smsProvider.configured) {
      return this.result(
        "sms",
        "misconfigured",
        smsProvider.id,
        resolvedTemplateKey,
        maskedRecipient,
        "SMS_MODE=live but provider settings are incomplete."
      );
    }

    try {
      const delivery = await this.smsDispatchService.sendUatSms({
        to: normalizeUatPhoneRecipient(recipient),
        message: rendered.textBody
      });

      this.logger.log(
        `UAT SMS sent via ${smsProvider.id} to ${maskedRecipient} using template ${resolvedTemplateKey}`
      );

      return {
        channel: "sms",
        status: "sent",
        provider: smsProvider.id,
        templateKey: resolvedTemplateKey,
        recipientMasked: maskedRecipient,
        messageId: delivery.messageId,
        sentAt: new Date().toISOString(),
        message: "UAT SMS accepted by configured provider."
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "UAT SMS send failed";
      this.logger.warn(`UAT SMS failed for ${maskedRecipient}: ${message}`);
      return this.result(
        "sms",
        "misconfigured",
        smsProvider.id,
        resolvedTemplateKey,
        maskedRecipient,
        message
      );
    }
  }

  private guardUatSend(
    channel: "email" | "sms",
    recipient: string,
    templateKey: string,
    maskedRecipient: string
  ): NotificationUatSendResult | null {
    const provider = channel === "email" ? "smtp" : "generic-http-sms";

    if (!this.isUatEnabled()) {
      return this.result(
        channel,
        "blocked",
        provider,
        templateKey,
        maskedRecipient,
        "Notification UAT is disabled. Set NOTIFICATION_UAT_ENABLED=true."
      );
    }

    if (!this.isRealSendsEnabled()) {
      return this.result(
        channel,
        "blocked",
        provider,
        templateKey,
        maskedRecipient,
        "Real notification UAT sends are disabled. Set NOTIFICATION_REAL_SENDS_ENABLED=true."
      );
    }

    if (!isNotificationUatTemplateKey(templateKey)) {
      return this.result(
        channel,
        "rejected",
        provider,
        templateKey,
        maskedRecipient,
        "Unsupported notification template key."
      );
    }

    const allowlist = this.getAllowlist();
    if (!isRecipientAllowlisted(recipient, allowlist, channel)) {
      return this.result(
        channel,
        "rejected",
        provider,
        templateKey,
        maskedRecipient,
        "Recipient is not in NOTIFICATION_UAT_ALLOWED_RECIPIENTS."
      );
    }

    return null;
  }

  private renderTemplate(templateKey: NotificationUatTemplateKey, variables?: UatTemplateVariables) {
    const frontendUrl = this.configService.get<string>("FRONTEND_URL", "http://localhost:3001");
    const actionUrl = variables?.actionUrl ?? `${frontendUrl}/action-center`;

    switch (templateKey) {
      case "critical_facility_issue":
        return this.notificationTemplatesService.renderCriticalFacilityIssue({
          issueTitle: variables?.issueTitle ?? "Restroom leak near lobby",
          severity: variables?.severity ?? "CRITICAL",
          roomName: variables?.roomName ?? "Lobby restroom",
          slaTargetAt: variables?.slaTargetAt ?? new Date().toISOString(),
          actionUrl
        });
      case "work_order_from_issue":
        return this.notificationTemplatesService.renderWorkOrderFromIssue({
          issueTitle: variables?.issueTitle ?? "Restroom leak near lobby",
          workOrderNumber: variables?.workOrderNumber ?? "WO-2026-0001",
          assigneeName: variables?.assigneeName ?? "Maintenance team",
          actionUrl: variables?.actionUrl ?? `${frontendUrl}/work-orders`
        });
      case "overdue_sla_alert":
        return this.notificationTemplatesService.renderOverdueSlaAlert({
          itemLabel: variables?.itemLabel ?? "Restroom leak near lobby",
          itemType: (variables?.itemType as "facility_issue" | "work_order" | undefined) ?? "facility_issue",
          dueAt: variables?.dueAt ?? new Date().toISOString(),
          actionUrl: variables?.actionUrl ?? `${frontendUrl}/facilities/reports/aging`
        });
      case "invitation_created":
        return this.notificationTemplatesService.renderInvitationCreated({
          inviteeEmail: variables?.inviteeEmail ?? "user@example.com",
          tenantName: variables?.tenantName ?? "Example Tenant",
          roleName: variables?.roleName ?? "FACILITY_MANAGER",
          actionUrl: variables?.actionUrl ?? `${frontendUrl}/register`
        });
      default:
        throw new BadRequestException("Unsupported notification template key.");
    }
  }

  private result(
    channel: "email" | "sms",
    status: NotificationUatSendResult["status"],
    provider: string,
    templateKey: string,
    recipientMasked: string,
    message: string
  ): NotificationUatSendResult {
    return {
      channel,
      status,
      provider,
      templateKey,
      recipientMasked,
      messageId: null,
      sentAt: null,
      message
    };
  }

  private isUatEnabled(): boolean {
    return this.configService.get<boolean>("NOTIFICATION_UAT_ENABLED", false);
  }

  private isRealSendsEnabled(): boolean {
    return this.configService.get<boolean>("NOTIFICATION_REAL_SENDS_ENABLED", false);
  }

  private getAllowlist(): string[] {
    return parseNotificationUatAllowlist(
      this.configService.get<string>("NOTIFICATION_UAT_ALLOWED_RECIPIENTS", "")
    );
  }
}
