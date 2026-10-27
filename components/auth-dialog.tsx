"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { useUiStore } from "@/lib/store";

const emailSchema = z.string().trim().email("Enter a valid email address.").max(254);

type Status = "idle" | "sending" | "sent" | "error";

export function AuthDialog() {
  const open = useUiStore((s) => s.authDialogOpen);
  const authNext = useUiStore((s) => s.authNext);
  const closeAuthDialog = useUiStore((s) => s.closeAuthDialog);

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) {
      setStatus("idle");
      setMessage("");
    }
  }, [open]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setStatus("error");
      setMessage(parsed.error.issues[0]?.message ?? "Enter a valid email address.");
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setStatus("error");
      setMessage("Sign-in isn't set up on this deployment yet.");
      return;
    }

    setStatus("sending");
    setMessage("");
    const next = authNext ?? window.location.pathname;
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      setStatus("error");
      setMessage("We couldn't send the link. Please check your email and try again.");
      return;
    }
    setStatus("sent");
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeAuthDialog()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign in to explore</DialogTitle>
          <DialogDescription>
            No password needed. We&apos;ll email you a magic link to chat with guides and save favorites.
          </DialogDescription>
        </DialogHeader>

        {status === "sent" ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
            <CheckCircle2 className="h-10 w-10 text-success" aria-hidden="true" />
            <p className="font-semibold">Check your inbox</p>
            <p className="text-sm text-muted-foreground">
              We sent a sign-in link to <span className="font-medium text-foreground">{email}</span>. It may take a minute to arrive.
            </p>
            <Button variant="outline" size="sm" onClick={() => setStatus("idle")}>
              Use a different email
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="grid gap-3" noValidate>
            <label htmlFor="auth-email" className="text-sm font-medium">
              Email address
            </label>
            <Input
              id="auth-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={status === "error"}
              aria-describedby={status === "error" ? "auth-error" : undefined}
              disabled={status === "sending"}
              required
            />
            {status === "error" && (
              <p id="auth-error" role="alert" className="text-sm text-destructive">
                {message}
              </p>
            )}
            <Button type="submit" disabled={status === "sending"}>
              {status === "sending" ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Mail aria-hidden="true" />
              )}
              {status === "sending" ? "Sending…" : "Send magic link"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
