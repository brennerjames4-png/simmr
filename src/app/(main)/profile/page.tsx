import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";

export default async function ProfilePage() {
  const user = await requireAuth();
  redirect(`/profile/${user.username}`);
}
