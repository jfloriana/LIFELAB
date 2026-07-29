import { useState, useEffect } from "react";
import { Plus, Search, Edit, Trash2, Mail, Phone, MapPin, IdCard, ChevronDown, ChevronUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { CalendarPicker, formatDateString, normalizeDateString, parseDateString } from "@/components/ui/apple-calendar-picker";
import { getPacientes, createPaciente, updatePaciente, buscarPacientes, deleteUser } from "@/services/api";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export default function Pacientes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pacientes, setPacientes] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ nombre: "", apellido: "", email: "", password: "", dni: "", telefono: "", direccion: "", fecha_nacimiento: "" });
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  async function load() {
    setLoading(true);
    try {
      const data = await getPacientes();
      setPacientes(data);
    } catch { }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSearch(q: string) {
    setSearch(q);
    if (q.length < 2) { load(); return; }
    setLoading(true);
    try {
      const data = await buscarPacientes(q);
      setPacientes(data);
    } catch { }
    setLoading(false);
  }

  function openCreate() {
    setEditId(null);
    setForm({ nombre: "", apellido: "", email: "", password: "", dni: "", telefono: "", direccion: "", fecha_nacimiento: "" });
    setShowForm(true);
  }

  async function openEdit(p: Record<string, unknown>) {
    setEditId(p.id as number);
    setForm({
      nombre: p.nombre as string || "",
      apellido: p.apellido as string || "",
      email: p.email as string || "",
      password: "",
      dni: p.dni as string || "",
      telefono: p.telefono as string || "",
      direccion: p.direccion as string || "",
      fecha_nacimiento: p.fecha_nacimiento ? normalizeDateString(p.fecha_nacimiento as string) : "",
    });
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editId) {
        const { password, ...rest } = form;
        await updatePaciente(editId, password ? form : rest);
      } else {
        await createPaciente(form);
      }
      setShowForm(false);
      load();
      toast(editId ? "Paciente actualizado exitosamente" : "Paciente creado exitosamente", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error");
    }
  }

  const canCreate = user && ["admin", "recepcionista"].includes(user.role);
  const isAdmin = user?.role === "admin";

  async function handleDelete(userId: number, name: string) {
    if (!confirm(`¿Eliminar a ${name}? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteUser(userId);
      toast("Paciente eliminado", "success");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

  function toggleExpand(id: number) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pacientes</h1>
          <p className="text-sm text-gray-500 dark:text-white/40 mt-1">Gestión de pacientes del laboratorio</p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus size={18} className="mr-2" /> Nuevo paciente
          </Button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input className="pl-10" placeholder="Buscar por nombre, email o DNI..." value={search} onChange={(e) => handleSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border border-gray-200 dark:border-white/10 p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-white/10" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-2/3" />
                  <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-1/2" />
                </div>
              </div>
              <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : pacientes.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 dark:bg-white/[0.03] flex items-center justify-center mb-4">
            <Users size={28} className="text-gray-300 dark:text-white/30" />
          </div>
          <p className="text-gray-500 dark:text-white/40">No se encontraron pacientes</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pacientes.map((p) => {
            const isExpanded = expanded[p.id as number];
            return (
              <div key={p.id as number} className="rounded-xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/[0.02] overflow-hidden transition-all hover:shadow-md hover:border-cyan-500/30 group">
                <button onClick={() => toggleExpand(p.id as number)} className="w-full text-left p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {(p.nombre as string)?.[0]}{(p.apellido as string)?.[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {p.nombre as string} {p.apellido as string}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-white/40 truncate">{p.email as string}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-blue-500/15 text-blue-600 dark:text-blue-400">
                        {p.dni as string || "—"}
                      </span>
                      {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-3 text-xs text-gray-400 dark:text-white/30">
                    {!!p.telefono && (
                      <span className="flex items-center gap-1">
                        <Phone size={11} /> {p.telefono as string}
                      </span>
                    )}
                    {!!p.direccion && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin size={11} /> {p.direccion as string}
                      </span>
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-white/5 px-5 py-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail size={14} className="text-gray-400 shrink-0" />
                      <span className="text-gray-600 dark:text-white/50">{p.email as string}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <IdCard size={14} className="text-gray-400 shrink-0" />
                      <span className="text-gray-600 dark:text-white/50">DNI: {p.dni as string || "—"}</span>
                    </div>
                    {!!p.telefono && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone size={14} className="text-gray-400 shrink-0" />
                        <span className="text-gray-600 dark:text-white/50">{p.telefono as string}</span>
                      </div>
                    )}
                    {!!p.direccion && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin size={14} className="text-gray-400 shrink-0" />
                        <span className="text-gray-600 dark:text-white/50">{p.direccion as string}</span>
                      </div>
                    )}
                    {canCreate && (
                      <div className="pt-2 flex gap-2">
                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(p); }} className="w-full">
                          <Edit size={14} className="mr-1.5" /> Editar
                        </Button>
                        {isAdmin && (
                          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(p.user_id as number, `${p.nombre} ${p.apellido}`); }} className="w-full text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20">
                            <Trash2 size={14} className="mr-1.5" /> Eliminar
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onClose={() => setShowForm(false)} title={editId ? "Editar paciente" : "Nuevo paciente"}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-white/30 mb-3">Información personal</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-500 dark:text-white/40 mb-1">Nombre</label>
                <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value.toUpperCase() })} required />
              </div>
              <div>
                <label className="block text-sm text-gray-500 dark:text-white/40 mb-1">Apellido</label>
                <Input value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value.toUpperCase() })} required />
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-white/30 mb-3">Contacto</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-500 dark:text-white/40 mb-1">Email</label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm text-gray-500 dark:text-white/40 mb-1">Teléfono</label>
                <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-white/30 mb-3">Identificación</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-500 dark:text-white/40 mb-1">DNI</label>
                <Input value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} maxLength={8} required />
              </div>
              <div>
                <label className="block text-sm text-gray-500 dark:text-white/40 mb-1">Fecha de nacimiento</label>
                <CalendarPicker
                  value={parseDateString(form.fecha_nacimiento)}
                  onChange={(date) => setForm({ ...form, fecha_nacimiento: formatDateString(date) })}
                  placeholder="Seleccionar fecha"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-500 dark:text-white/40 mb-1">Dirección</label>
              <Input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm text-gray-500 dark:text-white/40 mb-1">{editId ? "Nueva contraseña" : "Contraseña"}</label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editId} />
            </div>
          </div>

          <Button type="submit" className="w-full">{editId ? "Guardar cambios" : "Crear paciente"}</Button>
        </form>
      </Dialog>
    </div>
  );
}
