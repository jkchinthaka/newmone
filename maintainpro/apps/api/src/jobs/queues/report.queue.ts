import { reportQueue, ReportJobPayload } from "../queue";

export const enqueueReportJob = async (payload: ReportJobPayload): Promise<void> => {
  await reportQueue.add("generate-report", payload, {
    attempts: 2,
    backoff: {
      type: "fixed",
      delay: 1000
    }
  });
};
