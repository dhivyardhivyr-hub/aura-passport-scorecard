import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { generateResponse, type GatewayError } from "@lovable.dev/ai-gateway";
import type { Database } from "@/integrations/supabase/types";
import {
  rankTitleFor,
  scoreHandle,
  type AuraResult,
  type AuraSource,
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

// ---------------------------------------------------------------------------
// Live web scan: real search results via Firecrawl, scored by the AI engine.
// ---------------------------------------------------------------------------

const FIRECRAWL_GATEWAY = "https://connector-gateway.lovable.dev/firecrawl/v2";

interface WebFinding {
  url: string;
  title: string;
  description: string;
  markdown: string;
}

async function searchOpenWeb(name: string): Promise<WebFinding[]> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const firecrawlKey = process.env["FIRECRAWL_API_KEY"];
  if (!lovableKey || !firecrawlKey) {
    console.error("Firecrawl credentials missing; scan falls back to heuristics");
    return [];
  }
  try {
    const res = await fetch(`${FIRECRAWL_GATEWAY}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": firecrawlKey,
      },
      body: JSON.stringify({
        query: `"${name}" (profile OR bio OR handle OR posts)`,
        limit: 8,
        scrapeOptions: { formats: ["markdown"] },
      }),
    });
    if (!res.ok) {
      console.error(
        `Firecrawl search failed [${res.status}]: ${(await res.text()).slice(0, 400)}`,
      );
      return [];
    }
    const payload = (await res.json()) as {
      success?: boolean;
      data?: Array<{
        url?: string;
        title?: string;
        description?: string;
        markdown?: string;
      }>;
    };
    return (payload.data ?? [])
      .map((row) => ({
        url: row.url ?? "",
        title: (row.title ?? "").slice(0, 160),
        description: (row.description ?? "").slice(0, 300),
        markdown: (row.markdown ?? "").replace(/\s+/g, " ").slice(0, 600),
      }))
      .filter((f) => f.url.startsWith("http"))
      .slice(0, 8);
  } catch (error) {
    console.error("Firecrawl search error", error);
    return [];
  }
}

const PLATFORM_HOSTS: Array<[string, string]> = [
  ["x.com", "X / Twitter"],
  ["twitter.com", "X / Twitter"],
  ["instagram.com", "Instagram"],
  ["github.com", "GitHub"],
  ["reddit.com", "Reddit"],
  ["youtube.com", "YouTube"],
  ["tiktok.com", "TikTok"],
  ["linkedin.com", "LinkedIn"],
  ["twitch.tv", "Twitch"],
  ["medium.com", "Blog"],
  ["substack.com", "Blog"],
  ["dev.to", "Blog"],
  ["soundcloud.com", "SoundCloud"],
];

function platformFor(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    for (const [hostKey, label] of PLATFORM_HOSTS) {
      if (host === hostKey || host.endsWith(`.${hostKey}`)) return label;
    }
    return "Web";
  } catch {
    return "Web";
  }
}

interface ScanVerdict {
  rizz: number;
  chaos: number;
  hustle: number;
  auraPoints: number;
  roast: string;
  sources: AuraSource[];
}

const SCAN_SYSTEM_PROMPT =
  "You are AuraCheck's live scan engine, a viral internet-culture app that scores people's 'aura' (social cool-factor) from their real digital footprint. " +
  "You receive web search results (titles, descriptions, page snippets) about a handle or name found on the open web. " +
  "First judge which results plausibly belong to the same digital persona (same or very similar handle, matching bio or content). Ignore obviously unrelated results like companies or news articles about different people. " +
  "Then score the persona based on the real evidence: rizz/charm, chaos, hustle, and total aura points. Score like a harsh but funny internet judge. " +
  'Respond with ONLY minified JSON (no markdown fences) matching exactly: {"rizz": <0-100>, "chaos": <0-100>, "hustle": <0-100>, "auraPoints": <integer between -300 and 3000>, "verdicts": [{"i": <result index>, "relevant": <true|false>, "platform": "<short platform name>", "note": "<one-sentence lowercase evidence note>"}, ...], "roast": "<one paragraph, 3-4 sentences, max 70 words, witty savage-but-harmless roast grounded ONLY in the real findings; never cruel about protected traits; end on a playful jab or backhanded compliment>"}';

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function parseScanOutput(text: string, findings: WebFinding[]): ScanVerdict | null {
  const cleaned = text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
  const obj = parsed as {
    rizz?: unknown;
    chaos?: unknown;
    hustle?: unknown;
    auraPoints?: unknown;
    verdicts?: unknown;
    roast?: unknown;
  };
  const verdicts = Array.isArray(obj.verdicts) ? obj.verdicts : [];
  const sources: AuraSource[] = [];
  for (const v of verdicts) {
    const item = v as { i?: unknown; relevant?: unknown; platform?: unknown; note?: unknown };
    const index = typeof item.i === "number" ? item.i : -1;
    const finding = findings[index];
    if (!finding || item.relevant !== true) continue;
    sources.push({
      platform:
        typeof item.platform === "string" && item.platform.length > 0
          ? item.platform.slice(0, 40)
          : platformFor(finding.url),
      url: finding.url,
      title: finding.title || finding.description.slice(0, 120),
      note: typeof item.note === "string" ? item.note.slice(0, 140) : "",
    });
    if (sources.length >= 4) break;
  }
  const roast = typeof obj.roast === "string" ? obj.roast.trim().slice(0, 900) : "";
  if (sources.length === 0 || roast.length < 40) return null;
  const heuristic = scoreHandle("");
  return {
    rizz: clamp(obj.rizz, 0, 100, heuristic.rizz),
    chaos: clamp(obj.chaos, 0, 100, heuristic.chaos),
    hustle: clamp(obj.hustle, 0, 100, heuristic.hustle),
    auraPoints: clamp(obj.auraPoints, -300, 3000, heuristic.auraPoints),
    roast,
    sources,
  };
}

async function generateRoast(name: string, stats: ReturnType<typeof scoreHandle>): Promise<string> {
  const userBrief =
    `Persona to roast: "${name}". ` +
    `Total Aura Points: ${stats.auraPoints} (${stats.rankTitle}). ` +
    `Rizz/Charm: ${stats.rizz}/100. Chaos Factor: ${stats.chaos}/100. Hustle Metric: ${stats.hustle}/100.`;
  const ROAST_SYSTEM_PROMPT =
    "You are the roast engine of AuraCheck, a viral internet-culture app that scores people's 'aura' (social cool-factor). " +
    "Write a hilarious, witty, savage-but-harmless roast of the user's digital persona in ONE paragraph of 3 to 4 sentences (max 70 words). " +
    "Internet-native tone, funny, punchy, roast-style — but never cruel about protected traits: no slurs, no hate, no sexual content, no real-world harm. " +
    "Output ONLY the roast paragraph, no preamble, no quotes.";
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
    sources: (row.sources as unknown as AuraSource[] | null) ?? [],
    scanMode: row.scan_mode === "live" ? "live" : "low_signal",
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
    const heuristic = scoreHandle(name);
    let result: {
      auraPoints: number;
      rizz: number;
      chaos: number;
      hustle: number;
      rankTitle: string;
      roast: string;
      sources: AuraSource[];
      scanMode: "live" | "low_signal";
    };

    const findings = await searchOpenWeb(name);
    if (findings.length > 0) {
      const evidence = findings
        .map(
          (f, i) =>
            `[${i}] platform: ${platformFor(f.url)}\nurl: ${f.url}\ntitle: ${f.title}\ndescription: ${f.description}\nsnippet: ${f.markdown}`,
        )
        .join("\n\n");
      try {
        const response = await generateResponse({
          model: "openai/gpt-6-astra",
          instructions: SCAN_SYSTEM_PROMPT,
          input: `Handle/name to scan: "${name}".\n\nSearch results found on the open web:\n\n${evidence}`,
          max_output_tokens: 1200,
          temperature: 1,
        });
        const verdict = parseScanOutput(extractOutputText(response), findings);
        if (verdict) {
          result = {
            auraPoints: verdict.auraPoints,
            rizz: verdict.rizz,
            chaos: verdict.chaos,
            hustle: verdict.hustle,
            rankTitle: rankTitleFor(verdict.auraPoints),
            roast: verdict.roast,
            sources: verdict.sources,
            scanMode: "live",
          };
        } else {
          // Found signal but could not verify it into a live verdict.
          result = {
            auraPoints: heuristic.auraPoints,
            rizz: heuristic.rizz,
            chaos: heuristic.chaos,
            hustle: heuristic.hustle,
            rankTitle: heuristic.rankTitle,
            roast: fallbackRoast(name, heuristic.auraPoints),
            sources: findings.slice(0, 3).map((f) => ({
              platform: platformFor(f.url),
              url: f.url,
              title: f.title || f.description.slice(0, 120),
              note: "unverified mention",
            })),
            scanMode: "low_signal",
          };
        }
      } catch (error) {
        console.error("AI scan scoring failed", (error as GatewayError)?.code ?? error);
        result = {
          auraPoints: heuristic.auraPoints,
          rizz: heuristic.rizz,
          chaos: heuristic.chaos,
          hustle: heuristic.hustle,
          rankTitle: heuristic.rankTitle,
          roast: fallbackRoast(name, heuristic.auraPoints),
          sources: [],
          scanMode: "low_signal",
        };
      }
    } else {
      // No public footprint found: heuristic scan with a generated roast.
      result = {
        auraPoints: heuristic.auraPoints,
        rizz: heuristic.rizz,
        chaos: heuristic.chaos,
        hustle: heuristic.hustle,
        rankTitle: heuristic.rankTitle,
        roast: await generateRoast(name, heuristic),
        sources: [],
        scanMode: "low_signal",
      };
    }

    const supabase = getPublicClient();
    const { data: row, error } = await supabase
      .from("aura_results")
      .insert({
        display_name: name,
        aura_points: result.auraPoints,
        rizz: result.rizz,
        chaos: result.chaos,
        hustle: result.hustle,
        rank_title: result.rankTitle,
        roast: result.roast,
        sources: result.sources,
        scan_mode: result.scanMode,
      })
      .select("id, display_name, aura_points, rizz, chaos, hustle, rank_title, roast, sources, scan_mode, created_at")
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
