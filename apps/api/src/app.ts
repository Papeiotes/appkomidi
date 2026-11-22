import cors from "cors";
import express from "express";
import { errorHandler, wrap } from "./http";
import { prisma } from "./prisma";
import { accountRouter } from "./routes/account";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { businessRouter } from "./routes/business";
import { driverRouter } from "./routes/driver";
import { geoRouter } from "./routes/geo";
import { ridesRouter } from "./routes/rides";

export function createApp() {
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.get(
    "/health",
    wrap(async (_req, res) => {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, service: "vardia-api" });
    }),
  );
  app.use(authRouter);
  app.use(accountRouter);
  app.use(businessRouter);
  app.use(ridesRouter);
  app.use(driverRouter);
  app.use(adminRouter);
  app.use(geoRouter);
  app.use(errorHandler);
  return app;
}
