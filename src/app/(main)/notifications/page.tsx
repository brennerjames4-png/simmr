import { requireAuth } from "@/lib/auth";
import { getPendingRequests } from "@/queries/follows";
import { FollowRequestCard } from "@/components/follow/follow-request-card";
import { Bell } from "lucide-react";

export const metadata = { title: "Notifications — Simmr" };

export default async function NotificationsPage() {
  const user = await requireAuth();
  const requests = await getPendingRequests(user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notifications</h1>
        {requests.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {requests.length} pending follow request
            {requests.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
            <Bell className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold">No pending requests</h2>
          <p className="text-muted-foreground mt-1">You&apos;re all caught up.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((request) => (
            <FollowRequestCard key={request.id} user={request} />
          ))}
        </div>
      )}
    </div>
  );
}
