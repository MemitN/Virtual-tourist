import type { Metadata } from "next";
import { TripsView } from "@/components/trips-view";

export const metadata: Metadata = { title: "My trips", description: "Your saved trip itineraries." };

export default function TripsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-3xl font-bold sm:text-4xl">My trips</h1>
        <p className="mt-1 text-muted-foreground">Itineraries you saved from the trip toolkit.</p>
      </header>
      <TripsView />
    </div>
  );
}
