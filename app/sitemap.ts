import type { MetadataRoute } from "next";
import { DESTINATIONS } from "@/lib/destinations";
import { getSiteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    ...DESTINATIONS.flatMap((d) => [
      { url: `${base}/destination/${d.slug}`, changeFrequency: "monthly" as const, priority: 0.8 },
      { url: `${base}/destination/${d.slug}/tour`, changeFrequency: "monthly" as const, priority: 0.6 },
      { url: `${base}/destination/${d.slug}/guide`, changeFrequency: "monthly" as const, priority: 0.6 },
    ]),
  ];
}
