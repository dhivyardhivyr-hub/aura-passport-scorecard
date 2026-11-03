import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, MessageCircle, RotateCcw, Trophy, Zap } from "lucide-react";
import { toast } from "sonner";
import { analyzeAura, getLeaderboard } from "@/lib/aura.functions";
import { formatPoints, type AuraResult } from "@/lib/aura";
import { AuraPassport } from "@/components/AuraPassport";
import { RoastTerminal } from "@/components/RoastTerminal";
import { Leaderboard } from "@/components/Leaderboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SCAN_LINES = [
  "booting aura engine v2.6…",
  "scraping digital footprint…",
  "measuring rizz frequency…",
  "calibrating chaos levels…",
  "consulting the algorithm…",
  "minting aura passport…",
];

function ScanOverlay() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setStep((s) => Math.min(SCAN_LINES.length - 1, s + 1)), 420);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="glass scanlines rounded-3xl p-6 font-terminal text-sm text-neon-cyan">
      {SCAN_LINES.slice(0, step + 1).map((line) => (
        <p key={line} className="animate-aura-flicker">
          <span className="text-neon-pink">&gt;</span> {line}
        </p>
      ))}
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-neon-pink to-neon-cyan animate-aura-sweep" />
      </div>
      <p className="mt-3 text-center text-[10px] tracking-[0.3em] text-muted-foreground uppercase">
        Aura scan in progress
      </p>
    </div>
  );
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AuraCheck — Calculate Your Aura Points" },
      {
        name: "description",
        content:
          "Scan your digital vibe, claim your futuristic Aura Passport, survive the AI roast, and climb the Global Aura Leaderboard.",
      },
      { property: "og:title", content: "AuraCheck — Calculate Your Aura Points" },
      {
        property: "og:description",
        content: "Enter your handle. Receive your Aura Passport. Survive the roast.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [tab, setTab] = useState<"scan" | "leaderboard">("scan");
  const [name, setName] = useState("");
  const [result, setResult] = useState<AuraResult | null>(null);
  const analyze = useServerFn(analyzeAura);
  const queryClient = useQueryClient();

  const scan = useMutation({
    mutationFn: (handle: string) => analyze({ data: { name: handle } }),
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "The scanner glitched. Try again.");
    },
  });

  const leaderboard = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => getLeaderboard(),
    refetchInterval: 30_000,
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const handle = name.trim();
    if (handle.length < 2) {
      toast.error("Give the algorithm at least 2 characters to judge.");
      return;
    }
    scan.mutate(handle);
  };

  const shareUrl = result ? `${window.location.origin}/u/${result.id}` : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Passport link copied — go flex it");
    } catch {
      toast.error("Copy failed. Long-press the link instead.");
    }
  };

  const openWhatsApp = () => {
    const text = encodeURIComponent(
      `My Aura Score: ${formatPoints(result?.auraPoints ?? 0)} — "${result?.rankTitle}" on AuraCheck. Roast me back: ${shareUrl}`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 pt-6 pb-10">
      <header className="mb-6 flex items-center justify-between gap-3">
        <h1 className="font-display text-lg font-black tracking-[0.18em] text-glow-pink uppercase">
          Aura<span className="text-foreground">Check</span>
          <span className="animate-aura-flicker text-neon-cyan">_</span>
        </h1>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={tab === "scan" ? "default" : "outline"}
            onClick={() => setTab("scan")}
            className="font-terminal text-[10px] tracking-[0.18em] uppercase"
          >
            <Zap className="h-3.5 w-3.5" /> Scan
          </Button>
          <Button
            size="sm"
            variant={tab === "leaderboard" ? "default" : "outline"}
            onClick={() => setTab("leaderboard")}
            className="font-terminal text-[10px] tracking-[0.18em] uppercase"
          >
            <Trophy className="h-3.5 w-3.5" /> Leaderboard
          </Button>
        </div>
      </header>

      {tab === "scan" ? (
        <main className="flex flex-1 flex-col gap-6">
          {result ? (
            <>
              <AuraPassport result={result} />
              <RoastTerminal roast={result.roast} />
              <div className="flex flex-col gap-3">
                <Button
                  size="lg"
                  onClick={openWhatsApp}
                  className="neon-frame-pink font-terminal text-sm tracking-[0.2em] uppercase"
                >
                  <MessageCircle className="h-4 w-4" /> Share to WhatsApp
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={copyLink}
                  className="neon-frame-cyan font-terminal text-sm tracking-[0.2em] uppercase"
                >
                  <Copy className="h-4 w-4" /> Copy Link
                </Button>
                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setResult(null);
                      setName("");
                    }}
                    className="flex-1 font-terminal text-[10px] tracking-[0.18em] text-muted-foreground uppercase"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Scan another
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTab("leaderboard")}
                    className="flex-1 font-terminal text-[10px] tracking-[0.18em] text-neon-cyan uppercase"
                  >
                    <Trophy className="h-3.5 w-3.5" /> See ranking
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <section className="text-center">
                <p className="mb-3 inline-block rounded-full border border-neon-cyan/40 px-3 py-1 font-terminal text-[10px] tracking-[0.24em] text-neon-cyan uppercase">
                  AI-powered vibe engine
                </p>
                <h2 className="font-display text-3xl leading-tight font-black tracking-tight sm:text-4xl">
                  Calculate Your{" "}
                  <span className="text-glow-pink">Aura Points</span> &amp; Claim
                  Your Digital Identity.
                </h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  100% algorithmic. Zero mercy. Infinite clout.
                </p>
              </section>

              {scan.isPending ? (
                <ScanOverlay />
              ) : (
                <form onSubmit={submit} className="glass rounded-3xl p-5 sm:p-6">
                  <label
                    htmlFor="handle"
                    className="mb-2 block font-terminal text-[10px] tracking-[0.22em] text-muted-foreground uppercase"
                  >
                    Target for analysis
                  </label>
                  <Input
                    id="handle"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your username, handle, or digital bio…"
                    maxLength={80}
                    autoComplete="off"
                    className="h-12 bg-background/50 font-terminal text-base"
                  />
                  <Button
                    type="submit"
                    size="lg"
                    disabled={name.trim().length < 2 || scan.isPending}
                    className="neon-frame-pink mt-4 h-13 w-full font-terminal text-sm tracking-[0.24em] uppercase"
                  >
                    Analyze My Vibe
                  </Button>
                  <p className="mt-3 text-center font-terminal text-[9px] tracking-[0.18em] text-muted-foreground uppercase">
                    Deterministic scoring — same handle, same aura, forever
                  </p>
                </form>
              )}
            </>
          )}
        </main>
      ) : (
        <main className="flex flex-1 flex-col gap-4">
          <section className="text-center">
            <h2 className="font-display text-2xl font-black tracking-wide text-glow-cyan uppercase sm:text-3xl">
              Global Aura Leaderboard
            </h2>
            <p className="mt-2 font-terminal text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
              Top aura holders — updated live
            </p>
          </section>
          {leaderboard.isPending ? (
            <div className="glass rounded-2xl p-8 text-center font-terminal text-sm text-muted-foreground">
              Syncing with the algorithm…
            </div>
          ) : leaderboard.isError ? (
            <div className="glass rounded-2xl p-8 text-center font-terminal text-sm text-destructive">
              Leaderboard uplink failed. Try again shortly.
            </div>
          ) : (
            <Leaderboard rows={leaderboard.data ?? []} currentId={result?.id} />
          )}
          <Button
            size="lg"
            onClick={() => setTab("scan")}
            className="neon-frame-pink font-terminal text-sm tracking-[0.2em] uppercase"
          >
            <Zap className="h-4 w-4" /> Scan my vibe
          </Button>
        </main>
      )}

      <footer className="mt-10 text-center font-terminal text-[9px] tracking-[0.24em] text-muted-foreground/70 uppercase">
        AuraCheck — the algorithm sees everything
      </footer>
    </div>
  );
}
