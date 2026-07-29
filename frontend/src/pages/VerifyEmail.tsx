import { useState, useEffect } from "react";
import { useSearchParams, Link, useLocation } from "react-router-dom";
import { CheckCircle, AlertCircle, Loader2, Mail, RefreshCw } from "lucide-react";
import { verifyEmail, resendVerification } from "@/services/api";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const token = searchParams.get("token") || "";
  const email = (location.state as { email?: string })?.email || "";
  const verifyUrl = (location.state as { verifyUrl?: string })?.verifyUrl || "";
  const [status, setStatus] = useState<"loading" | "success" | "error" | "pending">(token ? "loading" : "pending");
  const [message, setMessage] = useState("");
  const [resending, setResending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!token) return;
    verifyEmail(token)
      .then((res) => {
        setStatus("success");
        setMessage(res.mensaje);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Error al verificar correo");
      });
  }, [token]);

  async function handleResend() {
    if (!email || resending) return;
    setResending(true);
    try {
      const res = await resendVerification(email);
      toast(res.mensaje, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al reenviar", "error");
    }
    setResending(false);
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">L</div>
        <h1 className="text-3xl font-bold text-foreground dark:text-white mb-8">LIFELAB</h1>
          <Card>
          <CardContent className="px-6 py-8">
            {status === "loading" && (
              <div className="flex flex-col items-center gap-6 py-8">
                <Loader2 size={40} className="text-primary animate-spin" />
                <p className="text-sm text-text-muted">Verificando tu correo...</p>
              </div>
            )}
            {status === "success" && (
              <div className="flex flex-col items-center gap-6">
                <div className="w-20 h-20 rounded-2xl bg-green-500/10 flex items-center justify-center">
                  <CheckCircle size={40} className="text-green-500" />
                </div>
                <div className="text-center space-y-2">
                  <h2 className="text-xl font-bold text-green-600 dark:text-green-400">¡Correo verificado!</h2>
                  <p className="text-sm text-text-muted">{message}</p>
                </div>
                <Link to="/auth" className="w-full h-12 rounded-xl bg-primary text-white font-semibold text-base hover:bg-primary-dark transition-all duration-200 shadow-lg shadow-primary/25 flex items-center justify-center gap-2">
                  Iniciar sesión
                </Link>
              </div>
            )}
            {status === "error" && (
              <div className="flex flex-col items-center gap-6">
                <div className="w-20 h-20 rounded-2xl bg-red-500/10 flex items-center justify-center">
                  <AlertCircle size={40} className="text-red-500" />
                </div>
                <div className="text-center space-y-2">
                  <h2 className="text-xl font-bold text-red-600 dark:text-red-400">Error de verificación</h2>
                  <p className="text-sm text-text-muted">{message}</p>
                </div>
                <Link to="/auth" className="w-full h-12 rounded-xl bg-primary text-white font-semibold text-base hover:bg-primary-dark transition-all duration-200 shadow-lg shadow-primary/25 flex items-center justify-center gap-2">
                  Volver al inicio
                </Link>
              </div>
            )}
            {status === "pending" && (
              <div className="flex flex-col items-center gap-6">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <div className="relative">
                    <Mail size={40} className="text-primary" />
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <h2 className="text-xl font-bold text-foreground dark:text-white">Revisa tu correo</h2>
                  <p className="text-sm text-text-muted leading-relaxed">
                    Te hemos enviado un enlace de verificación a
                  </p>
                  {email && (
                    <div className="inline-block bg-primary/5 border border-primary/20 rounded-lg px-4 py-2">
                      <p className="text-sm font-semibold text-primary">{email}</p>
                    </div>
                  )}
                  <p className="text-sm text-text-muted leading-relaxed mt-2">
                    Haz clic en el enlace para activar tu cuenta.
                  </p>
                </div>
                <div className="w-full bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 shrink-0 mt-0.5">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-amber-600 dark:text-amber-400">¿No recibiste el correo?</p>
                    <p className="text-xs text-amber-500/70 dark:text-amber-400/70 mt-0.5">Revisa tu bandeja de spam o correo no deseado.</p>
                  </div>
                </div>
                  {verifyUrl && (
                  <a href={verifyUrl}
                    className="w-full h-11 rounded-xl border-2 border-green-500/30 text-green-600 dark:text-green-400 font-semibold text-sm hover:bg-green-500/5 transition-all duration-200 flex items-center justify-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    Haz clic aquí para verificar manualmente
                  </a>
                  )}
                <button onClick={handleResend} disabled={resending}
                  className="w-full h-11 rounded-xl border-2 border-primary/30 text-primary font-semibold text-sm hover:bg-primary/5 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50">
                  <RefreshCw size={16} className={resending ? "animate-spin" : ""} />
                  {resending ? "Reenviando..." : "Reenviar mensaje"}
                </button>
                <Link to="/auth" className="w-full h-12 rounded-xl bg-primary text-white font-semibold text-base hover:bg-primary-dark transition-all duration-200 shadow-lg shadow-primary/25 flex items-center justify-center gap-2">
                  Ir a iniciar sesión
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
