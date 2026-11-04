import { cn } from "@/lib/utils";

/** The brand mark: a globe wrapped by an orbit, carrying a bold V and T. */
export function LogoMark({ className }: { className?: string }) {
  // Static ids: identical definitions, so repeated logos on a page render the same.
  const id = "vt";
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="Virtual Tourist logo"
      className={cn("h-10 w-10", className)}
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f8cff" />
          <stop offset="1" stopColor="#2dd4ff" />
        </linearGradient>
        <clipPath id={`${id}-c`}>
          <circle cx="32" cy="32" r="26" />
        </clipPath>
      </defs>
      <circle cx="32" cy="32" r="29" fill="#070d2b" stroke={`url(#${id}-g)`} strokeWidth="2.5" />
      <g clipPath={`url(#${id}-c)`} fill="none" stroke={`url(#${id}-g)`} strokeWidth="1.2" opacity="0.55">
        <ellipse cx="32" cy="32" rx="11" ry="26" />
        <ellipse cx="32" cy="32" rx="22" ry="26" />
        <path d="M6 32h52M9 20h46M9 44h46" />
      </g>
      <ellipse
        cx="32"
        cy="32"
        rx="30"
        ry="9"
        fill="none"
        stroke="#2dd4ff"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeDasharray="30 70"
        transform="rotate(-28 32 32)"
      />
      <g fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 22l8.5 21L32 22" />
        <path d="M33.5 22h15M41 22v21" />
      </g>
    </svg>
  );
}
