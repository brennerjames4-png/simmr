import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import {
  AUTH_COOKIE_NAME,
  ONBOARDING_COOKIE_NAME,
  AUTH_SECRET,
} from "@/lib/auth/constants";

const secret = new TextEncoder().encode(AUTH_SECRET);

const publicPaths = [
  "/login",
  "/api/uploadthing",
  "/api/auth/google",
  "/api/auth/google/callback",
  "/api/auth/email",
  "/api/auth/email/verify",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Onboarding route: requires onboarding cookie, not auth cookie
  if (pathname.startsWith("/onboarding")) {
    // If user is already authenticated, redirect to feed
    const authToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (authToken) {
      try {
        await jwtVerify(authToken, secret);
        return NextResponse.redirect(new URL("/feed", request.url));
      } catch {
        // Invalid auth token, continue to check onboarding
      }
    }

    // Require onboarding cookie
    const onboardingToken = request.cookies.get(ONBOARDING_COOKIE_NAME)?.value;
    if (!onboardingToken) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    try {
      await jwtVerify(onboardingToken, secret);
      return NextResponse.next();
    } catch {
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete(ONBOARDING_COOKIE_NAME);
      return response;
    }
  }

  // Check auth
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    // Invalid token - clear it and redirect
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete(AUTH_COOKIE_NAME);
    return response;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo.svg|og-image.png|placeholder-avatar.png).*)",
  ],
};
