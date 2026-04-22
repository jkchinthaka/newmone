import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import QRCode from "qrcode";

type QrRenderOptions = {
  errorCorrectionLevel?: QRCode.QRCodeErrorCorrectionLevel;
  margin?: number;
  scale?: number;
};

@Injectable()
export class QrCodeService {
  private readonly logger = new Logger(QrCodeService.name);

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  async toBuffer(value: string, options: QrRenderOptions = {}) {
    const normalizedValue = value.trim();
    const fallbackOptions = this.buildLocalOptions(options);
    const apiKey = this.configService.get<string>("RAPIDAPI_QR_CODE_API_KEY")?.trim();

    if (!normalizedValue) {
      throw new Error("QR code value is required");
    }

    if (!apiKey) {
      return QRCode.toBuffer(normalizedValue, fallbackOptions);
    }

    const host =
      this.configService.get<string>("RAPIDAPI_QR_CODE_HOST")?.trim() ||
      "simple-qr-code-generator-cheap-and-efficient.p.rapidapi.com";

    try {
      const params = new URLSearchParams({
        data: normalizedValue,
        "response-type": "image",
        "file-type": "png",
        scale: String(options.scale ?? 8),
        color: this.configService.get<string>("RAPIDAPI_QR_CODE_COLOR")?.trim() || "#000000",
        "bg-color":
          this.configService.get<string>("RAPIDAPI_QR_CODE_BG_COLOR")?.trim() || "#FFFFFF"
      });

      const response = await fetch(`https://${host}/api/v1/?${params.toString()}`, {
        method: "GET",
        headers: {
          "x-rapidapi-key": apiKey,
          "x-rapidapi-host": host,
          "Content-Type": "application/json"
        },
        signal: AbortSignal.timeout(15_000)
      });

      if (!response.ok) {
        const reason = await response.text();
        this.logger.warn(
          `RapidAPI QR provider returned ${response.status}; falling back to local QR generation: ${reason}`
        );
        return QRCode.toBuffer(normalizedValue, fallbackOptions);
      }

      const contentType = response.headers.get("content-type")?.toLowerCase() || "";
      if (contentType && !contentType.startsWith("image/")) {
        const reason = await response.text();
        this.logger.warn(
          `RapidAPI QR provider returned non-image content; falling back to local QR generation: ${reason}`
        );
        return QRCode.toBuffer(normalizedValue, fallbackOptions);
      }

      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown QR provider error";
      this.logger.warn(
        `RapidAPI QR request failed; falling back to local QR generation: ${message}`
      );
      return QRCode.toBuffer(normalizedValue, fallbackOptions);
    }
  }

  async toDataUrl(value: string, options: QrRenderOptions = {}) {
    const buffer = await this.toBuffer(value, options);
    return `data:image/png;base64,${buffer.toString("base64")}`;
  }

  private buildLocalOptions(options: QrRenderOptions) {
    return {
      errorCorrectionLevel: options.errorCorrectionLevel ?? "H",
      margin: options.margin ?? 1,
      scale: options.scale ?? 8,
      type: "png" as const
    };
  }
}
