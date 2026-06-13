import { EmailDispatchService } from "../src/modules/notifications/email-dispatch.service";
import { NotificationReadinessService } from "../src/modules/notifications/notification-readiness.service";
import { NotificationTemplatesService } from "../src/modules/notifications/notification-templates.service";
import { SmsDispatchService } from "../src/modules/notifications/sms-dispatch.service";

const configService = (values: Record<string, unknown>) =>
  ({
    get: jest.fn((key: string, fallback?: unknown) =>
      Object.prototype.hasOwnProperty.call(values, key) ? values[key] : fallback
    )
  }) as never;

describe("NotificationReadinessService", () => {
  it("reports disabled email and sms without crashing when config is missing", () => {
    const service = new NotificationReadinessService(
      configService({ EMAIL_MODE: "disabled", SMS_MODE: "disabled" }),
      new EmailDispatchService(configService({ EMAIL_MODE: "disabled" }), {} as never),
      new SmsDispatchService(configService({ SMS_MODE: "disabled" }), {} as never)
    );

    const summary = service.getSummary();
    expect(summary.email.state).toBe("disabled");
    expect(summary.sms.state).toBe("disabled");
    expect(summary.overallState).toBe("disabled");
    expect(summary.uat.uatEnabled).toBe(false);
  });

  it("detects not_configured and misconfigured live email states", () => {
    const missingAll = new NotificationReadinessService(
      configService({ EMAIL_MODE: "live", SMS_MODE: "disabled" }),
      new EmailDispatchService(configService({ EMAIL_MODE: "live" }), {} as never),
      new SmsDispatchService(configService({ SMS_MODE: "disabled" }), {} as never)
    );
    expect(missingAll.getSummary().email.state).toBe("not_configured");

    const partial = new NotificationReadinessService(
      configService({
        EMAIL_MODE: "live",
        SMS_MODE: "disabled",
        SMTP_HOST: "smtp.example.com",
        SMTP_PORT: 587
      }),
      new EmailDispatchService(
        configService({
          EMAIL_MODE: "live",
          SMTP_HOST: "smtp.example.com",
          SMTP_PORT: 587
        }),
        {} as never
      ),
      new SmsDispatchService(configService({ SMS_MODE: "disabled" }), {} as never)
    );
    expect(partial.getSummary().email.state).toBe("misconfigured");
  });
});

describe("NotificationTemplatesService", () => {
  const templates = new NotificationTemplatesService();

  it("renders production templates without leaking secret-like content", () => {
    const rendered = templates.renderInvitationCreated({
      inviteeEmail: "user@example.com",
      tenantName: "Example Tenant",
      roleName: "ADMIN",
      actionUrl: "https://app.example.com/register"
    });

    expect(rendered.subject).toContain("invited");
    expect(templates.templateContainsSecrets(rendered)).toBe(false);
    expect(rendered.textBody).not.toMatch(/smtp_pass|api_key|secret/i);
  });
});
