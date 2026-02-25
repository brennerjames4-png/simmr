import { Home, PlusCircle, Search, Bell, User, CalendarDays, ShoppingCart, Bookmark } from "lucide-react";

export const mobileNavItems = [
  { label: "Feed", href: "/feed", icon: Home },
  { label: "Planner", href: "/meal-planner", icon: CalendarDays },
  { label: "Create", href: "/post/new", icon: PlusCircle },
  { label: "Shopping", href: "/shopping", icon: ShoppingCart },
  { label: "Profile", href: "/profile", icon: User },
] as const;

export const secondaryNavItems = [
  { label: "Explore", href: "/search", icon: Search },
  { label: "Collections", href: "/collections", icon: Bookmark },
  { label: "Activity", href: "/notifications", icon: Bell },
] as const;
