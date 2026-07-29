import { useState } from "react";
import { Eye, EyeOff, Save, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { updateProfile } from "@/services/api";

export default function Perfil() {
  const { user } = useAuth();
  const [form, setForm] = useState({ nombre: user?.nombre || "", apellido: user?.apellido || "", email: user?.email || "", password: "", dni: user?.dni || "", telefono: user?.telefono || "", direccion: user?.direccion || "" });
  const [showPw, setShowPw] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const payload = { ...form };
      if (!payload.password) delete (payload as { password?: string }).password;
      const res = await updateProfile(payload);
      setMessage(res.mensaje);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mi Perfil</h1>
        <p className="text-sm text-gray-500 dark:text-white/40 mt-1">Edita tu información personal</p>
      </div>

      <div className="flex justify-center">
        <div className="w-full max-w-lg">
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-white/5 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-white/5">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
              <User className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{user?.nombre || "Usuario"}</h3>
              <p className="text-sm text-gray-500 dark:text-white/40">{user?.email || ""}</p>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">{error}</div>}
            {message && <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-sm">{message}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-500 dark:text-white/40 mb-1.5">Nombre</label>
                <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <label className="block text-sm text-gray-500 dark:text-white/40 mb-1.5">Apellido</label>
                <Input value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value.toUpperCase() })} />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-500 dark:text-white/40 mb-1.5">Email</label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm text-gray-500 dark:text-white/40 mb-1.5">DNI</label>
              <Input value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} maxLength={8} />
            </div>
            <div>
              <label className="block text-sm text-gray-500 dark:text-white/40 mb-1.5">Nueva contraseña (dejar vacío para mantener)</label>
              <div className="relative">
                <Input type={showPw ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900 dark:hover:text-white">
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-500 dark:text-white/40 mb-1.5">Teléfono</label>
              <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm text-gray-500 dark:text-white/40 mb-1.5">Dirección</label>
              <Input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              <Save size={16} className="mr-2" /> Guardar cambios
            </Button>
          </form>
        </div>
      </div>
    </div>
  </div>
  );
}
