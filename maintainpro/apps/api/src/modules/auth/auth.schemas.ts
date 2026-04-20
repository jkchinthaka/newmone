import { z } from "zod";

const emptyObjectSchema = z.object({}).default({});

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    fullName: z.string().min(2).max(100),
    password: z.string().min(8).max(128)
  }),
  query: emptyObjectSchema,
  params: emptyObjectSchema
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8).max(128)
  }),
  query: emptyObjectSchema,
  params: emptyObjectSchema
});

export const setupMfaSchema = z.object({
  body: z.object({
    email: z.string().email()
  }),
  query: emptyObjectSchema,
  params: emptyObjectSchema
});

export const verifyMfaSchema = z.object({
  body: z.object({
    email: z.string().email(),
    token: z.string().regex(/^\d{6}$/)
  }),
  query: emptyObjectSchema,
  params: emptyObjectSchema
});
