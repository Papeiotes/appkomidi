import cors from "cors";
import express from "express";
import { errorHandler, wrap } from "./http";
import { prisma } from "./prisma";
import { accountRouter } from "./routes/account";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { bookingsRouter } from "./routes/bookings";
import { driverRouter } from "./routes/driver";
import { geoRouter } from "./routes/geo";
import { officeRouter } from "./routes/office";

export function createApp() {
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.get(
    "/health",
    wrap(async (_req, res) => {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, service: "apokomidi-api" });
    }),
  );
  app.use(authRouter);
  app.use(accountRouter);
  app.use(bookingsRouter);
  app.use(driverRouter);
  app.use(officeRouter);
  app.use(adminRouter);
  app.use(geoRouter);
  app.use(errorHandler);
  return app;
}
