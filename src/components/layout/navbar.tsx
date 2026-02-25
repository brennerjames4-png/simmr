import Link from "next/link";
import { PlusCircle, LogOut, Search, Settings, CalendarDays, ShoppingCart, Bookmark } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "./theme-toggle";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth/actions";
import type { User } from "@/lib/db/schema";

export function Navbar({ user }: { user: User }) {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
        <Logo />
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="hidden md:inline-flex">
            <Link href="/search">
              <Search className="h-5 w-5" />
              <span className="sr-only">Search users</span>
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" className="hidden md:inline-flex">
            <Link href="/meal-planner">
              <CalendarDays className="h-5 w-5" />
              <span className="sr-only">Meal Planner</span>
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" className="hidden md:inline-flex">
            <Link href="/shopping">
              <ShoppingCart className="h-5 w-5" />
              <span className="sr-only">Shopping Lists</span>
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" className="hidden md:inline-flex">
            <Link href="/collections">
              <Bookmark className="h-5 w-5" />
              <span className="sr-only">Collections</span>
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon">
            <Link href="/post/new">
              <PlusCircle className="h-5 w-5" />
              <span className="sr-only">Create post</span>
            </Link>
          </Button>
          <NotificationBell userId={user.id} />
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  {user.avatarUrl && (
                    <AvatarImage src={user.avatarUrl} alt={user.displayName} />
                  )}
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {user.displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link href={`/profile/${user.username}`}>Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/meal-planner" className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Meal Planner
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/shopping" className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Shopping Lists
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/collections" className="flex items-center gap-2">
                  <Bookmark className="h-4 w-4" />
                  Collections
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href={`/profile/${user.username}/settings`}
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <form action={signOut} className="w-full">
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </form>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
