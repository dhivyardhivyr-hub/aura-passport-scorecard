import { formatPoints, type LeaderboardRow } from "@/lib/aura";

const MEDALS = ["🥇", "🥈", "🥉"];

export function Leaderboard({ rows, currentId }: { rows: LeaderboardRow[]; currentId?: string }) {
  if (rows.length === 0) {
    return (
      <div className="glass rounded-2xl p-8 text-center font-terminal text-sm text-muted-foreground">
        No scans on record yet. Be the first to claim the crown.
      </div>
    );
  }
  return (
    <ol className="flex flex-col gap-2">
      {rows.map((row, index) => {
        const isCurrent = row.id === currentId;
        return (
          <li
            key={row.id}
            className={`glass flex items-center gap-3 rounded-xl px-4 py-3 transition-transform hover:translate-x-0.5 ${
              isCurrent ? "neon-frame-pink" : ""
            }`}
          >
            <span className="w-8 shrink-0 text-center font-display text-base font-bold text-glow-cyan">
              {MEDALS[index] ?? index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-semibold tracking-wide text-foreground">
                {row.display_name}
                {isCurrent && (
                  <span className="ml-2 rounded-full border border-neon-pink/60 px-1.5 py-px font-terminal text-[8px] tracking-[0.2em] text-neon-pink uppercase">
                    You
                  </span>
                )}
              </p>
              <p className="truncate font-terminal text-[9px] tracking-[0.18em] text-muted-foreground uppercase">
                {row.rank_title}
              </p>
            </div>
            <span className="shrink-0 font-display text-lg font-bold tabular-nums text-glow-pink">
              {formatPoints(row.aura_points)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
