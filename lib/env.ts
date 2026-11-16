import { z } from "zod";

/**
 * Public (browser-safe) environment. Only NEXT_PUBLIC_* values may appear
 * here; Next.js inlines them at build time, so each must be referenced
 * literally (no dynamic process.env[key] lookups).
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_REGION: z.enum(["AE", "IN"]).default("AE"),
});

export type PublicEnv = z.infer<typeof publicSchema>;

export function publicEnv(): PublicEnv {
  return publicSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_REGION: process.env.NEXT_PUBLIC_REGION,
  });
}
