import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Copy, Zap } from "lucide-react";
import { toast } from "sonner";
import { getAuraById } from "@/lib/aura.functions";
import { formatPoints } from "@/lib/aura";
import { AuraPassport } from "@/components/AuraPassport";
import { RoastTerminal } from "@/components/RoastTerminal";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/u/$id")({
  loader: async ({ params }) => {
    const result = await getAuraById({ data: { id: params.id } });
    if (!result) throw notFound();
    return { result };
  },
  head: ({ loaderData }) => {
    const result = loaderData?.result;
    const points = result ? formatPoints(result.auraPoints) : "";
    return {
      meta: [
        {
          title: result
            ? `${result.displayName} has ${points} Aura — AuraCheck`
            : "Aura Passport — AuraCheck",
        },
        {
          name: "description",
          content: result
            ? `${result.displayName} scored ${points} Aura Points (${result.rankTitle}) on AuraCheck. Scan your own vibe and claim your Aura Passport.`
            : "Scan your digital vibe on AuraCheck.",
        },
        {
          property: "og:title",
          content: result
            ? `${result.displayName} has ${points} Aura`
            : "Aura Passport — AuraCheck",
        },
        {
          property: "og:description",
          content: result
            ? `Class: ${result.rankTitle}. Think you can beat it? Scan your own vibe.`
            : "Scan your digital vibe on AuraCheck.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: PassportPage,
});

function PassportPage() {
  const { result } = Route.useLoaderData();
  const shareUrl = `${window.location.origin}/u/${result.id}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Passport link copied");
    } catch {
      toast.error("Copy failed on this device.");
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 pt-6 pb-10">
      <header className="mb-6 text-center">
        <Link
          to="/"
          className="font-display text-lg font-black tracking-[0.18em] text-glow-pink uppercase"
        >
          Aura<span className="text-foreground">Check</span>
          <span className="animate-aura-flicker text-neon-cyan">_</span>
        </Link>
      </header>

      <main className="flex flex-1 flex-col gap-6">
        <AuraPassport result={result} />
        <RoastTerminal roast={result.roast} />
        <div className="flex flex-col gap-3">
          <Button
            size="lg"
            onClick={copyLink}
            variant="outline"
            className="neon-frame-cyan font-terminal text-sm tracking-[0.2em] uppercase"
          >
            <Copy className="h-4 w-4" /> Copy this passport
          </Button>
          <Button
            size="lg"
            asChild
            className="neon-frame-pink font-terminal text-sm tracking-[0.2em] uppercase"
          >
            <Link to="/">
              <Zap className="h-4 w-4" /> Scan my own vibe
            </Link>
          </Button>
        </div>
      </main>

      <footer className="mt-10 text-center font-terminal text-[9px] tracking-[0.24em] text-muted-foreground/70 uppercase">
        AuraCheck — the algorithm sees everything
      </footer>
    </div>
  );
}
