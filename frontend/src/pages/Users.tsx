import { useState, useEffect } from "react";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { CalendarPicker, formatDateString } from "@/components/ui/apple-calendar-picker";
import { getUsers, createUser, updateUser, deleteUser } from "@/services/api";
import { useToast } from "@/components/ui/use-toast";

const roleColors: Record<string, string> = {
  admin: "bg-purple-500/20 text-purple-600 dark:text-purple-400",
  bioanalista: "bg-green-500/20 text-green-600 dark:text-green-400",
  recepcionista: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
  paciente: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
};

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  bioanalista: "Bioanalista",
  recepcionista: "Recepcionista",
  paciente: "Paciente",
};

export default function Users() {
  const { toast } = useToast();
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ nombre: "", apellido: "", email: "", password: "", role: "recepcionista", telefono: "", direccion: "", fecha_nacimiento: "", dni: "" });
  const [roleFilter, setRoleFilter] = useState("");

  const filteredUsers = roleFilter ? users.filter((u) => u.role === roleFilter) : users;

  async function load() {
    setLoading(true);
    try {
      const data = await getUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch { }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditId(null);
    setForm({ nombre: "", apellido: "", email: "", password: "", role: "recepcionista", telefono: "", direccion: "", fecha_nacimiento: "", dni: "" });
    setShowForm(true);
  }

  function openEdit(u: Record<string, unknown>) {
    setEditId(u.id as number);
    setForm({
      nombre: u.nombre as string || "",
      apellido: u.apellido as string || "",
      email: u.email as string || "",
      password: "",
      role: u.role as string || "recepcionista",
      telefono: u.telefono as string || "",
      direccion: u.direccion as string || "",
      fecha_nacimiento: u.fecha_nacimiento as string || "",
      dni: u.dni as string || "",
    });
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editId) {
        const { password, ...rest } = form;
        await updateUser(editId, password ? form : rest);
        toast("Usuario actualizado", "success");
      } else {
        await createUser(form);
        toast("Usuario creado", "success");
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error");
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`¿Eliminar a ${name}? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteUser(id);
      toast("Usuario eliminado", "success");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Usuarios</h1>
          <p className="text-sm text-gray-500 dark:text-white/40 mt-1">Gestión de usuarios del sistema</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={18} className="mr-2" /> Nuevo usuario
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-white/40">Cargando...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-white/40">No hay usuarios registrados</div>
      ) : (
        <>
        <div className="flex items-center gap-2 flex-wrap">
          {["", "admin", "bioanalista", "recepcionista", "paciente"].map((r) => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                roleFilter === r
                  ? "bg-gray-900/10 text-gray-900 dark:bg-white/10 dark:text-white"
                  : "text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[0.04] dark:text-white/40"
              }`}>
              {r ? (r.charAt(0).toUpperCase() + r.slice(1)) : "Todos"}
            </button>
          ))}
          <span className="text-xs text-gray-400 ml-auto">{filteredUsers.length} usuario{filteredUsers.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map((u) => (
            <div key={u.id as number} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-white/5 dark:bg-white/[0.02] flex items-center gap-4 group">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                {(u.nombre as string)?.[0]}{(u.apellido as string)?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">{u.nombre as string} {u.apellido as string}</p>
                <p className="text-xs text-gray-500 dark:text-white/40 truncate">{u.email as string}</p>
              </div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${roleColors[u.role as string] || "bg-gray-500/20 text-gray-600 dark:text-white/50"}`}>
                {roleLabels[u.role as string] || (u.role as string)}
              </span>
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg text-gray-400 hover:text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 transition-all" title="Editar">
                  <Edit size={14} />
                </button>
                <button onClick={() => handleDelete(u.id as number, `${u.nombre} ${u.apellido}`)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all" title="Eliminar">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
        </>
      )}

      <Dialog open={showForm} onClose={() => setShowForm(false)} title={editId ? "Editar usuario" : "Nuevo usuario"}>
        <form onSubmit={handleSave} className="space-y-4">
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
          <div>
            <label className="block text-sm text-gray-500 dark:text-white/40 mb-1">Email</label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm text-gray-500 dark:text-white/40 mb-1">{editId ? "Nueva contraseña (dejar vacío para mantener)" : "Contraseña"}</label>
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editId} />
          </div>
          <div>
            <label className="block text-sm text-gray-500 dark:text-white/40 mb-1">Rol</label>
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="admin">Administrador</option>
              <option value="recepcionista">Recepcionista</option>
              <option value="bioanalista">Bioanalista</option>
              <option value="paciente">Paciente</option>
            </Select>
          </div>
          {form.role === "paciente" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-500 dark:text-white/40 mb-1">Teléfono</label>
                <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm text-gray-500 dark:text-white/40 mb-1">DNI</label>
                <Input value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} maxLength={8} />
              </div>
              <div>
                <label className="block text-sm text-gray-500 dark:text-white/40 mb-1">Dirección</label>
                <Input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm text-gray-500 dark:text-white/40 mb-1">Fecha de nacimiento</label>
                <CalendarPicker
                  value={form.fecha_nacimiento ? (() => { const [y,m,d] = form.fecha_nacimiento.split("-").map(Number); return new Date(y,m-1,d); })() : null}
                  onChange={(date) => setForm({ ...form, fecha_nacimiento: formatDateString(date) })}
                  placeholder="Seleccionar fecha"
                />
              </div>
            </div>
          )}
          <Button type="submit" className="w-full">{editId ? "Guardar cambios" : "Crear usuario"}</Button>
        </form>
      </Dialog>
    </div>
  );
}
