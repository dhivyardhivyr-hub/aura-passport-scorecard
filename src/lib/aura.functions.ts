import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { generateResponse, type GatewayError } from "@lovable.dev/ai-gateway";
import type { Database } from "@/integrations/supabase/types";
import {
  rankTitleFor,
  scoreHandle,
  type AuraResult,
  type LeaderboardRow,
} from "./aura";

type AuraResultRow = Database["public"]["Tables"]["aura_results"]["Row"];

/**
 * Public read/insert client. `aura_results` allows anon SELECT + INSERT via
 * RLS, so no session is needed. sb_ keys are opaque (not JWTs): send apikey,
 * strip the default Authorization bearer.
 */
function getPublicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const FALLBACK_ROASTS: Record<string, (name: string) => string> = {
  "OG AURA CELESTIAL": (n) =>
    `Scanning "${n}" returned a reading so high the server asked for a second opinion. Your replies have repeat value, your presence lifts group chats, and the algorithm genuinely cannot find the flaw it was built to find. Keep farming, celestial one.`,
  "CERTIFIED AURA FARMER": (n) =>
    `"${n}" scans as a certified aura farmer: consistent output, minimum embarrassment, maximum watchability. People screenshot your messages. The only threat to your score is you logging off for a week.`,
  "SOLID W VIBES": (n) =>
    `The algorithm rated "${n}" a certified W with occasional self-inflicted Ls. Your chaos keeps things interesting and your charm keeps you out of trouble. One bold move per week and you upgrade a tier.`,
  "MID-CLASS AURA CITIZEN": (n) =>
    `"${n}" scanned as aggressively adequate: stable, dependable, forgettable in the way default wallpapers are forgettable. The upside? Mid is a launchpad. One strong hobby and one good haircut and the graph bends upward.`,
  "NPC ADJACENT": (n) =>
    `The scan of "${n}" returned mostly background radiation. You react to life instead of posting it. One opinion, one new profile picture, one unreturned text sent at noon — that is the entire escape sequence.`,
  "AURA DEBTOR": (n) =>
    `The algorithm checked "${n}" twice and then quietly lowered the brightness. Your chaos is unearned, your hustle is theoretical, and your rizz file could not be located on any server. Start the recovery arc with a hobby that does not involve scrolling.`,
};

function fallbackRoast(name: string, points: number): string {
  const key = rankTitleFor(points);
  return (FALLBACK_ROASTS[key] ?? FALLBACK_ROASTS["MID-CLASS AURA CITIZEN"])(name);
}

function extractOutputText(response: unknown): string {
  const output = (
    response as {
      output?: Array<{
        content?: Array<{ type?: string; text?: string } | { type?: string; ref?: string }>;
      }>;
    }
  ).output;
  if (!Array.isArray(output)) return "";
  const parts: string[] = [];
  for (const item of output) {
    if (!Array.isArray(item?.content)) continue;
    for (const part of item.content) {
      if (part && "text" in part && part.type === "output_text" && part.text) {
        parts.push(part.text);
      }
    }
  }
  return parts.join(" ");
}

const ROAST_SYSTEM_PROMPT =
  "You are the roast engine of AuraCheck, a viral internet-culture app that scores people's 'aura' (social cool-factor). " +
  "Write a hilarious, witty, savage-but-harmless roast of the user's digital persona in ONE paragraph of 3 to 4 sentences (max 70 words). " +
  "Reference the given stats. Internet-native tone, funny, punchy, roast-style — but never cruel about protected traits: no slurs, no hate, no sexual content, no real-world harm. " +
  "End on a playful jab or a backhanded compliment. Output ONLY the roast paragraph, no preamble, no quotes.";

async function generateRoast(name: string, stats: ReturnType<typeof scoreHandle>): Promise<string> {
  const userBrief =
    `Persona to roast: "${name}". ` +
    `Total Aura Points: ${stats.auraPoints} (${stats.rankTitle}). ` +
    `Rizz/Charm: ${stats.rizz}/100. Chaos Factor: ${stats.chaos}/100. Hustle Metric: ${stats.hustle}/100.`;
  try {
    const response = await generateResponse({
      model: "openai/gpt-6-astra",
      instructions: ROAST_SYSTEM_PROMPT,
      input: userBrief,
      max_output_tokens: 350,
      temperature: 1,
    });
    const text = extractOutputText(response).trim();
    if (text.length >= 40) return text.slice(0, 900);
  } catch (error) {
    // Roast generation is best-effort entertainment; fall back to a canned one.
    console.error("AI roast generation failed", (error as GatewayError)?.code ?? error);
  }
  return fallbackRoast(name, stats.auraPoints);
}

function rowToResult(row: AuraResultRow): AuraResult {
  return {
    id: row.id,
    displayName: row.display_name,
    auraPoints: row.aura_points,
    rizz: row.rizz,
    chaos: row.chaos,
    hustle: row.hustle,
    rankTitle: row.rank_title,
    roast: row.roast,
    createdAt: row.created_at,
  };
}

export const analyzeAura = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ name: z.string().trim().min(2).max(80) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const name = data.name.replace(/\s+/g, " ").slice(0, 80);
    const stats = scoreHandle(name);
    const roast = await generateRoast(name, stats);
    const supabase = getPublicClient();
    const { data: row, error } = await supabase
      .from("aura_results")
      .insert({
        display_name: name,
        aura_points: stats.auraPoints,
        rizz: stats.rizz,
        chaos: stats.chaos,
        hustle: stats.hustle,
        rank_title: stats.rankTitle,
        roast,
      })
      .select("id, display_name, aura_points, rizz, chaos, hustle, rank_title, roast, created_at")
      .single();
    if (error || !row) {
      throw new Error("The aura scanner could not file your passport. Try again.");
    }
    return rowToResult(row as AuraResultRow);
  });

export const getLeaderboard = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .from("aura_results")
    .select("id, display_name, aura_points, rank_title, created_at")
    .order("aura_points", { ascending: false })
    .limit(50);
  if (error) throw new Error("Leaderboard uplink failed. Try again.");
  return (data ?? []) as LeaderboardRow[];
});

export const getAuraById = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const supabase = getPublicClient();
    const { data: row, error } = await supabase
      .from("aura_results")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) return null;
    return rowToResult(row as AuraResultRow);
  });
