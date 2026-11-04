import { z } from "zod";
import { LANGUAGE_CODES } from "@/lib/languages";
import { isValidSlug } from "@/lib/place-slug";
import { itinerarySchema, tripOptionsSchema } from "@/lib/trip";

export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9~.-]+$/, "Invalid slug")
  .refine(isValidSlug, "Unknown destination");

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1, "Message is empty").max(4000, "Message is too long"),
});

export const languageSchema = z.enum(LANGUAGE_CODES);

export const chatBodySchema = z.object({
  slug: slugSchema,
  language: languageSchema.optional(),
  messages: z
    .array(chatMessageSchema)
    .min(1)
    .max(40)
    .refine((msgs) => msgs[msgs.length - 1]?.role === "user", {
      message: "Last message must come from the user",
    }),
});

export const imageBodySchema = z.object({
  slug: slugSchema,
  prompt: z.string().trim().min(1).max(500),
});

export const segmentBodySchema = z.object({
  imageUrl: z
    .string()
    .url()
    .max(2048)
    .refine((value) => value.startsWith("https://"), "Image URL must use https"),
  textPrompt: z.string().trim().min(1).max(200),
});

export const favoriteCreateSchema = z.object({
  slug: slugSchema,
});

export const favoriteIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const contextParamSchema = z.object({
  slug: slugSchema,
});

export type ChatBody = z.infer<typeof chatBodySchema>;
export type ImageBody = z.infer<typeof imageBodySchema>;
export type SegmentBody = z.infer<typeof segmentBodySchema>;
export type FavoriteCreateBody = z.infer<typeof favoriteCreateSchema>;

export const placeSearchSchema = z.object({
  q: z.string().trim().min(2, "Type at least 2 characters").max(80),
});

export const translateBodySchema = z.object({
  text: z.string().trim().min(1).max(4000),
  language: languageSchema,
});

export const explainBodySchema = z.object({
  slug: slugSchema,
  poiId: z.string().max(80).regex(/^[a-z0-9-]+$/).optional(),
  language: languageSchema,
});

export const tripCreateSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(1).max(200),
  language: z.string().trim().min(2).max(8).default("en"),
  options: tripOptionsSchema.optional(),
  data: itinerarySchema,
});

export type TripCreateBody = z.infer<typeof tripCreateSchema>;
