import React, { useState, useEffect, useMemo } from 'react';
import {
  Home,
  User,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Calendar,
  ClipboardList,
  Star,
  Users,
  LayoutDashboard,
  FileText,
  FileSpreadsheet,
  Stethoscope,
  FlaskConical,
  Upload,
} from 'lucide-react';

interface NavigationItem {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: string;
}

interface SidebarProps {
  className?: string;
  currentPath?: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  userName?: string;
  userRole?: string;
}

const navByRole: Record<string, NavigationItem[]> = {
  admin: [
    { id: "dashboard", name: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    { id: "citas", name: "Calendario", icon: Calendar, href: "/citas" },
    { id: "agendar-cita", name: "Agendar Cita", icon: ClipboardList, href: "/agendar-cita" },
    { id: "pacientes", name: "Pacientes", icon: Users, href: "/pacientes" },
    { id: "resultados", name: "Resultados", icon: FileText, href: "/resultados" },
    { id: "users", name: "Usuarios", icon: User, href: "/users" },
    { id: "reportes", name: "Reportes", icon: FileSpreadsheet, href: "/reportes" },
    { id: "resenas", name: "Reseñas", icon: Star, href: "/resenas" },
    { id: "perfil", name: "Mi Perfil", icon: Settings, href: "/perfil" },
  ],
  recepcionista: [
    { id: "dashboard", name: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    { id: "citas", name: "Calendario", icon: Calendar, href: "/citas" },
    { id: "agendar-cita", name: "Agendar Cita", icon: ClipboardList, href: "/agendar-cita" },
    { id: "pacientes", name: "Pacientes", icon: Users, href: "/pacientes" },
    { id: "resultados", name: "Resultados", icon: FileText, href: "/resultados" },
    { id: "reportes", name: "Reportes", icon: FileSpreadsheet, href: "/reportes" },
    { id: "perfil", name: "Mi Perfil", icon: Settings, href: "/perfil" },
  ],
  bioanalista: [
    { id: "dashboard", name: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    { id: "citas", name: "Citas", icon: Calendar, href: "/citas" },
    { id: "analisis-pendientes", name: "Análisis Pendientes", icon: FlaskConical, href: "/analisis-pendientes" },
    { id: "resultados", name: "Resultados", icon: FileText, href: "/resultados" },
    { id: "mis-envios", name: "Mis Envíos", icon: Upload, href: "/mis-envios" },
    { id: "reportes", name: "Reportes", icon: FileSpreadsheet, href: "/reportes" },
    { id: "perfil", name: "Mi Perfil", icon: Settings, href: "/perfil" },
  ],
  paciente: [
    { id: "citas", name: "Mis Citas", icon: Calendar, href: "/citas" },
    { id: "resultados", name: "Mis Resultados", icon: FileText, href: "/resultados" },
    { id: "resenas", name: "Reseñas", icon: Star, href: "/resenas" },
    { id: "perfil", name: "Mi Perfil", icon: Settings, href: "/perfil" },
  ],
};

export function Sidebar({ className = "", currentPath = "/dashboard", onNavigate, onLogout, userName = "Usuario", userRole = "" }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeItem, setActiveItem] = useState("dashboard");

  const navigationItems = useMemo(() => {
    const roleKey = userRole?.toLowerCase() || "";
    return navByRole[roleKey] || [
      { id: "dashboard", name: "Dashboard", icon: Home, href: "/dashboard" },
      { id: "perfil", name: "Mi Perfil", icon: Settings, href: "/perfil" },
    ];
  }, [userRole]);

  useEffect(() => {
    const path = currentPath.split("/")[1] || "dashboard";
    setActiveItem(path);
  }, [currentPath]);

  useEffect(() => {
    const handleResize = () => {
      setIsOpen(window.innerWidth >= 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => setIsOpen(v => !v);
  const toggleCollapse = () => setIsCollapsed(v => !v);

  const handleItemClick = (item: NavigationItem) => {
    setActiveItem(item.id);
    onNavigate(item.href);
    if (window.innerWidth < 768) setIsOpen(false);
  };

  const initials = userName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <>
      <button onClick={toggleSidebar}
        className="fixed top-4 left-4 z-50 rounded-lg bg-white shadow-md dark:bg-[#0a0e1a] dark:border dark:border-white/10 md:hidden hover:bg-gray-50 dark:hover:bg-white/[0.04] p-3"
        aria-label="Toggle sidebar">
        {isOpen ? <X className="h-5 w-5 text-gray-600 dark:text-white/60" /> : <Menu className="h-5 w-5 text-gray-600 dark:text-white/60" />}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden" onClick={toggleSidebar} />
      )}

      <div className={`
        fixed left-0 top-0 z-40 flex h-full flex-col border-r border-gray-200 bg-white transition-all duration-300 dark:border-white/5 dark:bg-[#080c16]
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        ${isCollapsed ? "w-20" : "w-72"}
        md:static md:z-auto md:translate-x-0 ${className}
      `}>
        <div className="flex items-center justify-between border-b border-gray-200 p-5 dark:border-white/5">
          {!isCollapsed && (
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 shadow-sm">
                <Stethoscope className="h-5 w-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold text-gray-900 dark:text-white">LIFELAB</span>
                <span className="text-xs text-gray-500 dark:text-white/40">Portal de Laboratorio</span>
              </div>
            </div>
          )}
          {isCollapsed && (
            <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 shadow-sm">
              <Stethoscope className="h-5 w-5 text-white" />
            </div>
          )}
          <button onClick={toggleCollapse}
            className="hidden rounded-md p-1.5 transition-all hover:bg-gray-100 md:flex dark:hover:bg-white/[0.04]"
            aria-label={isCollapsed ? "Expandir" : "Colapsar"}>
            {isCollapsed ? <ChevronRight className="h-4 w-4 text-gray-500 dark:text-white/40" /> : <ChevronLeft className="h-4 w-4 text-gray-500 dark:text-white/40" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-0.5">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeItem === item.id;
              return (
                <li key={item.id}>
                  <button onClick={() => handleItemClick(item)}
                    className={`
                      group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all
                      ${isActive
                        ? "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400"
                        : "text-gray-600 hover:bg-gray-100 dark:text-white/60 dark:hover:bg-white/[0.04]"
                      }
                      ${isCollapsed ? "justify-center px-2" : ""}
                    `}
                    title={isCollapsed ? item.name : undefined}>
                    <div className="flex min-w-[20px] items-center justify-center">
                      <Icon className={`
                        h-5 w-5 shrink-0
                        ${isActive ? "text-cyan-600 dark:text-cyan-400" : "text-gray-500 group-hover:text-gray-700 dark:text-white/40 dark:group-hover:text-white/60"}
                      `} />
                    </div>
                    {!isCollapsed && <span>{item.name}</span>}
                    {isCollapsed && (
                      <div className="absolute left-full ml-2 z-50 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                        {item.name}
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-auto border-t border-gray-200 dark:border-white/5">
          <div className="border-b border-gray-200 p-3 dark:border-white/5">
            {!isCollapsed ? (
              <div className="flex items-center rounded-lg px-3 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-400 text-sm font-bold text-white">
                  {initials}
                </div>
                <div className="ml-2.5 min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{userName}</p>
                    <p className="truncate text-xs text-gray-500 dark:text-white/40">{userRole.charAt(0).toUpperCase() + userRole.slice(1)}</p>
                </div>
              </div>
            ) : (
              <div className="flex justify-center py-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-400 text-sm font-bold text-white">
                  {initials}
                </div>
              </div>
            )}
          </div>
          <div className="p-3">
            <button onClick={onLogout}
              className={`group relative flex w-full items-center rounded-lg text-left text-sm font-medium text-red-600 transition-all hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 gap-3 px-3 py-2.5 ${isCollapsed ? "justify-center" : ""}`}>
              <LogOut className="h-5 w-5 shrink-0" />
              {!isCollapsed && <span>Cerrar sesión</span>}
              {isCollapsed && (
                <div className="absolute left-full ml-2 z-50 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  Cerrar sesión
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default Sidebar;
