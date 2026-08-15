import { ServiceUnavailableException } from "@nestjs/common";

import { NotificationsService } from "../src/modules/notifications/notifications.service";

describe("MP-005: notification enqueue safety", () => {
  function buildService(opts: {
    queueOperational: boolean;
    queueAdd: jest.Mock;
    emailDispatch: jest.Mock;
  }) {
    const service = Object.create(NotificationsService.prototype) as any;
    service.queueHealthService = {
      isQueueOperational: jest.fn().mockReturnValue(opts.queueOperational),
      markQueueProcessorFailure: jest.fn()
    };
    service.notificationsQueue = { add: opts.queueAdd };
    service.emailDispatchService = { dispatch: opts.emailDispatch };
    service.smsDispatchService = { dispatch: jest.fn() };
    service.pushDispatchService = { dispatch: jest.fn() };
    service.logger = { warn: jest.fn(), error: jest.fn(), log: jest.fn() };
    return service as {
      enqueueSend: (payload: {
        channel: string;
        userId: string;
        message: string;
        notificationId?: string;
      }) => Promise<void>;
    };
  }

  it("queue success: enqueues with per-channel jobId when notificationId present", async () => {
    const queueAdd = jest.fn().mockResolvedValue({ id: "job-1" });
    const emailDispatch = jest.fn();
    const service = buildService({ queueOperational: true, queueAdd, emailDispatch });

    await service.enqueueSend({
      channel: "EMAIL",
      userId: "u1",
      message: "hello",
      notificationId: "n-1"
    });

    expect(queueAdd).toHaveBeenCalledWith(
      "send",
      expect.objectContaining({ notificationId: "n-1", channel: "EMAIL" }),
      expect.objectContaining({ jobId: "notification:n-1:EMAIL", attempts: 3 })
    );
    expect(emailDispatch).not.toHaveBeenCalled();
  });

  it("queue definitive failure: falls back to direct dispatch", async () => {
    const emailDispatch = jest.fn().mockResolvedValue(undefined);
    const service = buildService({
      queueOperational: true,
      queueAdd: jest.fn().mockRejectedValue(new Error("Connection is closed")),
      emailDispatch
    });

    await service.enqueueSend({
      channel: "EMAIL",
      userId: "u1",
      message: "hello",
      notificationId: "n-def"
    });

    expect(emailDispatch).toHaveBeenCalledTimes(1);
  });

  it("ambiguous enqueue failure with notificationId: no direct send, throws", async () => {
    const emailDispatch = jest.fn();
    const service = buildService({
      queueOperational: true,
      queueAdd: jest.fn().mockRejectedValue(new Error("Command timed out")),
      emailDispatch
    });

    await expect(
      service.enqueueSend({
        channel: "EMAIL",
        userId: "u1",
        message: "hello",
        notificationId: "n-1"
      })
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(emailDispatch).not.toHaveBeenCalled();
  });

  it("ambiguous enqueue failure without notificationId: no direct send, throws", async () => {
    const emailDispatch = jest.fn();
    const service = buildService({
      queueOperational: true,
      queueAdd: jest.fn().mockRejectedValue(new Error("ETIMEDOUT")),
      emailDispatch
    });

    await expect(
      service.enqueueSend({
        channel: "EMAIL",
        userId: "u1",
        message: "hello"
      })
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(emailDispatch).not.toHaveBeenCalled();
  });

  it("duplicate Bull jobId: skip second send (worker retry / re-enqueue)", async () => {
    const emailDispatch = jest.fn();
    const service = buildService({
      queueOperational: true,
      queueAdd: jest.fn().mockRejectedValue(new Error("Job notification:n-2:EMAIL already exists")),
      emailDispatch
    });

    await service.enqueueSend({
      channel: "EMAIL",
      userId: "u1",
      message: "hello",
      notificationId: "n-2"
    });

    expect(emailDispatch).not.toHaveBeenCalled();
  });

  it("queue known non-operational: direct fallback once", async () => {
    const emailDispatch = jest.fn().mockResolvedValue(undefined);
    const service = buildService({
      queueOperational: false,
      queueAdd: jest.fn(),
      emailDispatch
    });

    await service.enqueueSend({
      channel: "EMAIL",
      userId: "u1",
      message: "hello",
      notificationId: "n-3"
    });

    expect(emailDispatch).toHaveBeenCalledTimes(1);
  });

  it("uses distinct jobIds per channel for the same notificationId", async () => {
    const queueAdd = jest.fn().mockResolvedValue({});
    const service = buildService({
      queueOperational: true,
      queueAdd,
      emailDispatch: jest.fn()
    });

    await service.enqueueSend({
      channel: "EMAIL",
      userId: "u1",
      message: "hello",
      notificationId: "n-shared"
    });
    await service.enqueueSend({
      channel: "SMS",
      userId: "u1",
      message: "hello",
      notificationId: "n-shared"
    });

    expect(queueAdd.mock.calls[0][2].jobId).toBe("notification:n-shared:EMAIL");
    expect(queueAdd.mock.calls[1][2].jobId).toBe("notification:n-shared:SMS");
  });
});
