import { z } from "zod";
import { isValidSlug } from "@/lib/place-slug";

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

export const chatBodySchema = z.object({
  slug: slugSchema,
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
  imageUrl: z.string().url().max(2048),
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
