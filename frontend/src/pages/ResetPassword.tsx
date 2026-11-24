import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { GrainGradient } from "@paper-design/shaders-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { resetPassword } from "@/services/api";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (password !== confirm) { setError("Las contraseñas no coinciden"); return; }
    setLoading(true);
    try {
      const res = await resetPassword(token, password);
      setSuccess(res.mensaje);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="relative min-h-screen overflow-hidden">
      <GrainGradient speed={0.8} scale={1} rotation={0} offsetX={0} offsetY={0} softness={0.5} intensity={0.4} noise={0.2} shape="corners" frame={2854.5} colors={["#0891B2", "#22D3EE", "#67E8F9", "#0ea5e9"]} colorBack="#00000000" className="absolute inset-0" />
      <div className="absolute inset-0 bg-gradient-to-br from-background/90 via-background/50 to-background/90" />
    <div className="relative z-10 min-h-dvh flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">L</div>
          <h1 className="text-3xl font-bold gradient-text">LIFELAB</h1>
        </div>
        <Card className="rounded-2xl bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-xl border border-gray-200/60 dark:border-white/5 shadow-[0_8px_40px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.3)]">
          <CardHeader>
            <CardTitle>Nueva contraseña</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">{error}</div>}
              {success && <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm">{success}</div>}
              <div>
                <label className="block text-sm text-text-muted mb-1.5">Nueva contraseña</label>
                <div className="relative">
                  <Input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mín. 8 caracteres" required />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text">
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1.5">Confirmar contraseña</label>
                <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !token}>
                {loading ? "Guardando..." : "Cambiar contraseña"}
              </Button>
              {success && (
                <p className="text-center text-sm text-text-muted">
                  <Link to="/auth" className="text-primary hover:text-primary-light">Iniciar sesión</Link>
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
    </section>
  );
}
