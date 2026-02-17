import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { users, verificationTokens } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { createSession, createOnboardingSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(
      new URL("/login?error=invalid_token", request.url)
    );
  }

  // Look up token and check expiry
  const verificationToken = await db.query.verificationTokens.findFirst({
    where: and(
      eq(verificationTokens.token, token),
      gt(verificationTokens.expiresAt, new Date())
    ),
  });

  if (!verificationToken) {
    return NextResponse.redirect(
      new URL("/login?error=expired_token", request.url)
    );
  }

  const email = verificationToken.email;

  // Delete used token
  await db
    .delete(verificationTokens)
    .where(eq(verificationTokens.id, verificationToken.id));

  // Check if user with this email exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existingUser) {
    // Mark email as verified
    if (!existingUser.emailVerified) {
      await db
        .update(users)
        .set({ emailVerified: true, updatedAt: new Date() })
        .where(eq(users.id, existingUser.id));
    }

    await createSession(existingUser.id, existingUser.username);
    return NextResponse.redirect(new URL("/feed", request.url));
  }

  // New user — send to onboarding
  await createOnboardingSession(email, "email");
  return NextResponse.redirect(new URL("/onboarding", request.url));
}
