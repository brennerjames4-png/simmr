// Hardcoded credentials for MVP - will be replaced with proper auth (BetterAuth/NextAuth)
export const ADMIN_CREDENTIALS = {
  username: "admin",
  password: "admin",
} as const;

export const AUTH_COOKIE_NAME = "simmr-session";
export const AUTH_SECRET =
  process.env.AUTH_SECRET || "simmr-dev-secret-change-in-production";
