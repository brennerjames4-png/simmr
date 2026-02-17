import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificationTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  const body = await request.json();
  const email = body.email?.trim()?.toLowerCase();

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  // Clean up any existing tokens for this email
  await db
    .delete(verificationTokens)
    .where(eq(verificationTokens.email, email));

  // Generate random token
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await db.insert(verificationTokens).values({
    email,
    token,
    expiresAt,
  });

  // Send email via Resend
  const resendApiKey = process.env.RESEND_API_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const magicLink = `${appUrl}/api/auth/email/verify?token=${token}`;

  if (resendApiKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Simmr <noreply@simmr.app>",
        to: email,
        subject: "Sign in to Simmr",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="margin-bottom: 16px;">Sign in to Simmr</h2>
            <p style="color: #555; margin-bottom: 24px;">Click the link below to sign in. This link expires in 15 minutes.</p>
            <a href="${magicLink}" style="display: inline-block; background: #f97316; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Sign in to Simmr</a>
            <p style="color: #999; margin-top: 24px; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      console.error("Resend error:", await res.text());
    }
  } else {
    // Log magic link for development
    console.log(`[DEV] Magic link for ${email}: ${magicLink}`);
  }

  // Always return success (don't reveal if email exists)
  return NextResponse.json({ success: true });
}
