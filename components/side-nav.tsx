"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";

/** Desktop rail (lg and up). Phones get MobileTabBar instead. */
export function SideNav() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-20 flex-col items-center border-r bg-background/70 pb-4 pt-20 backdrop-blur-xl lg:flex">
      <nav aria-label="Primary" className="flex flex-1 flex-col items-center gap-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-2xl text-[0.7rem] font-medium transition",
                active
                  ? "bg-primary/20 text-primary shadow-glow"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
      <ThemeToggle />
    </aside>
  );
}
