import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createSession } from "@/lib/auth/session";
import { createOnboardingSession } from "@/lib/auth/session";

type GoogleUserInfo = {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  picture: string;
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL("/login?error=google_denied", request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/login?error=google_invalid", request.url)
    );
  }

  // Validate CSRF state
  const cookieStore = await cookies();
  const storedState = cookieStore.get("oauth_state")?.value;
  cookieStore.delete("oauth_state");

  if (state !== storedState) {
    return NextResponse.redirect(
      new URL("/login?error=google_invalid", request.url)
    );
  }

  // Exchange code for tokens
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(
      new URL("/login?error=google_token", request.url)
    );
  }

  const tokenData = await tokenRes.json();

  // Fetch user info
  const userInfoRes = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    }
  );

  if (!userInfoRes.ok) {
    return NextResponse.redirect(
      new URL("/login?error=google_userinfo", request.url)
    );
  }

  const googleUser: GoogleUserInfo = await userInfoRes.json();

  // Check if user exists by googleId
  const existingByGoogleId = await db.query.users.findFirst({
    where: eq(users.googleId, googleUser.id),
  });

  if (existingByGoogleId) {
    await createSession(existingByGoogleId.id, existingByGoogleId.username);
    return NextResponse.redirect(new URL("/feed", request.url));
  }

  // Check if user exists by email
  const existingByEmail = await db.query.users.findFirst({
    where: eq(users.email, googleUser.email),
  });

  if (existingByEmail) {
    // Link Google account to existing user
    await db
      .update(users)
      .set({
        googleId: googleUser.id,
        emailVerified: true,
        avatarUrl: existingByEmail.avatarUrl || googleUser.picture,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingByEmail.id));

    await createSession(existingByEmail.id, existingByEmail.username);
    return NextResponse.redirect(new URL("/feed", request.url));
  }

  // New user — send to onboarding
  await createOnboardingSession(googleUser.email, "google", googleUser.id);
  return NextResponse.redirect(new URL("/onboarding", request.url));
}
