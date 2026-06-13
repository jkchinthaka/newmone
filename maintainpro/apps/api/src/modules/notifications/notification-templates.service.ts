import { Injectable } from "@nestjs/common";

export type NotificationTemplateResult = {
  templateId: string;
  subject: string;
  textBody: string;
  htmlBody: string;
};

export type CriticalFacilityIssueTemplateInput = {
  issueTitle: string;
  severity: string;
  roomName?: string | null;
  slaTargetAt?: string | null;
  actionUrl: string;
};

export type WorkOrderFromIssueTemplateInput = {
  issueTitle: string;
  workOrderNumber: string;
  assigneeName?: string | null;
  actionUrl: string;
};

export type OverdueSlaAlertTemplateInput = {
  itemLabel: string;
  itemType: "facility_issue" | "work_order";
  dueAt: string;
  actionUrl: string;
};

export type InvitationCreatedTemplateInput = {
  inviteeEmail: string;
  tenantName: string;
  roleName: string;
  actionUrl: string;
};

const SECRET_PATTERN = /(password|secret|token|api[_-]?key|smtp_pass|authorization)/i;

@Injectable()
export class NotificationTemplatesService {
  renderCriticalFacilityIssue(input: CriticalFacilityIssueTemplateInput): NotificationTemplateResult {
    const roomLine = input.roomName ? `Location: ${input.roomName}` : "Location: Unassigned";
    const slaLine = input.slaTargetAt ? `SLA target: ${input.slaTargetAt}` : "SLA target: Not set";
    const subject = `[Critical] Facility issue: ${input.issueTitle}`;
    const textBody = [
      "A critical facility issue requires attention.",
      `Issue: ${input.issueTitle}`,
      `Severity: ${input.severity}`,
      roomLine,
      slaLine,
      `Review: ${input.actionUrl}`
    ].join("\n");

    return this.buildTemplate("critical_facility_issue", subject, textBody);
  }

  renderWorkOrderFromIssue(input: WorkOrderFromIssueTemplateInput): NotificationTemplateResult {
    const assigneeLine = input.assigneeName
      ? `Assigned to: ${input.assigneeName}`
      : "Assigned to: Unassigned";
    const subject = `Work order ${input.workOrderNumber} created from facility issue`;
    const textBody = [
      "A work order was created from a facility issue.",
      `Issue: ${input.issueTitle}`,
      `Work order: ${input.workOrderNumber}`,
      assigneeLine,
      `Open work order: ${input.actionUrl}`
    ].join("\n");

    return this.buildTemplate("work_order_from_issue", subject, textBody);
  }

  renderOverdueSlaAlert(input: OverdueSlaAlertTemplateInput): NotificationTemplateResult {
    const subject = `[Overdue] ${input.itemType === "facility_issue" ? "Facility issue" : "Work order"}: ${input.itemLabel}`;
    const textBody = [
      "An SLA deadline has passed.",
      `Item: ${input.itemLabel}`,
      `Type: ${input.itemType}`,
      `Due: ${input.dueAt}`,
      `Review: ${input.actionUrl}`
    ].join("\n");

    return this.buildTemplate("overdue_sla_alert", subject, textBody);
  }

  renderInvitationCreated(input: InvitationCreatedTemplateInput): NotificationTemplateResult {
    const subject = `You're invited to ${input.tenantName} on MaintainPro`;
    const textBody = [
      "An onboarding invitation has been created.",
      `Tenant: ${input.tenantName}`,
      `Role: ${input.roleName}`,
      `Invitee: ${input.inviteeEmail}`,
      `Accept invitation: ${input.actionUrl}`
    ].join("\n");

    return this.buildTemplate("invitation_created", subject, textBody);
  }

  templateContainsSecrets(template: NotificationTemplateResult): boolean {
    const combined = `${template.subject}\n${template.textBody}\n${template.htmlBody}`;
    return SECRET_PATTERN.test(combined);
  }

  private buildTemplate(templateId: string, subject: string, textBody: string): NotificationTemplateResult {
    const htmlBody = textBody
      .split("\n")
      .map((line) => `<p>${this.escapeHtml(line)}</p>`)
      .join("");

    return {
      templateId,
      subject,
      textBody,
      htmlBody
    };
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}
