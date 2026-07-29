import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { forgotPassword } from "@/services/api";
import { Mail } from "lucide-react";

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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">L</div>
          <h1 className="text-3xl font-bold gradient-text">LIFELAB</h1>
          <p className="text-text-muted mt-2">Recuperar contraseña</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Restablecer contraseña</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">{error}</div>}
              {message && <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm">{message}</div>}
              <div>
                <label className="block text-sm text-text-muted mb-1.5">Email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                <Mail size={16} className="mr-2" />
                {loading ? "Enviando..." : "Enviar instrucciones"}
              </Button>
              <p className="text-center text-sm text-text-muted">
                <Link to="/auth" className="text-primary hover:text-primary-light">Volver al inicio de sesión</Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
