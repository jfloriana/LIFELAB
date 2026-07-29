import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/components/ui/use-toast";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "@/components/Layout";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import VerifyEmail from "@/pages/VerifyEmail";
import Dashboard from "@/pages/Dashboard";
import Pacientes from "@/pages/Pacientes";
import Citas from "@/pages/Citas";
import AgendarCita from "@/pages/AgendarCita";
import Resultados from "@/pages/Resultados";
import Users from "@/pages/Users";
import Perfil from "@/pages/Perfil";
import Resenas from "@/pages/Resenas";
import Reportes from "@/pages/Reportes";
import AnalisisPendientes from "@/pages/AnalisisPendientes";
import MisEnvios from "@/pages/MisEnvios";
import Compartido from "@/pages/Compartido";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/compartido/:token" element={<Compartido />} />

          <Route element={<ProtectedRoute><Outlet /></ProtectedRoute>}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/pacientes" element={<ProtectedRoute roles={["admin", "recepcionista"]}><Pacientes /></ProtectedRoute>} />
              <Route path="/citas" element={<Citas />} />
              <Route path="/agendar-cita" element={<AgendarCita />} />
              <Route path="/resultados" element={<Resultados />} />
              <Route path="/users" element={<ProtectedRoute roles={["admin"]}><Users /></ProtectedRoute>} />
              <Route path="/perfil" element={<Perfil />} />
              <Route path="/analisis-pendientes" element={<ProtectedRoute roles={["bioanalista"]}><AnalisisPendientes /></ProtectedRoute>} />
              <Route path="/mis-envios" element={<ProtectedRoute roles={["bioanalista"]}><MisEnvios /></ProtectedRoute>} />
              <Route path="/resenas" element={<ProtectedRoute roles={["paciente", "admin"]}><Resenas /></ProtectedRoute>} />
              <Route path="/reportes" element={<ProtectedRoute roles={["admin", "recepcionista", "bioanalista"]}><Reportes /></ProtectedRoute>} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
