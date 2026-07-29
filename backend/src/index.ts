import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { createDatabase } from "./config/database";
import authRoutes from "./routes/auth";
import pacientesRoutes from "./routes/pacientes";
import citasRoutes from "./routes/citas";
import resultadosRoutes from "./routes/resultados";
import usersRoutes from "./routes/users";
import reportesRoutes from "./routes/reportes";
import analisisRoutes from "./routes/analisis";
import resenasRoutes from "./routes/resenas";
import compartidoRoutes from "./routes/compartido";
import type { Request, Response, NextFunction } from "express";

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3001;

let FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
if (FRONTEND_URL === "*") {
  console.warn("⚠️  FRONTEND_URL está configurado como '*'. Esto permite que cualquier sitio web acceda a la API. Configura una URL específica en producción.");
}
if (FRONTEND_URL !== "*" && !/^https?:\/\//.test(FRONTEND_URL)) {
  FRONTEND_URL = `https://${FRONTEND_URL}`;
}

console.log(`📡 FRONTEND_URL: ${FRONTEND_URL}`);
console.log(`📧 SendGrid ${process.env.SENDGRID_API_KEY ? "configurado" : "NO configurado"}`);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(morgan("short", { skip: (_req, res) => res.statusCode < 400 }));
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 200 : 10000,
  message: { error: "Demasiadas solicitudes. Intenta de nuevo más tarde." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: "Demasiadas solicitudes. Intenta de nuevo más tarde." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/auth", authRoutes);
app.use("/api/pacientes", pacientesRoutes);
app.use("/api/citas", citasRoutes);
app.use("/api/resultados", resultadosRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/reportes", reportesRoutes);
app.use("/api/analisis", analisisRoutes);
app.use("/api/resenas", resenasRoutes);
app.use("/api/compartido", publicLimiter, compartidoRoutes);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const message = err?.message || "";
  if (message === "Solo se permiten archivos PDF") {
    res.status(400).json({ error: message });
    return;
  }
  const errCode = (err as unknown as { code?: string }).code;
  if (message.includes("File too large") || errCode === "LIMIT_FILE_SIZE") {
    res.status(400).json({ error: "El archivo excede el límite de 10MB" });
    return;
  }
  console.error("Error no manejado:", err);
  res.status(500).json({ error: "Error interno del servidor" });
});

async function start() {
  await createDatabase();
  console.log("Base de datos inicializada");

  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
}

start();
