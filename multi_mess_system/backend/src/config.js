import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || "change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  superAdminName: process.env.SUPER_ADMIN_NAME || "Super Admin",
  superAdminEmail: (process.env.SUPER_ADMIN_EMAIL || "super@admin.com").toLowerCase(),
  superAdminPassword: process.env.SUPER_ADMIN_PASSWORD || "superadmin1223",
};

if (!config.databaseUrl) {
  throw new Error("DATABASE_URL is required");
}
