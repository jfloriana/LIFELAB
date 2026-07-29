import { useState, useEffect } from "react";
import { Star, MessageSquare, Pencil, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { getResenas, getResenasAprobadas, createResena, updateResena, aprobarResena } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";

function StarSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <button key={s} type="button" onClick={() => onChange(s)} className="transition-all duration-200 hover:scale-125 active:scale-90">
          <Star size={28} className={`transition-all duration-200 ${
            s <= value ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" : "text-gray-300 dark:text-white/30"
          }`} />
        </button>
      ))}
    </div>
  );
}

function StarDisplay({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} size={size} className={`transition-all ${
          s <= value ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.3)]" : "text-gray-300 dark:text-white/30"
        }`} />
      ))}
    </div>
  );
}

export default function Resenas() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [resenas, setResenas] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ texto: "", estrellas: 5 });
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const isPaciente = user?.role === "paciente";
  const isAdmin = user?.role === "admin";

  async function load() {
    setLoading(true);
    try {
      if (isAdmin) {
        const data = await getResenas();
        const arr = Array.isArray(data) ? data : [];
        setResenas(arr.filter((r) => r.aprobado !== 1 && r.aprobado !== 0));
      } else if (isPaciente) {
        const data = await getResenasAprobadas();
        const arr = Array.isArray(data) ? data : [];
        setResenas(arr.filter((r) => (r.user_id as number) === user!.id));
      }
    } catch { }
    setLoading(false);
  }

  useEffect(() => { load(); }, [isAdmin, isPaciente, user]);

  function openCreate() {
    setEditingId(null);
    setForm({ texto: "", estrellas: 5 });
    setShowForm(true);
  }

  function openEdit(r: Record<string, unknown>) {
    setEditingId(r.id as number);
    setForm({ texto: r.texto as string, estrellas: r.estrellas as number });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        await updateResena(editingId, form);
        toast("Reseña actualizada. Será revisada nuevamente.", "success");
      } else {
        await createResena(form);
        toast("Reseña creada. Será publicada tras revisión.", "success");
      }
      setShowForm(false);
      setForm({ texto: "", estrellas: 5 });
      setEditingId(null);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error");
    }
    setSubmitting(false);
  }

  async function handleAprobar(id: number) {
    try {
      await aprobarResena(id, true);
      toast("Reseña aprobada", "success");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error");
    }
  }

  async function handleRechazar(id: number) {
    try {
      await aprobarResena(id, false);
      toast("Reseña rechazada", "success");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reseñas</h1>
          <p className="text-sm text-gray-500 dark:text-white/40 mt-1">
            {isAdmin ? "Administrar reseñas de pacientes" : "Opiniones de nuestros pacientes"}
          </p>
        </div>
        {isPaciente && (
          <Button onClick={openCreate} className="gap-2">
            <MessageSquare size={16} />
            Dejar reseña
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-white/40">Cargando...</div>
      ) : resenas.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 dark:text-white/30 text-lg">No hay reseñas aún</p>
          {isPaciente && (
            <p className="text-gray-400 dark:text-white/20 text-sm mt-1">
              Sé el primero en compartir tu experiencia
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {resenas.map((r) => {
            const esPropia = isPaciente && user && (r.user_id as number) === user.id;
            const aprobado = r.aprobado === 1 || r.aprobado === true;
            const pendiente = r.aprobado === 0 || r.aprobado === false;

            return (
              <div key={r.id as number} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-white/5 dark:bg-white/[0.02]">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <StarDisplay value={r.estrellas as number} size={16} />
                    {isAdmin && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        aprobado ? "bg-green-500/20 text-green-600 dark:text-green-400" : pendiente ? "bg-red-500/20 text-red-600 dark:text-red-400" : "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                      }`}>
                        {aprobado ? "Aprobada" : pendiente ? "Rechazada" : "Pendiente"}
                      </span>
                    )}
                    {esPropia && !aprobado && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-500/20 text-yellow-600 dark:text-yellow-400">
                        Pendiente de revisión
                      </span>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => handleAprobar(r.id as number)} className="p-1.5 rounded-lg text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 transition-all" title="Aprobar">
                        <CheckCircle2 size={16} />
                      </button>
                      <button onClick={() => handleRechazar(r.id as number)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all" title="Rechazar">
                        <XCircle size={16} />
                      </button>
                    </div>
                  )}
                  {esPropia && (
                    <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-gray-400 hover:text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 transition-all" title="Editar reseña">
                      <Pencil size={14} />
                    </button>
                  )}
                </div>

                <p className="text-gray-700 dark:text-white/70 text-sm leading-relaxed mt-3">
                  {r.texto as string}
                </p>

                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white/80">
                      {r.nombre as string}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">
                      {new Date(r.created_at as string).toLocaleDateString("es-PE", { year: "numeric", month: "long", day: "numeric" })}
                    </p>
                  </div>
                  {isAdmin && !aprobado && (
                    <span className="text-xs text-gray-400 dark:text-white/30">
                      {(r.email as string) || ""}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onClose={() => !submitting && setShowForm(false)} title={editingId ? "Editar reseña" : "Dejar reseña"}>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-white/60 mb-2">Calificación</label>
            <StarSelector value={form.estrellas} onChange={(v) => setForm({ ...form, estrellas: v })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-white/60 mb-2">Comentario</label>
            <textarea
              value={form.texto}
              onChange={(e) => setForm({ ...form, texto: e.target.value })}
              required
              placeholder="Comparte tu experiencia..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] text-gray-900 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-sky-400/50 focus:border-sky-400/50 transition-all duration-200 min-h-[120px] resize-none text-sm"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)} className="flex-1" disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? "Enviando..." : editingId ? "Guardar cambios" : "Enviar reseña"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
