import type { Metadata } from "next";
import { FavoritesView } from "@/components/favorites-view";

export const metadata: Metadata = { title: "Your favorites" };

export default function FavoritesPage() {
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold sm:text-4xl">Your favorites</h1>
        <p className="mt-1 text-muted-foreground">Places from anywhere on Earth you&apos;d love to explore again.</p>
      </header>
      <FavoritesView />
    </div>
  );
}
