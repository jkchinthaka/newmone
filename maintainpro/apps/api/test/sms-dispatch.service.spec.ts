import { SmsDispatchService } from "../src/modules/notifications/sms-dispatch.service";

const configService = (values: Record<string, unknown>) => ({
  get: jest.fn((key: string, fallback?: unknown) => (key in values ? values[key] : fallback))
});

describe("SmsDispatchService", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("sends SMS through the configured HTTP provider", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue("{}")
    }) as never;

    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ phone: "+15555550123" }) },
      notification: { update: jest.fn().mockResolvedValue({ id: "notif-1" }) }
    };

    const service = new SmsDispatchService(
      configService({
        SMS_ENABLED: true,
        SMS_API_URL: "https://sms.example.com/send",
        SMS_API_KEY: "sms-key",
        SMS_AUTH_HEADER: "X-Api-Key",
        SMS_SENDER_ID: "MaintainPro"
      }) as never,
      prisma as never
    );

    const result = await service.dispatch({
      userId: "user-1",
      message: "Gate event recorded",
      notificationId: "notif-1"
    });

    expect(result).toMatchObject({ attempted: 1, delivered: 1, skipped: 0, mode: "active" });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://sms.example.com/send",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-Api-Key": "sms-key" })
      })
    );
  });

  it("skips delivery when SMS is disabled", async () => {
    global.fetch = jest.fn() as never;
    const service = new SmsDispatchService(
      configService({ SMS_ENABLED: false }) as never,
      { user: { findUnique: jest.fn() }, notification: { update: jest.fn() } } as never
    );

    const result = await service.dispatch({ userId: "user-1", message: "Ignored" });

    expect(result).toMatchObject({ attempted: 0, delivered: 0, skipped: 1, mode: "noop" });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});