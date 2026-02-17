import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import {
  AUTH_COOKIE_NAME,
  ONBOARDING_COOKIE_NAME,
  AUTH_SECRET,
} from "./constants";

const secret = new TextEncoder().encode(AUTH_SECRET);

export async function createSession(userId: string, username: string) {
  const token = await new SignJWT({ userId, username })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
}

export async function createOnboardingSession(
  email: string,
  provider: "google" | "email",
  googleId?: string
) {
  const token = await new SignJWT({ email, provider, googleId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(secret);

  const cookieStore = await cookies();
  cookieStore.set(ONBOARDING_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60, // 1 hour
    path: "/",
  });
}

export async function getOnboardingSession(): Promise<{
  email: string;
  provider: "google" | "email";
  googleId?: string;
} | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ONBOARDING_COOKIE_NAME)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, secret);
    return {
      email: payload.email as string,
      provider: payload.provider as "google" | "email",
      googleId: payload.googleId as string | undefined,
    };
  } catch {
    return null;
  }
}

export async function clearOnboardingSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ONBOARDING_COOKIE_NAME);
}
