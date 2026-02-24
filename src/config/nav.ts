import { Home, PlusCircle, Search, Bell, User } from "lucide-react";

export const mobileNavItems = [
  { label: "Feed", href: "/feed", icon: Home },
  { label: "Explore", href: "/search", icon: Search },
  { label: "Create", href: "/post/new", icon: PlusCircle },
  { label: "Activity", href: "/notifications", icon: Bell },
  { label: "Profile", href: "/profile", icon: User },
] as const;
