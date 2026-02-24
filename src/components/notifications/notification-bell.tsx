import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPendingRequestCount } from "@/queries/follows";

interface NotificationBellProps {
  userId: string;
}

export async function NotificationBell({ userId }: NotificationBellProps) {
  const count = await getPendingRequestCount(userId);

  return (
    <Button asChild variant="ghost" size="icon" className="relative">
      <Link href="/notifications">
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {count > 9 ? "9+" : count}
          </span>
        )}
        <span className="sr-only">Notifications</span>
      </Link>
    </Button>
  );
}
