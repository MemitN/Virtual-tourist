"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useUiStore } from "@/lib/store";

/** Reacts to ?auth=required|error set by the middleware and auth callback, then cleans the URL. */
export function AuthParamsListener() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const openAuthDialog = useUiStore((s) => s.openAuthDialog);

  const auth = params.get("auth");
  const next = params.get("next");

  useEffect(() => {
    if (!auth) return;
    if (auth === "required") {
      openAuthDialog(next && next.startsWith("/") && !next.startsWith("//") ? next : undefined);
    } else if (auth === "error") {
      toast.error("That sign-in link didn't work. Please request a new one.");
    }
    router.replace(pathname, { scroll: false });
  }, [auth, next, openAuthDialog, router, pathname]);

  return null;
}
