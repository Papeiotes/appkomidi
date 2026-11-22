import { createServer } from "http";
import { Server } from "socket.io";
import { createApp } from "./app";
import { env } from "./env";
import { startJobs } from "./jobs";
import { seed } from "./seed";
import { attachSocket } from "./socket";

async function main() {
  await seed();
  const app = createApp();
  const server = createServer(app);
  const io = new Server(server, {
    cors: { origin: env.corsOrigins.length ? env.corsOrigins : true, credentials: true },
  });
  app.set("io", io);
  attachSocket(io);
  startJobs(io);
  server.listen(env.port, "0.0.0.0", () => {
    console.log(`APPkomidi API on http://localhost:${env.port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
