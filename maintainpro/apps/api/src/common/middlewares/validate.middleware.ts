import type { RequestHandler } from "express";
import { z } from "zod";

import { AppError } from "../errors/AppError";

export const validate = <T extends z.ZodTypeAny>(schema: T): RequestHandler => {
  return (req, _res, next) => {
    const parsed = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params
    });

    if (!parsed.success) {
      return next(new AppError(parsed.error.errors.map((item) => item.message).join(", "), 422));
    }

    req.body = parsed.data.body;
    req.query = parsed.data.query;
    req.params = parsed.data.params;

    return next();
  };
};
