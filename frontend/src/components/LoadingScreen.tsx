import { GrainGradient } from "@paper-design/shaders-react";
import { Activity } from "lucide-react";

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
        <div className="relative mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary-light shadow-lg shadow-primary/25 flex items-center justify-center">
            <Activity className="w-10 h-10 text-white animate-pulse" />
          </div>
          <div className="absolute -inset-3 rounded-3xl border-2 border-primary/20 animate-ping opacity-50" />
          <div className="absolute -inset-6 rounded-[2rem] border border-primary/10 animate-ping opacity-30" style={{ animationDelay: "0.3s", animationDuration: "2.5s" }} />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0s" }} />
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.15s" }} />
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.3s" }} />
        </div>

        <p className="mt-4 text-sm text-text-muted font-medium tracking-wide animate-pulse">
          CARGANDO
        </p>
      </div>
    </section>
  );
}
