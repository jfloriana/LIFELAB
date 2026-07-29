import { ThinkingOrb } from "thinking-orbs";

export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0e1a] flex items-center justify-center">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <ThinkingOrb state="composing" size={64} />
        </div>
        <p className="text-gray-500 dark:text-white/40">Cargando...</p>
      </div>
    </div>
  );
}
