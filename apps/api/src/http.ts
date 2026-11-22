import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { BookingError } from "@vardia/shared";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
    this.name = "HttpError";
  }
}

export function wrap(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code } });
    return;
  }
  if (err instanceof BookingError) {
    const status = err.code.endsWith("NOT_FOUND") ? 404 : 409;
    res.status(status).json({ error: { code: err.code } });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: { code: "BAD_INPUT" } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: "REQUEST_FAILED" } });
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
