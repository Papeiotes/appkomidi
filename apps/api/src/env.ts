export const env = {
  databaseUrl:
    process.env.DATABASE_URL ?? "postgresql://vardia:vardia@localhost:5432/vardia?schema=public",
  jwtSecret: process.env.JWT_SECRET ?? "dev-vardia-change-me",
  port: Number(process.env.PORT ?? 4107),
  nominatimUrl: (process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org").replace(/\/$/, ""),
  osrmUrl: (process.env.OSRM_URL ?? "https://router.project-osrm.org").replace(/\/$/, ""),
  adminUsername: (process.env.ADMIN_USERNAME ?? "admin").toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD ?? "Dimarcheio!2026",
  adminName: process.env.ADMIN_NAME ?? "Διαχειριστής",
  municipalityName: process.env.MUNICIPALITY_NAME ?? "Δήμος",
  overflowKg: Number(process.env.OVERFLOW_KG ?? 75),
  nodeEnv: process.env.NODE_ENV ?? "development",
};
