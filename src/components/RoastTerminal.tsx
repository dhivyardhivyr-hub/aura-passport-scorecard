import { useEffect, useState } from "react";

export function RoastTerminal({ roast }: { roast: string }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    setShown(0);
    const id = window.setInterval(() => {
      setShown((s) => {
        if (s >= roast.length) {
          window.clearInterval(id);
          return s;
        }
        return Math.min(roast.length, s + 2);
      });
    }, 18);
    return () => window.clearInterval(id);
  }, [roast]);

  const done = shown >= roast.length;

  return (
    <div className="glass scanlines relative rounded-2xl p-5 sm:p-6">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-neon-pink shadow-[0_0_8px_color-mix(in_oklab,var(--neon-pink)_70%,transparent)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-chaos/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-neon-cyan shadow-[0_0_8px_color-mix(in_oklab,var(--neon-cyan)_70%,transparent)]" />
        <span className="ml-2 font-terminal text-[10px] tracking-[0.22em] text-glow-cyan uppercase">
          Algorithmic Identity Assessment
        </span>
      </div>
      <p className="font-terminal text-sm leading-relaxed text-foreground/90 sm:text-[15px]">
        <span className="text-neon-pink">roast@auracheck:~$</span>{" "}
        {roast.slice(0, shown)}
        {!done && <span className="animate-aura-flicker text-neon-cyan">▊</span>}
      </p>
    </div>
  );
}
