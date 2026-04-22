import { Logger } from "@nestjs/common";

import { QrCodeService } from "../src/common/services/qr-code.service";

describe("QrCodeService", () => {
  let configValues: Record<string, string | undefined>;
  let service: QrCodeService;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    configValues = {};
    originalFetch = global.fetch;

    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

    service = new QrCodeService({
      get: jest.fn((key: string) => configValues[key])
    } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("uses local QR generation when no RapidAPI key is configured", async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;

    const buffer = await service.toBuffer("https://example.com/assets/123");

    expect(global.fetch).not.toHaveBeenCalled();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("uses the RapidAPI provider when configured", async () => {
    configValues.RAPIDAPI_QR_CODE_API_KEY = "test-key";

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: jest.fn().mockReturnValue("image/png")
      },
      arrayBuffer: async () => Uint8Array.from([1, 2, 3, 4]).buffer
    } as unknown as Response) as unknown as typeof fetch;

    const buffer = await service.toBuffer("https://example.com/assets/123");

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(buffer.equals(Buffer.from([1, 2, 3, 4]))).toBe(true);
  });
});
