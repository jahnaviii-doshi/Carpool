import "server-only";
import { z } from "zod";

/**
 * Server-only environment. Importing this from a client component fails the
 * build (via the `server-only` package), so secrets cannot leak to the
 * browser bundle by accident.
 */
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(3).optional(),
  GEOCODER_PROVIDER: z.enum(["nominatim", "ola", "google", "fixture"]).default("nominatim"),
  NOMINATIM_BASE_URL: z.url().default("https://nominatim.openstreetmap.org"),
  OLA_MAPS_API_KEY: z.string().min(1).optional(),
  GOOGLE_MAPS_API_KEY: z.string().min(1).optional(),
  ROUTER_PROVIDER: z.enum(["none", "osrm", "ors"]).default("none"),
  OSRM_BASE_URL: z.url().optional(),
  ORS_API_KEY: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

export function serverEnv(): ServerEnv {
  return serverSchema.parse(process.env);
}
