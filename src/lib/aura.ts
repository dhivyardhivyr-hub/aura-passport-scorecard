export interface AuraStats {
  rizz: number;
  chaos: number;
  hustle: number;
  auraPoints: number;
  rankTitle: string;
}

export interface AuraResult extends AuraStats {
  id: string;
  displayName: string;
  roast: string;
  createdAt?: string;
}

export interface LeaderboardRow {
  id: string;
  display_name: string;
  aura_points: number;
  rank_title: string;
  created_at: string;
}

export function rankTitleFor(points: number): string {
  if (points >= 1500) return "OG AURA CELESTIAL";
  if (points >= 1000) return "CERTIFIED AURA FARMER";
  if (points >= 600) return "SOLID W VIBES";
  if (points >= 250) return "MID-CLASS AURA CITIZEN";
  if (points >= 0) return "NPC ADJACENT";
  return "AURA DEBTOR";
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic aura scoring: the same handle always produces the same stats,
 * so people can compare (and argue about) scores across the internet.
 */
export function scoreHandle(raw: string): AuraStats {
  const name = raw.trim().toLowerCase();
  let h = 0x811c9dc5;
  for (const ch of name) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193);
  }
  const rand = mulberry32(h >>> 0);
  const rizz = 12 + Math.floor(rand() * 88);
  const chaos = 5 + Math.floor(rand() * 95);
  const hustle = 10 + Math.floor(rand() * 90);
  const bonus = Math.floor(rand() * 260) - 90;
  const auraPoints = Math.round(
    rizz * 13 + hustle * 11 - Math.abs(chaos - 50) * 5 + bonus,
  );
  return { rizz, chaos, hustle, auraPoints, rankTitle: rankTitleFor(auraPoints) };
}

export function formatPoints(points: number): string {
  return points > 0 ? `+${points.toLocaleString("en-US")}` : points.toLocaleString("en-US");
}
