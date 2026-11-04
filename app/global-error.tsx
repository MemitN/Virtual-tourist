"use client";

import { useEffect } from "react";

/** Last-resort boundary for errors in the root layout itself (app/error.tsx can't catch those). */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#0b1b21",
          color: "#f3efe2",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "1.5rem",
        }}
      >
        <div role="alert" style={{ maxWidth: "28rem" }}>
          <h1 style={{ fontSize: "1.75rem", margin: "0 0 0.75rem" }}>Something went wrong</h1>
          <p style={{ opacity: 0.8, margin: "0 0 1.25rem" }}>
            The app hit an unexpected error. Reload to pick up where you left off.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: "2.75rem",
              padding: "0 1.5rem",
              borderRadius: "999px",
              border: 0,
              background: "#3fe0cc",
              color: "#0b1b21",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
