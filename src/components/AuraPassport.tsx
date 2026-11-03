import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { formatPoints, type AuraResult } from "@/lib/aura";
import { Button } from "@/components/ui/button";

function useCountUp(target: number, duration = 1800) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

function Meter({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "pink" | "chaos" | "cyan";
}) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setShown(value), 250);
    return () => clearTimeout(id);
  }, [value]);
  const bar =
    tone === "pink"
      ? "bg-neon-pink shadow-[0_0_12px_color-mix(in_oklab,var(--neon-pink)_60%,transparent)]"
      : tone === "cyan"
        ? "bg-neon-cyan shadow-[0_0_12px_color-mix(in_oklab,var(--neon-cyan)_60%,transparent)]"
        : "bg-chaos shadow-[0_0_12px_color-mix(in_oklab,var(--chaos)_60%,transparent)]";
  const text =
    tone === "pink" ? "text-neon-pink" : tone === "cyan" ? "text-neon-cyan" : "text-chaos";
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between font-terminal text-[10px] tracking-[0.18em] uppercase">
        <span className="text-muted-foreground">{label}</span>
        <span className={text}>{value}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/60 ring-1 ring-border/60">
        <div
          className={`h-full rounded-full transition-[width] duration-1000 ease-out ${bar}`}
          style={{ width: `${shown}%` }}
        />
      </div>
    </div>
  );
}

export function AuraPassport({ result }: { result: AuraResult }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const points = useCountUp(result.auraPoints);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        backgroundColor: "#0b0212",
      });
      const link = document.createElement("a");
      link.download = `aura-passport-${result.displayName.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase()}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Passport saved to your device");
    } catch {
      toast.error("Could not export the passport. Try again.");
    } finally {
      setDownloading(false);
    }
  };

  const shortId = result.id.split("-")[0]?.toUpperCase() ?? "000000";
  const issued = result.createdAt ? new Date(result.createdAt).toISOString().slice(0, 10) : "—";

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={cardRef}
        className="glass neon-frame-cyan scanlines relative w-full max-w-md overflow-hidden rounded-3xl p-5 font-body sm:p-6"
      >
        {/* holographic sheen */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,color-mix(in_oklab,var(--neon-cyan)_12%,transparent)_45%,color-mix(in_oklab,var(--neon-pink)_12%,transparent)_55%,transparent_70%)]" />
        <div className="relative">
          <div className="flex items-center justify-between font-terminal text-[10px] tracking-[0.22em] uppercase">
            <span className="text-glow-cyan">Aura Passport</span>
            <span className="rounded-full border border-neon-pink/50 px-2 py-0.5 text-neon-pink">
              Republic of the Internet
            </span>
          </div>

          <p className="mt-4 font-terminal text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            Bearer
          </p>
          <h2 className="truncate font-display text-2xl font-bold tracking-wide text-foreground sm:text-3xl">
            {result.displayName}
          </h2>
          <p className="mt-1 font-terminal text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
            Class: {result.rankTitle}
          </p>

          <div className="mt-5 rounded-2xl border border-neon-pink/40 bg-background/40 px-4 py-4 text-center">
            <p className="font-terminal text-[10px] tracking-[0.24em] text-muted-foreground uppercase">
              Total Aura Points
            </p>
            <p className="mt-1 font-display text-5xl font-black tabular-nums text-glow-pink sm:text-6xl">
              {formatPoints(points)}
            </p>
          </div>

          <div className="mt-5 flex flex-col gap-3.5">
            <Meter label="Rizz / Charm" value={result.rizz} tone="pink" />
            <Meter label="Chaos Factor" value={result.chaos} tone="chaos" />
            <Meter label="Hustle Metric" value={result.hustle} tone="cyan" />
          </div>

          <div className="mt-6 flex items-end justify-between gap-4 border-t border-border/70 pt-4">
            <div className="font-terminal text-[9px] leading-relaxed tracking-[0.14em] text-muted-foreground uppercase">
              <p>ID: {shortId}</p>
              <p>Issued: {issued}</p>
              <p>Valid: Eternal</p>
            </div>
            <div className="barcode h-10 w-28 rounded-sm opacity-80" aria-hidden />
          </div>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={handleDownload}
        disabled={downloading}
        className="font-terminal tracking-[0.14em] uppercase"
      >
        {downloading ? "Exporting…" : "⬇ Download passport PNG"}
      </Button>
    </div>
  );
}
