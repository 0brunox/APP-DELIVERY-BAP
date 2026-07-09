import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

async function baseUrl(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Sitemap dinâmico: home + uma entrada por loja ativa. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await baseUrl();
  const entries: MetadataRoute.Sitemap = [{ url: base, changeFrequency: "weekly", priority: 1 }];

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("stores")
      .select("slug, created_at")
      .eq("active", true);
    for (const s of data ?? []) {
      entries.push({
        url: `${base}/${s.slug}`,
        lastModified: s.created_at,
        changeFrequency: "daily",
        priority: 0.8,
      });
    }
  }
  return entries;
}
