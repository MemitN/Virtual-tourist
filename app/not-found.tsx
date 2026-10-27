import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DESTINATIONS } from "@/lib/destinations";

export default function NotFound() {
  return (
    <div className="container flex min-h-[60dvh] flex-col items-center justify-center gap-4 py-16 text-center">
      <Compass className="h-10 w-10 text-primary" aria-hidden="true" />
      <h1 className="text-3xl font-bold">We couldn&apos;t find that place</h1>
      <p className="max-w-md text-muted-foreground">
        The page you wanted doesn&apos;t exist. Try one of these destinations instead.
      </p>
      <ul className="flex flex-wrap justify-center gap-2">
        {DESTINATIONS.map((d) => (
          <li key={d.slug}>
            <Button asChild variant="outline" size="sm">
              <Link href={`/destination/${d.slug}`}>{d.name}</Link>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
