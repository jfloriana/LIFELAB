import { GrainGradient } from "@paper-design/shaders-react";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { register as apiRegister } from "@/services/api";
import { Eye, EyeOff, Activity } from "lucide-react";
import { CalendarPicker } from "@/components/ui/apple-calendar-picker";

interface AuthSectionProps {
  mode: "login" | "register";
}

export default function AuthSection({ mode }: AuthSectionProps) {
  const navigate = useNavigate();
  const { login } = useAuth();
  const isLogin = mode === "login";

  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    email: "",
    password: "",
    confirmPassword: "",
    dni: "",
    fecha_nacimiento: null as Date | null,
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!isLogin && form.password !== form.confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await login(form.email, form.password);
        navigate("/dashboard");
      } else {
        const res = await apiRegister({
          nombre: form.nombre,
          apellido: form.apellido,
          email: form.email,
          password: form.password,
          dni: form.dni,
          fecha_nacimiento: form.fecha_nacimiento
            ? form.fecha_nacimiento.toISOString().slice(0, 10)
            : undefined,
        });
        navigate("/verify-email", { state: { email: form.email, verifyUrl: (res as { verifyUrl?: string }).verifyUrl } });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  };

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
              <Activity className="w-6 sm:w-7 h-6 sm:h-7 text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground dark:text-white">
              {isLogin ? "Inicio de Sesión" : "Crear Cuenta"}
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              {isLogin
                ? "Accede a tu historial clínico y resultados"
                : "Regístrate para acceder al portal de salud"}
            </p>
          </div>

          <div className="bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-xl rounded-2xl border border-gray-200/60 dark:border-white/5 shadow-[0_8px_40px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.3)] p-5 sm:p-8">
            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                {error}
              </div>
            )}
            {success && (
              <div className="mb-5 p-3.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-sm flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-white/40 mb-1.5">Nombre</label>
                      <input type="text" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value.toUpperCase().slice(0, 100) })}
                        className={inputClass} placeholder="JUAN" required maxLength={100} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-white/40 mb-1.5">Apellido</label>
                      <input type="text" value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value.toUpperCase().slice(0, 100) })}
                        className={inputClass} placeholder="PÉREZ" required maxLength={100} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-white/40 mb-1.5">DNI</label>
                    <input type="text" value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value.replace(/\D/g, "").slice(0, 8) })}
                      className={inputClass} placeholder="12345678" required maxLength={8} />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-white/40 mb-1.5">Fecha de nacimiento</label>
                    <CalendarPicker value={form.fecha_nacimiento} onChange={(d) => setForm({ ...form, fecha_nacimiento: d })} placeholder="Seleccionar fecha de nacimiento" />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-white/40 mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value.slice(0, 255) })}
                  className={inputClass} placeholder="correo@ejemplo.com" required maxLength={255} />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-white/40 mb-1.5">Contraseña</label>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value.slice(0, 25) })}
                    className={inputClass + " pr-11"} placeholder="••••••••" required minLength={8} maxLength={25} />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-foreground dark:hover:text-white transition-colors">
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {!isLogin && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-white/40 mb-1.5">Confirmar contraseña</label>
                  <div className="relative">
                    <input type={showConfirmPw ? "text" : "password"} value={form.confirmPassword}
                      onChange={(e) => setForm({ ...form, confirmPassword: e.target.value.slice(0, 25) })}
                      className={inputClass + " pr-11"} placeholder="••••••••" required minLength={8} maxLength={25} />
                    <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-foreground dark:hover:text-white transition-colors">
                      {showConfirmPw ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              )}

              {isLogin && (
                <div className="text-right">
                  <Link to="/forgot-password" className="text-sm text-primary hover:text-primary-dark font-medium transition-colors">
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
              )}

              <button type="submit" disabled={loading}
                className="gradient-btn w-full h-12 rounded-xl text-white font-semibold text-base disabled:opacity-60 shadow-lg shadow-primary/25">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {isLogin ? "Iniciando sesión..." : "Creando cuenta..."}
                  </span>
                ) : (
                  isLogin ? "Iniciar Sesión" : "Crear Cuenta"
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-white/5 text-center">
              <p className="text-sm text-text-muted">
                {isLogin ? (
                  <>
                    ¿No tienes cuenta?{" "}
                    <Link to="/register" className="text-primary font-semibold hover:text-primary-dark transition-colors">Registrarse</Link>
                  </>
                ) : (
                  <>
                    ¿Ya tienes cuenta?{" "}
                    <Link to="/auth" className="text-primary font-semibold hover:text-primary-dark transition-colors">Iniciar Sesión</Link>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
              Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
