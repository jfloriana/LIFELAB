import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Sidebar } from "@/components/ui/modern-side-bar";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  if (!user) return null;

  const roleMap: Record<string, string> = {
    admin: "Administrador",
    recepcionista: "Recepcionista",
    bioanalista: "Bioanalista",
    paciente: "Paciente",
  };

  async function handleLogout() {
    await logout();
    navigate("/auth");
  }

  const userName = `${user.nombre || ""} ${user.apellido || ""}`.trim() || "Usuario";
  const userRole = roleMap[user.role as string] || user.role;

  return (
    <div className="flex h-dvh bg-gray-50 dark:bg-[#0a0e1a]">
      <Sidebar
        currentPath={location.pathname}
        onNavigate={(path) => navigate(path)}
        onLogout={handleLogout}
        userName={userName}
        userRole={user.role}
      />
      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex h-16 items-center justify-end gap-3 border-b border-gray-200 bg-white/80 px-4 sm:px-6 backdrop-blur-sm dark:border-white/5 dark:bg-[#080c16]/80">
          <ThemeToggle isDark={isDark} onToggle={() => setIsDark(!isDark)} />
        </header>
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
