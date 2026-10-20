import path from "node:path";

export const authDir = path.join(process.env.TEMP || process.env.TMP || ".", "mp-save-gaps-auth");
