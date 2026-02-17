"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_CREDENTIALS, AUTH_COOKIE_NAME } from "./constants";
import { createSession } from "./session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function signIn(
  _prevState: { error?: string } | undefined,
  formData: FormData
) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (
    username !== ADMIN_CREDENTIALS.username ||
    password !== ADMIN_CREDENTIALS.password
  ) {
    return { error: "Invalid username or password" };
  }

  // Find or verify user exists in DB
  const user = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  if (!user) {
    return { error: "User not found in database" };
  }

  await createSession(user.id, user.username);
  redirect("/feed");
}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
  redirect("/login");
}
