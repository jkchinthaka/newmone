import ExcelJS from "exceljs";
import { Worker } from "bullmq";
import PDFDocument from "pdfkit";

import { logger } from "../../config/logger";
import { redis } from "../../config/redis";
import { ReportJobPayload } from "../queue";

const buildExcelBuffer = async (payload: ReportJobPayload): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Report");

  worksheet.columns = [
    { header: "Field", key: "field", width: 24 },
    { header: "Value", key: "value", width: 50 }
  ];

  worksheet.addRows([
    { field: "Report Type", value: payload.reportType },
    { field: "Requested By", value: payload.requestedBy },
    { field: "From", value: payload.dateRange.from },
    { field: "To", value: payload.dateRange.to },
    { field: "Generated At", value: new Date().toISOString() }
  ]);

  const output = await workbook.xlsx.writeBuffer();

  return Buffer.isBuffer(output) ? output : Buffer.from(output);
};

const buildPdfBuffer = async (payload: ReportJobPayload): Promise<Buffer> => {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const document = new PDFDocument({ margin: 32 });

    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    document.fontSize(18).text("MaintainPro Report", { underline: true });
    document.moveDown();
    document.fontSize(12).text(`Report Type: ${payload.reportType}`);
    document.text(`Requested By: ${payload.requestedBy}`);
    document.text(`Date Range: ${payload.dateRange.from} to ${payload.dateRange.to}`);
    document.text(`Generated At: ${new Date().toISOString()}`);
    document.end();
  });
};

export const startReportWorker = (): Worker<ReportJobPayload> => {
  const worker = new Worker<ReportJobPayload>(
    "reports",
    async (job) => {
      const excelBuffer = await buildExcelBuffer(job.data);
      const pdfBuffer = await buildPdfBuffer(job.data);

      logger.info(
        `Report generated for job ${job.id}: excel=${excelBuffer.byteLength} bytes, pdf=${pdfBuffer.byteLength} bytes`
      );

      return {
        excelBytes: excelBuffer.byteLength,
        pdfBytes: pdfBuffer.byteLength
      };
    },
    { connection: redis }
  );

  worker.on("failed", (job, error) => {
    logger.error(`Report job failed: ${job?.id} - ${error.message}`);
  });

  return worker;
};
