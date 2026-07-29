import { useState } from "react";
import { Link } from "react-router-dom";
import { GrainGradient } from "@paper-design/shaders-react";
import { forgotPassword } from "@/services/api";
import { Mail, ArrowLeft, AlertTriangle } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await forgotPassword(email);
      setMessage(res.mensaje);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-foreground dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all duration-200 text-sm";

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

      <div className="relative z-10 min-h-dvh flex items-center justify-center px-4 py-6 sm:py-12">
        <div className="w-full max-w-[420px] mx-auto">
          <div className="text-center mb-6 sm:mb-8">
            <div className="inline-flex items-center justify-center w-12 sm:w-14 h-12 sm:h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-light shadow-lg shadow-primary/25 mb-4 sm:mb-5">
              <Mail className="w-6 sm:w-7 h-6 sm:h-7 text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground dark:text-white">
              Recuperar Contraseña
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              Te enviaremos instrucciones a tu correo electrónico
            </p>
          </div>

          <div className="bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-xl rounded-2xl border border-gray-200/60 dark:border-white/5 shadow-[0_8px_40px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.3)] p-5 sm:p-8">
            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                {error}
              </div>
            )}

            {message ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    <p className="text-green-600 dark:text-green-400 text-sm font-medium">{message}</p>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-yellow-600 dark:text-yellow-400 text-sm font-medium mb-1">¿No lo encuentras?</p>
                    <p className="text-yellow-600/80 dark:text-yellow-400/80 text-xs leading-relaxed">
                      Revisa la carpeta de <strong>Spam</strong> o Correo no deseado. Si no está, espera unos minutos
                      y verifica que el correo ingresado sea correcto.
                    </p>
                  </div>
                </div>
                <Link to="/auth"
                  className="gradient-btn w-full h-12 rounded-xl text-white font-semibold text-sm inline-flex items-center justify-center gap-2 shadow-lg shadow-primary/25">
                  <ArrowLeft size={16} />
                  Volver a iniciar sesión
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-white/40 mb-1.5">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className={inputClass} placeholder="correo@ejemplo.com" required />
                </div>
                <button type="submit" disabled={loading}
                  className="gradient-btn w-full h-12 rounded-xl text-white font-semibold text-base disabled:opacity-60 shadow-lg shadow-primary/25">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Enviando...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Mail size={16} />
                      Enviar instrucciones
                    </span>
                  )}
                </button>
              </form>
            )}
          </div>

          <div className="mt-6 text-center">
            <Link to={message ? "/auth" : "/"} className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
              {message ? "Volver al inicio de sesión" : "Volver al inicio"}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
