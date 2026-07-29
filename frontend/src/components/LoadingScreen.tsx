import { ThinkingOrb } from "thinking-orbs";
import { GrainGradient } from "@paper-design/shaders-react";

export function LoadingScreen() {
  return (
    <section className="relative min-h-screen overflow-hidden">
      <GrainGradient
        speed={0.8}
        scale={1}
        rotation={0}
        offsetX={0}
        offsetY={0}
        softness={0.5}
        intensity={0.4}
        noise={0.2}
        shape="corners"
        frame={2854.5}
        colors={["#0891B2", "#22D3EE", "#67E8F9", "#0ea5e9"]}
        colorBack="#00000000"
        className="absolute inset-0"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-background/90 via-background/50 to-background/90" />

      <div className="relative z-10 min-h-dvh flex flex-col items-center justify-center px-4">
        <div className="relative mb-10">
          <ThinkingOrb state="listening" size={64} />
          <div className="absolute -inset-4 rounded-full bg-primary/10 animate-ping opacity-40" />
          <div className="absolute -inset-8 rounded-full bg-primary/5 animate-ping opacity-20" style={{ animationDelay: "0.3s", animationDuration: "2.5s" }} />
        </div>

        <div className="flex items-center gap-3 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0s" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0.15s" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0.3s" }} />
        </div>

        <p className="text-sm text-text-muted font-medium tracking-[0.2em] uppercase">
          <span className="inline-block animate-pulse">Cargando</span>
        </p>
      </div>
    </section>
  );
}
