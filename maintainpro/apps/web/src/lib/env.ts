import { z } from "zod";

const envSchema = z.object({
  VITE_API_BASE_URL: z.string().url().default("http://localhost:3000/api/v1"),
  VITE_FIREBASE_API_KEY: z.string().default(""),
  VITE_FIREBASE_AUTH_DOMAIN: z.string().default(""),
  VITE_FIREBASE_PROJECT_ID: z.string().default(""),
  VITE_FIREBASE_STORAGE_BUCKET: z.string().default(""),
  VITE_FIREBASE_MESSAGING_SENDER_ID: z.string().default(""),
  VITE_FIREBASE_APP_ID: z.string().default("")
});

export const webEnv = envSchema.parse(import.meta.env);
