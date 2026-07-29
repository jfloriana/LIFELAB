import { Pool } from "pg";
import fs from "fs";
import bcrypt from "bcryptjs";

let pool: Pool;

async function initPool() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("DATABASE_URL no está configurada en .env");

  const match = rawUrl.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+?)(\?.*)?$/);
  if (!match) throw new Error("DATABASE_URL formato inválido");

  const [, user, password, host, port, database] = match;
  const decodedUser = decodeURIComponent(user);
  const decodedPassword = decodeURIComponent(password);

  const sslCaPath = process.env.DB_SSL_CA_PATH;
  const sslConfig: { rejectUnauthorized: boolean; ca?: string } = {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
  };
  if (sslCaPath && fs.existsSync(sslCaPath)) {
    sslConfig.ca = fs.readFileSync(sslCaPath).toString();
    sslConfig.rejectUnauthorized = true;
  }
  if (!sslConfig.rejectUnauthorized) {
    console.warn("⚠️  Verificación SSL de BD deshabilitada. Para produción, configura DB_SSL_CA_PATH con el certificado CA.");
  }

  pool = new Pool({
    user: decodedUser,
    password: decodedPassword,
    host,
    port: parseInt(port),
    database,
    ssl: sslConfig,
    max: 5,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 30000,
  });

  pool.on("error", (err) => {
    console.error("Error inesperado en el pool de conexiones:", err.message);
  });
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function queryWithRetry(sql: string, params?: unknown[], retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await pool.query(sql, params);
    } catch (err: unknown) {
      if (attempt === retries) throw err;
      console.error(`Error de conexión (intento ${attempt}/${retries}):`, (err as Error).message);
      await sleep(2000 * attempt);
    }
  }
  throw new Error("No se pudo conectar después de varios intentos");
}

function convertParams(sql: string, params?: unknown[]): { text: string; values: unknown[] } {
  if (!params || params.length === 0) return { text: sql, values: [] };
  let i = 0;
  const text = sql.replace(/\?/g, () => `$${++i}`);
  return { text, values: params };
}

const db = {
  async exec(sql: string, params?: unknown[]) {
    const { text, values } = convertParams(sql, params);
    const result = await queryWithRetry(text, values as string[]);
    if (!result.fields.length) return [];
    return [{
      columns: result.fields.map((f) => f.name),
      values: result.rows.map((r) => Object.values(r)),
    }];
  },
  async run(sql: string, params?: unknown[]) {
    const { text, values } = convertParams(sql, params);
    await queryWithRetry(text, values as string[]);
  },
};

export async function createDatabase() {
  await initPool();
  await queryWithRetry("SELECT 1");

  await queryWithRetry(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      apellido TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'paciente',
      token_version INTEGER DEFAULT 0,
      email_verified BOOLEAN DEFAULT FALSE,
      email_verification_token TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await queryWithRetry(`
    CREATE TABLE IF NOT EXISTS pacientes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      telefono TEXT DEFAULT '',
      direccion TEXT DEFAULT '',
      fecha_nacimiento DATE,
      dni TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await queryWithRetry(`
    CREATE TABLE IF NOT EXISTS doctores (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await queryWithRetry(`
    CREATE TABLE IF NOT EXISTS citas (
      id SERIAL PRIMARY KEY,
      paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
      fecha DATE NOT NULL,
      hora_inicio TIME NOT NULL,
      hora_fin TIME NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'analisis',
      estado TEXT NOT NULL DEFAULT 'pendiente',
      notas TEXT,
      registrado_por INTEGER REFERENCES users(id) ON DELETE SET NULL,
      medico TEXT DEFAULT '',
      idx TEXT DEFAULT '',
      analisis_solicitados TEXT DEFAULT '[]',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await queryWithRetry(`
    CREATE TABLE IF NOT EXISTS analisis (
      id SERIAL PRIMARY KEY,
      cita_id INTEGER NOT NULL REFERENCES citas(id) ON DELETE CASCADE,
      test_id TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'pendiente',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await queryWithRetry(`
    CREATE TABLE IF NOT EXISTS resultados (
      id SERIAL PRIMARY KEY,
      paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
      subido_por INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tipo TEXT NOT NULL DEFAULT 'analisis',
      titulo TEXT NOT NULL,
      archivo_nombre TEXT NOT NULL,
      archivo_path TEXT NOT NULL,
      cita_id INTEGER REFERENCES citas(id) ON DELETE SET NULL,
      compartido_token TEXT UNIQUE,
      compartido_expira TIMESTAMP,
      estado TEXT NOT NULL DEFAULT 'pendiente',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Ensure compartido_expira column exists (for existing databases)
  try {
    await queryWithRetry("SELECT compartido_expira FROM resultados LIMIT 1");
  } catch {
    await queryWithRetry("ALTER TABLE resultados ADD COLUMN compartido_expira TIMESTAMP");
  }

  // Ensure estado column exists
  try {
    await queryWithRetry("SELECT estado FROM resultados LIMIT 1");
  } catch {
    await queryWithRetry("ALTER TABLE resultados ADD COLUMN estado TEXT NOT NULL DEFAULT 'pendiente'");
  }

  // Ensure archivo_data column exists (persistencia en BD)
  try {
    await queryWithRetry("SELECT archivo_data FROM resultados LIMIT 1");
  } catch {
    await queryWithRetry("ALTER TABLE resultados ADD COLUMN archivo_data BYTEA");
  }

  // Ensure token_version column exists
  try {
    await queryWithRetry("SELECT token_version FROM users LIMIT 1");
  } catch {
    await queryWithRetry("ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0");
  }

  // Ensure email_verified column exists
  try {
    await queryWithRetry("SELECT email_verified FROM users LIMIT 1");
  } catch {
    await queryWithRetry("ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE");
  }

  // Ensure email_verification_token column exists
  try {
    await queryWithRetry("SELECT email_verification_token FROM users LIMIT 1");
  } catch {
    await queryWithRetry("ALTER TABLE users ADD COLUMN email_verification_token TEXT");
  }

  await queryWithRetry(`
    CREATE TABLE IF NOT EXISTS resenas (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      nombre TEXT NOT NULL,
      texto TEXT NOT NULL,
      estrellas INTEGER DEFAULT 5,
      aprobado INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await queryWithRetry(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  const { rows: existing } = await queryWithRetry("SELECT COUNT(*) as cnt FROM users");
  if (Number(existing[0]?.cnt) === 0) {
    const users = [
      { nombre: "Admin", apellido: "Principal", email: "admin@clinica.com", password: bcrypt.hashSync("Admin@2025Lifelab", 10), role: "admin" },
      { nombre: "Ana", apellido: "López", email: "bioanalista@clinica.com", password: bcrypt.hashSync("Bio@2025Lifelab", 10), role: "bioanalista" },
      { nombre: "Rosa", apellido: "Martínez", email: "recepcionista@clinica.com", password: bcrypt.hashSync("Recepc@2025Lifelab", 10), role: "recepcionista" },
      { nombre: "María", apellido: "García", email: "paciente@clinica.com", password: bcrypt.hashSync("Paciente@2025Lifelab", 10), role: "paciente" },
    ];

    for (const u of users) {
      const { rows: exist } = await queryWithRetry("SELECT id FROM users WHERE email = $1", [u.email]);
      if (!exist.length) {
        const { rows: newUser } = await queryWithRetry(
          "INSERT INTO users (nombre, apellido, email, password, role, email_verified) VALUES ($1, $2, $3, $4, $5, TRUE) RETURNING id",
          [u.nombre, u.apellido, u.email, u.password, u.role]
        );
        if (u.role === "paciente") {
          await queryWithRetry("INSERT INTO pacientes (user_id) VALUES ($1) ON CONFLICT DO NOTHING", [newUser[0].id]);
        }
      }
    }

    await queryWithRetry(
      "INSERT INTO pacientes (user_id) SELECT id FROM users WHERE email = 'paciente@clinica.com' AND NOT EXISTS (SELECT 1 FROM pacientes WHERE user_id = users.id)"
    );

    const { rows: reviewCount } = await queryWithRetry("SELECT COUNT(*) as cnt FROM resenas");
    if (Number(reviewCount[0]?.cnt) === 0) {
      const { rows: pacUser } = await queryWithRetry("SELECT id FROM users WHERE email = 'paciente@clinica.com'");
      const pacUserId = pacUser[0]?.id || 4;
      const reviews = [
        { nombre: "María García", texto: "La atención es excelente...", estrellas: 5 },
        { nombre: "Carlos Mendoza", texto: "El sistema de agenda online me ahorra mucho tiempo...", estrellas: 5 },
        { nombre: "Ana López", texto: "El equipo de soporte es excepcional...", estrellas: 4 },
        { nombre: "Roberto Sánchez", texto: "Desde que uso el portal de la clínica...", estrellas: 5 },
        { nombre: "Laura Fernández", texto: "La plataforma es muy intuitiva...", estrellas: 4 },
      ];
      for (const r of reviews) {
        await queryWithRetry(
          "INSERT INTO resenas (user_id, nombre, texto, estrellas, aprobado) VALUES ($1, $2, $3, $4, 1)",
          [pacUserId, r.nombre, r.texto, r.estrellas]
        );
      }
    }
  }
}

export function getDatabase() {
  return db;
}

export async function closeDatabase() {
  await pool.end();
}
