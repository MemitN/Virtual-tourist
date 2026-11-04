import { CalendarDays, Compass, Heart, Home, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Pathname prefix that marks this item active. */
  match: (pathname: string) => boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Home", icon: Home, match: (p) => p === "/" },
  {
    href: "/explore",
    label: "Explore",
    icon: Compass,
    match: (p) => p.startsWith("/explore") || p.startsWith("/destination"),
  },
  { href: "/favorites", label: "Favorites", icon: Heart, match: (p) => p.startsWith("/favorites") },
  { href: "/trips", label: "Trips", icon: CalendarDays, match: (p) => p.startsWith("/trips") },
];
