import nodemailer from "nodemailer";

import { EmailDispatchService } from "../src/modules/notifications/email-dispatch.service";

jest.mock("nodemailer", () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn()
  }
}));

const configService = (values: Record<string, unknown>) => ({
  get: jest.fn((key: string, fallback?: unknown) => (key in values ? values[key] : fallback))
});

describe("EmailDispatchService", () => {
  const createTransport = nodemailer.createTransport as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends SMTP email and marks the notification as sent", async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: "mail-1" });
    createTransport.mockReturnValue({ sendMail });

    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          email: "ops@example.com",
          firstName: "Ops",
          lastName: "User"
        })
      },
      notification: {
        update: jest.fn().mockResolvedValue({ id: "notif-1" })
      }
    };

    const service = new EmailDispatchService(
      configService({
        EMAIL_MODE: "live",
        SMTP_HOST: "smtp.example.com",
        SMTP_PORT: 587,
        SMTP_SECURE: false,
        SMTP_USER: "smtp-user",
        SMTP_PASS: "smtp-pass",
        SMTP_FROM: "MaintainPro Alerts <alerts@example.com>"
      }) as never,
      prisma as never
    );

    const result = await service.dispatch({
      userId: "user-1",
      title: "Alert",
      message: "Service due",
      notificationId: "notif-1"
    });

    expect(result).toMatchObject({ attempted: 1, delivered: 1, skipped: 0, mode: "active" });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "ops@example.com" }));
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: "notif-1" },
      data: { sentAt: expect.any(Date) }
    });
  });

  it("skips delivery when SMTP is disabled", async () => {
    const prisma = {
      user: { findUnique: jest.fn() },
      notification: { update: jest.fn() }
    };
    const service = new EmailDispatchService(
      configService({ SMTP_ENABLED: false }) as never,
      prisma as never
    );

    const result = await service.dispatch({ userId: "user-1", message: "Ignored" });

    expect(result).toMatchObject({ attempted: 0, delivered: 0, skipped: 1, mode: "disabled" });
    expect(createTransport).not.toHaveBeenCalled();
  });
});