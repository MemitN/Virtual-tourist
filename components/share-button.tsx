"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ShareButtonProps {
  title: string;
  text: string;
  /** Site-relative path (may include a query string), e.g. /destination/kyoto/tour?poi=fushimi. */
  path: string;
  tone?: "default" | "glass";
  className?: string;
}

/** Uses the native share sheet when available (great on phones), otherwise copies the link. */
export function ShareButton({ title, text, path, tone = "default", className }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const share = async (): Promise<void> => {
    const url = new URL(path, window.location.origin).toString();
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Closing the share sheet is not an error.
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Couldn't share. Copy the address from your browser instead.");
    }
  };

  return (
    <Button
      size="lg"
      variant={tone === "glass" ? "glass" : "outline"}
      onClick={() => void share()}
      aria-label={`Share ${title}`}
      className={cn(className)}
    >
      {copied ? <Check aria-hidden="true" /> : <Share2 aria-hidden="true" />}
      {copied ? "Copied" : "Share"}
    </Button>
  );
}
