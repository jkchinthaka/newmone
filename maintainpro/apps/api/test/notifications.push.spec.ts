import { BadRequestException } from "@nestjs/common";

import { NotificationsService } from "../src/modules/notifications/notifications.service";

describe("NotificationsService push readiness", () => {
  let pushDispatchService: {
    getRegisteredDevices: jest.Mock;
    describeProviders: jest.Mock;
    maskDevices: jest.Mock;
  };
  let service: NotificationsService;

  beforeEach(() => {
    pushDispatchService = {
      getRegisteredDevices: jest.fn(),
      describeProviders: jest.fn().mockReturnValue([
        { key: "noop", label: "Noop", configured: false }
      ]),
      maskDevices: jest.fn((devices) =>
        devices.map((device: { installationId: string }) => ({
          ...device,
          token: `masked:${device.installationId}`
        }))
      )
    };

    service = new NotificationsService(
      {} as never,
      {} as never,
      { add: jest.fn() } as never,
      pushDispatchService as never
    );

    jest.spyOn(service as any, "getPreferences").mockResolvedValue({
      inApp: true,
      email: true,
      sms: false,
      whatsapp: false,
      push: true
    });
    jest.spyOn(service as any, "setUserSetting").mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("reports push readiness when devices are registered", async () => {
    pushDispatchService.getRegisteredDevices.mockResolvedValue([
      {
        installationId: "install-1",
        token: "token-1",
        provider: "FCM",
        platform: "android",
        createdAt: "2026-05-01T00:00:00.000Z",
        lastSeenAt: "2026-05-01T00:00:00.000Z"
      }
    ]);

    const result = await service.getPushReadiness("user-1");

    expect(result).toMatchObject({
      enabled: true,
      ready: true,
      deviceCount: 1
    });
    expect(pushDispatchService.maskDevices).toHaveBeenCalledTimes(1);
  });

  it("replaces duplicate installations and normalizes provider names on registration", async () => {
    pushDispatchService.getRegisteredDevices.mockResolvedValue([
      {
        installationId: "install-1",
        token: "old-token",
        provider: "FCM",
        platform: "android",
        createdAt: "2026-05-01T00:00:00.000Z",
        lastSeenAt: "2026-05-01T00:00:00.000Z"
      }
    ]);

    const result = await service.registerPushDevice("user-1", {
      installationId: "install-1",
      token: "new-token",
      provider: "apns",
      platform: "ios",
      appVersion: "1.2.0"
    });

    expect((service as any).setUserSetting).toHaveBeenCalledWith(
      "user-1",
      "notifications.push.devices",
      expect.arrayContaining([
        expect.objectContaining({
          installationId: "install-1",
          token: "new-token",
          provider: "APNS",
          platform: "ios"
        })
      ])
    );
    expect(result).toMatchObject({
      registered: true,
      deviceCount: 1,
      device: expect.objectContaining({
        installationId: "install-1",
        token: "masked:install-1"
      })
    });
  });

  it("rejects blank installation ids", async () => {
    await expect(
      service.registerPushDevice("user-1", {
        installationId: "  ",
        token: "token-1"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});