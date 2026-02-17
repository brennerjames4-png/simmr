import { Home, PlusCircle, Search, User } from "lucide-react";

export const mobileNavItems = [
  { label: "Feed", href: "/feed", icon: Home },
  { label: "Explore", href: "/feed", icon: Search },
  { label: "Create", href: "/post/new", icon: PlusCircle },
  { label: "Profile", href: "/profile", icon: User },
] as const;
