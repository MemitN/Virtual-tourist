"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Globe2, Heart, LogIn, LogOut, Search } from "lucide-react";
import { toast } from "sonner";
import { PlaceSearch } from "@/components/place-search";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NAV_ITEMS } from "@/lib/nav";
import { SITE_NAME } from "@/lib/site";
import { useUiStore } from "@/lib/store";
import { displayNameFor, useUser } from "@/lib/useUser";
import { cn } from "@/lib/utils";

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const openAuthDialog = useUiStore((s) => s.openAuthDialog);
  const { user, loading, signOut } = useUser();
  const [searchOpen, setSearchOpen] = useState(false);

  // Ctrl/Cmd+K opens search from anywhere.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleSignOut = async (): Promise<void> => {
    await signOut();
    toast.success("Signed out. Safe travels!");
    router.refresh();
  };

  return (
    <header className="glass sticky top-0 z-40 border-x-0 border-t-0">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-2 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3 rounded-full py-1 pr-2" aria-label={`${SITE_NAME} home`}>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sunset-gradient text-primary-foreground shadow-glow">
            <Globe2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="leading-tight">
            <span className="block font-display text-base font-bold">{SITE_NAME}</span>
            <span className="hidden text-[0.65rem] text-muted-foreground xs:block">
              Explore · Experience · Connect
            </span>
          </span>
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map(({ href, label, match }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={match(pathname) ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium transition hover:text-foreground",
                  match(pathname) ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            variant="ghost"
            className="h-11 gap-2 px-3 text-muted-foreground sm:border sm:px-4"
            onClick={() => setSearchOpen(true)}
            aria-label="Search any place in the world"
          >
            <Search aria-hidden="true" />
            <span className="hidden sm:inline">Search the world</span>
            <kbd className="hidden rounded border px-1.5 text-[0.65rem] md:inline">Ctrl K</kbd>
          </Button>

          {loading ? (
            <div className="skeleton h-11 w-11 rounded-full" aria-hidden="true" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-11 gap-2 px-1 sm:pr-3" aria-label="Account menu">
                  <Avatar>
                    <AvatarFallback>{displayNameFor(user).slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-[7rem] truncate text-sm sm:inline">{displayNameFor(user)}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="max-w-[14rem] truncate">
                  Signed in as {user.email ?? displayNameFor(user)}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/favorites">
                    <Heart aria-hidden="true" /> Favorites
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void handleSignOut()}>
                  <LogOut aria-hidden="true" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button size="sm" onClick={() => openAuthDialog(pathname)}>
              <LogIn aria-hidden="true" />
              Sign in
            </Button>
          )}
        </div>
      </nav>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="top-[20%] translate-y-0 overflow-visible">
          <DialogHeader>
            <DialogTitle>Where in the world?</DialogTitle>
            <DialogDescription>Any city, landmark or country. Your guide will meet you there.</DialogDescription>
          </DialogHeader>
          <PlaceSearch autoFocus onNavigate={() => setSearchOpen(false)} />
        </DialogContent>
      </Dialog>
    </header>
  );
}
