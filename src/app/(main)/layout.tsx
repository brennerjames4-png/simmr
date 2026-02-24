import { Navbar } from "@/components/layout/navbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { requireAuth } from "@/lib/auth";
import { getPendingRequestCount } from "@/queries/follows";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();
  const notificationCount = await getPendingRequestCount(user.id);

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      <main className="mx-auto max-w-2xl px-4 pb-20 pt-6 md:pb-6">
        {children}
      </main>
      <MobileNav notificationCount={notificationCount} />
    </div>
  );
}
