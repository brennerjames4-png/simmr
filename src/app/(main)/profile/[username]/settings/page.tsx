import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getUserByUsername } from "@/queries/users";
import { getBlockedUsers } from "@/queries/follows";
import { PrivacyToggle } from "@/components/profile/privacy-toggle";
import { UnblockButton } from "./unblock-button";
import { BypassCodeForm } from "@/components/settings/bypass-code-form";
import { isRateLimitBypassed } from "@/lib/rate-limit";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Shield } from "lucide-react";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const currentUser = await requireAuth();
  const { username } = await params;
  const profile = await getUserByUsername(username);

  if (!profile) notFound();

  // Only profile owner can access settings
  if (currentUser.id !== profile.id) {
    redirect(`/profile/${username}`);
  }

  const blockedUsers = await getBlockedUsers(currentUser.id);
  const hasValidBypassCode = isRateLimitBypassed(currentUser.bypassCode ?? null);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/profile/${username}`}
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold">Settings</h1>
      </div>

      {/* Privacy Section */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Privacy
        </h2>
        <PrivacyToggle isPrivate={profile.isPrivate} />
      </div>

      {/* Blocked Users Section */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Blocked Users
        </h2>
        {blockedUsers.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border p-4 text-center">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No blocked users
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {blockedUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <Avatar className="h-8 w-8">
                  {user.avatarUrl && (
                    <AvatarImage
                      src={user.avatarUrl}
                      alt={user.displayName}
                    />
                  )}
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {user.displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{user.displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    @{user.username}
                  </p>
                </div>
                <UnblockButton userId={user.id} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tester Access Section */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Tester Access
        </h2>
        <BypassCodeForm hasValidCode={hasValidBypassCode} />
      </div>
    </div>
  );
}
