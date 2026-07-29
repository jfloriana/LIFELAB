import { Router } from "express";
import { query, validationResult } from "express-validator";
import { authMiddleware } from "../middleware/auth";
import { getDatabase } from "../config/database";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";

const router = Router();
router.use(authMiddleware);

// ── Constants ────────────────────────────────────────────────────────────

const C = {
  primary: "#0EA5E9",
  primaryDark: "#0369A1",
  headerBg: "#0F172A",
  accent: "#0284C7",
  text: "#1E293B",
  textLight: "#64748B",
  border: "#CBD5E1",
  rowEven: "#F1F5F9",
  success: "#10B981",
  warning: "#F59E0B",
  info: "#3B82F6",
  white: "#FFFFFF",
};

// ── PDF Helpers ──────────────────────────────────────────────────────────

function drawHeaderBar(doc: typeof PDFDocument.prototype, subtitle: string) {
  doc.rect(25, 20, doc.page.width - 50, 32).fill(C.headerBg);
  doc.rect(25, 52, doc.page.width - 50, 3).fill(C.accent);
  doc.fill(C.white).font("Helvetica-Bold").fontSize(16).text("LIFELAB", 35, 26);
  doc.fontSize(7).fillColor("#94A3B8").text(subtitle, doc.page.width - 35, 28, { width: 140, align: "right" });
  doc.fillColor(C.text);
  doc.y = 62;
}

function drawTitle(doc: typeof PDFDocument.prototype, title: string, fechaInicio?: string, fechaFin?: string) {
  doc.y += 8;
  doc.font("Helvetica-Bold").fontSize(16).fillColor(C.headerBg).text(title, 25, doc.y, { width: doc.page.width - 50, align: "center" });
  doc.y += 20;
  if (fechaInicio && fechaFin) {
    doc.font("Helvetica").fontSize(8).fillColor(C.textLight).text(`Período: ${fechaInicio} al ${fechaFin}`, 25, doc.y, { width: doc.page.width - 50, align: "center" });
    doc.y += 14;
  }
  doc.font("Helvetica").fontSize(8).fillColor(C.textLight).text(`Generado: ${new Date().toLocaleString("es-MX")}`, 25, doc.y, { width: doc.page.width - 50, align: "center" });
  doc.y += 18;
  doc.fillColor(C.text);
}

function drawFooter(doc: typeof PDFDocument.prototype, pageNum: number, totalPages: number) {
  const lineY = doc.page.height - 38;
  const textY = doc.page.height - 34;
  doc.rect(25, lineY, doc.page.width - 50, 0.5).fill(C.border);
  doc.fontSize(7).fillColor(C.textLight);
  doc.text("LIFELAB — Documento Confidencial", 25, textY);
  doc.text(`Pág. ${pageNum} de ${totalPages}`, doc.page.width - 25, textY, { width: 80, align: "right" });
  doc.fillColor(C.text);
}

function sectionTitle(doc: typeof PDFDocument.prototype, text: string) {
  doc.moveDown(1);
  doc.font("Helvetica-Bold").fontSize(10).fillColor(C.accent).text(text, 25, doc.y, { width: doc.page.width - 50 });
  const ty = doc.y;
  doc.rect(25, ty + 1, doc.page.width - 50, 0.5).fill(C.border);
  doc.y = ty + 9;
  doc.fillColor(C.text);
}

function summaryBox(doc: typeof PDFDocument.prototype, items: { label: string; value: string | number; color: string }[]) {
  const boxY = doc.y;
  const gap = 6;
  const n = items.length;
  const totalW = doc.page.width - 50;
  const w = (totalW - gap * (n - 1)) / n;
  let x = 25;

  for (const item of items) {
    doc.roundedRect(x, boxY, w, 44, 4).lineWidth(0.5).stroke(C.border);
    doc.fillColor(item.color).font("Helvetica-Bold").fontSize(18).text(String(item.value), x, boxY + 6, { width: w, align: "center" });
    doc.fillColor(C.textLight).font("Helvetica").fontSize(7).text(item.label.toUpperCase(), x, boxY + 28, { width: w, align: "center" });
    x += w + gap;
  }
  doc.fillColor(C.text);
  doc.y = boxY + 52;
}

type Cell = { text: string; color?: string; bold?: boolean; align?: string };

function drawTable(doc: typeof PDFDocument.prototype, headers: string[], colWidths: number[], rows: Cell[][], compact = false, onPageBreak?: () => void) {
  const tableTop = doc.y;
  const maxWidth = doc.page.width - 50;
  const fullWidth = Math.min(colWidths.reduce((a, b) => a + b, 0), maxWidth);
  const leftMargin = Math.max(25, (doc.page.width - fullWidth) / 2);
  const rowH = compact ? 12 : 14;

  let pageNum = 1;

    const drawHeaderRow = (yPos: number) => {
      doc.rect(leftMargin, yPos, fullWidth, rowH + 2).fill(C.headerBg);
      doc.font("Helvetica-Bold").fontSize(7).fillColor(C.white);
      let hx = leftMargin;
      headers.forEach((h, i) => {
        doc.text(h, hx + 3, yPos + 3, { width: colWidths[i] - 6, align: "left" });
        hx += colWidths[i];
      });
      doc.fillColor(C.text);
    };

    drawHeaderRow(tableTop);
    let y = tableTop + rowH + 2;
    doc.font("Helvetica").fontSize(7);

    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];
      if (y + rowH > doc.page.height - 50) {
        drawFooter(doc, pageNum, 0);
        if (onPageBreak) { onPageBreak(); } else { doc.addPage(); }
        pageNum++;
        doc.y = 60;
        y = doc.y;
        drawHeaderRow(y);
        y += rowH + 2;
      }

    doc.rect(leftMargin, y, fullWidth, rowH).fill(ri % 2 === 0 ? C.rowEven : C.white);
    doc.rect(leftMargin, y, fullWidth, rowH).lineWidth(0.2).stroke(C.border);
    let cx = leftMargin;
    row.forEach((cell, i) => {
      const f = cell.bold ? "Helvetica-Bold" : "Helvetica";
      doc.font(f).fontSize(7).fillColor(cell.color || C.text);
      doc.text(cell.text, cx + 3, y + 2, { width: colWidths[i] - 6, align: (cell.align as "left" | "center" | "right") || "left" });
      cx += colWidths[i];
    });
    y += rowH;
  }

  doc.font("Helvetica").fontSize(7).fillColor(C.text);
  doc.y = y + 2;
}

// ── Data helpers ─────────────────────────────────────────────────────────

function citasQuery(fecha_inicio?: string, fecha_fin?: string) {
  let sql = `
    SELECT c.id, TO_CHAR(c.fecha, 'YYYY-MM-DD') as fecha, c.paciente_id, c.hora_inicio, c.hora_fin, c.tipo, c.estado, c.notas, c.registrado_por, c.medico, c.edad, c.idx, c.analisis_solicitados, c.created_at,
           u.nombre as paciente_nombre, u.apellido as paciente_apellido, u.email as paciente_email,
           p.telefono as paciente_telefono, TO_CHAR(p.fecha_nacimiento, 'YYYY-MM-DD') as paciente_fecha_nac, p.dni as paciente_dni,
           (SELECT json_agg(json_build_object('id', a.id, 'test_id', a.test_id, 'estado', a.estado))
            FROM analisis a WHERE a.cita_id = c.id) as tests_json,
           (SELECT r.id FROM resultados r WHERE r.cita_id = c.id LIMIT 1) as resultado_id
    FROM citas c
    JOIN pacientes p ON p.id = c.paciente_id
    JOIN users u ON u.id = p.user_id
  `;
  const params: unknown[] = [];
  if (fecha_inicio && fecha_fin) {
    sql += " WHERE c.fecha >= ? AND c.fecha <= ?";
    params.push(fecha_inicio, fecha_fin);
  }
  sql += " ORDER BY c.fecha ASC, c.hora_inicio ASC";
  return { sql, params };
}

function parseRows(result: { columns: string[]; values: unknown[][] }): Record<string, unknown>[] {
  return result.values.map((row: unknown[]) => {
    const obj: Record<string, unknown> = {};
    result.columns.forEach((col: string, i: number) => {
      obj[col] = row[i];
      if (col === "tests_json" && typeof row[i] === "string") {
        try { obj["tests"] = JSON.parse(row[i] as string); } catch { obj["tests"] = []; }
        delete obj["tests_json"];
      }
    });
    return obj;
  });
}

function calcEdad(fechaNac: string): string {
  const birth = new Date(fechaNac);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return String(age);
}

function blockStatus(tests: { estado: string }[], hasResultado: boolean): string {
  if (!tests.length) return "pendiente";
  if (tests.some((t) => t.estado === "en_proceso")) return "en_proceso";
  if (tests.every((t) => t.estado === "completado") && !hasResultado) return "en_proceso";
  if (tests.every((t) => t.estado === "completado") && hasResultado) return "completado";
  return "pendiente";
}

// ── Citas PDF ────────────────────────────────────────────────────────────

router.get("/citas/pdf",
  query("fecha_inicio").optional({ values: "falsy" }).matches(/^\d{4}-\d{2}-\d{2}$/).withMessage("fecha_inicio inválida"),
  query("fecha_fin").optional({ values: "falsy" }).matches(/^\d{4}-\d{2}-\d{2}$/).withMessage("fecha_fin inválida"),
  async (req, res) => {
  if (!req.user || !["admin", "recepcionista"].includes(req.user.role)) {
    res.status(403).json({ error: "No autorizado" }); return;
  }
  const fechaErr = validationResult(req);
  if (!fechaErr.isEmpty()) { res.status(400).json({ error: fechaErr.array()[0].msg }); return; }
  const db = getDatabase();
  const q = req.query as Record<string, string | undefined>;
  const fecha_inicio = q.fecha_inicio;
  const fecha_fin = q.fecha_fin;
  const { sql, params } = citasQuery(fecha_inicio as string, fecha_fin as string);
  const result = await db.exec(sql, params);
  const citas = result.length ? parseRows(result[0]) : [];

  const doc = new PDFDocument({ margin: 25, size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=reporte-citas-${new Date().toISOString().split("T")[0]}.pdf`);
  doc.pipe(res);

  let totalPages = 1;

  drawHeaderBar(doc, "Portal de Laboratorio Clínico");
  drawTitle(doc, "REPORTE DETALLADO DE CITAS", fecha_inicio as string, fecha_fin as string);

  const pendientes = citas.filter((c) => blockStatus((c.tests as { estado: string }[]) || [], !!c.resultado_id) === "pendiente").length;
  const enProceso = citas.filter((c) => blockStatus((c.tests as { estado: string }[]) || [], !!c.resultado_id) === "en_proceso").length;
  const completadas = citas.filter((c) => c.resultado_id).length;
  const totalAnalisis = citas.reduce((s, c) => s + ((c.tests as unknown[])?.length || 0), 0);

  sectionTitle(doc, "RESUMEN");
  summaryBox(doc, [
    { label: "Total Citas", value: citas.length, color: C.primary },
    { label: "Pendientes", value: pendientes, color: C.warning },
    { label: "En Proceso", value: enProceso, color: C.info },
    { label: "Completadas", value: completadas, color: C.success },
  ]);

  doc.font("Helvetica").fontSize(8).fillColor(C.textLight);
  doc.text(`Total de análisis solicitados: ${totalAnalisis}`, 25, doc.y, { width: doc.page.width - 50, align: "center" });
  doc.y += 14;
  doc.fillColor(C.text);

  sectionTitle(doc, "LISTADO GENERAL DE CITAS");

  const newPage = () => { doc.addPage(); totalPages++; drawHeaderBar(doc, "Reporte de Citas"); doc.y = 60; };

  const headers = ["ID", "Paciente", "DNI", "Teléfono", "Edad", "Fecha", "Hora", "IDX", "Estado"];
  const colWidths = [28, 110, 44, 50, 28, 55, 55, 50, 55];
  const rows: Cell[][] = citas.map((c) => {
    const tests = (c.tests as { estado: string }[]) || [];
    const tieneResultado = !!c.resultado_id;
    const bs = blockStatus(tests, tieneResultado);
    const estadoMap: Record<string, { text: string; color: string }> = {
      completado: { text: "Completado", color: C.success },
      en_proceso: { text: "En Proceso", color: C.info },
      pendiente: { text: "Pendiente", color: C.warning },
    };
    const st = estadoMap[bs] || { text: "Pendiente", color: C.warning };
    return [
      { text: String(c.id || ""), color: C.textLight, align: "center" },
      { text: `${c.paciente_nombre || ""} ${c.paciente_apellido || ""}` },
      { text: c.paciente_dni ? String(c.paciente_dni) : "—", color: C.textLight, align: "center" },
      { text: String(c.paciente_telefono || ""), color: C.textLight, align: "center" },
      { text: c.paciente_fecha_nac ? calcEdad(c.paciente_fecha_nac as string) : "—", color: C.textLight, align: "center" },
      { text: String(c.fecha || ""), align: "center" },
      { text: `${c.hora_inicio || ""} - ${c.hora_fin || ""}`, color: C.textLight, align: "center" },
      { text: String(c.idx || ""), color: C.textLight, align: "center" },
      { text: st.text, color: st.color, bold: true, align: "center" },
    ];
  });
  drawTable(doc, headers, colWidths, rows, false, newPage);

  const citasConTests = citas.filter((c) => (c.tests as unknown[])?.length > 0);
  if (citasConTests.length > 0) {
    if (doc.y > doc.page.height - 130) { newPage(); }
    sectionTitle(doc, "DETALLE DE ANÁLISIS POR CITA");

    for (const c of citasConTests) {
      const tests = (c.tests as { id: number; test_id: string; estado: string }[]) || [];

      if (doc.y > doc.page.height - 130) {
        drawFooter(doc, 0, 0);
        newPage();
      }

      const cy = doc.y;
      doc.roundedRect(25, cy, doc.page.width - 50, 18, 3).lineWidth(0.5).stroke(C.primary);
      doc.rect(25, cy, 4, 18).fill(C.primary);
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(C.primaryDark);
      doc.text(`Cita #${c.id} — ${c.paciente_nombre} ${c.paciente_apellido}`, 33, cy + 2);
      doc.font("Helvetica").fontSize(6.5).fillColor(C.textLight);
      doc.text(`${c.fecha} · ${c.hora_inicio} - ${c.hora_fin}${c.medico ? ` · Médico: ${c.medico}` : ""}${c.idx ? ` · IDX: ${c.idx}` : ""}${c.paciente_dni ? ` · DNI: ${c.paciente_dni}` : ""}`, 33, cy + 10);
      doc.y = cy + 24;

      const tc: Record<string, string> = { pendiente: C.warning, en_proceso: C.info, completado: C.success };
      const tHeaders = ["Análisis", "Estado"];
      const tWidths = [doc.page.width - 116, 60];
      const tRows: Cell[][] = tests.map((t) => [
        { text: t.test_id.replace(/_/g, " ") },
        { text: t.estado.replace("_", " "), color: tc[t.estado] || C.text, bold: true, align: "center" },
      ]);
      drawTable(doc, tHeaders, tWidths, tRows, true);
      doc.moveDown(0.5);
    }
  }

  drawFooter(doc, totalPages, totalPages);
  doc.end();
});

// ── Citas Excel ──────────────────────────────────────────────────────────

router.get("/citas/excel",
  query("fecha_inicio").optional({ values: "falsy" }).matches(/^\d{4}-\d{2}-\d{2}$/).withMessage("fecha_inicio inválida"),
  query("fecha_fin").optional({ values: "falsy" }).matches(/^\d{4}-\d{2}-\d{2}$/).withMessage("fecha_fin inválida"),
  async (req, res) => {
  if (!req.user || !["admin", "recepcionista"].includes(req.user.role)) {
    res.status(403).json({ error: "No autorizado" }); return;
  }
  const fechaErr = validationResult(req);
  if (!fechaErr.isEmpty()) { res.status(400).json({ error: fechaErr.array()[0].msg }); return; }
  const db = getDatabase();
  const q = req.query as Record<string, string | undefined>;
  const fecha_inicio = q.fecha_inicio;
  const fecha_fin = q.fecha_fin;
  const { sql, params } = citasQuery(fecha_inicio as string, fecha_fin as string);
  const result = await db.exec(sql, params);
  const citas = result.length ? parseRows(result[0]) : [];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "LIFELAB";
  workbook.created = new Date();

  const hdrStyle = { font: { bold: true, color: { argb: "FFFFFFFF" }, size: 10 }, fill: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF0F172A" } } };
  const rowStyle = (i: number) => ({
    font: { size: 9, color: { argb: "FF1E293B" } },
    fill: (i % 2 === 0 ? { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF8FAFC" } } : { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFFFFFF" } }) as ExcelJS.Fill,
    border: { top: { style: "thin" as const, color: { argb: "FFE2E8F0" } }, bottom: { style: "thin" as const, color: { argb: "FFE2E8F0" } } },
  });

  const statusColor = (estado: string): ExcelJS.Fill => {
    const map: Record<string, string> = { completado: "FFDCFCE7", en_proceso: "FFDBEAFE", pendiente: "FFFEF3C7" };
    return { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: map[estado] || "FFFFFFFF" } } as ExcelJS.Fill;
  };

  // Sheet 1: Citas
  const sheet = workbook.addWorksheet("Citas");
  sheet.columns = [
    { header: "ID", key: "id", width: 6 },
    { header: "Paciente", key: "paciente", width: 30 },
    { header: "DNI", key: "dni", width: 14 },
    { header: "Teléfono", key: "telefono", width: 15 },
    { header: "Email", key: "email", width: 30 },
    { header: "Edad", key: "edad", width: 6 },
    { header: "Fecha", key: "fecha", width: 13 },
    { header: "Hora Inicio", key: "hora_inicio", width: 12 },
    { header: "Hora Fin", key: "hora_fin", width: 12 },
    { header: "Médico", key: "medico", width: 25 },
    { header: "IDX", key: "idx", width: 18 },
    { header: "Estado", key: "estado", width: 14 },
    { header: "Análisis", key: "total_tests", width: 10 },
    { header: "Notas", key: "notas", width: 30 },
  ];

  citas.forEach((c, i) => {
    const tests = (c.tests as { estado: string }[]) || [];
    const hasResult = !!c.resultado_id;
    const bs = blockStatus(tests, hasResult);
    const estadoLabel: Record<string, string> = { completado: "Completado", en_proceso: "En Proceso", pendiente: "Pendiente" };
    sheet.addRow({
      id: c.id,
      paciente: `${c.paciente_nombre || ""} ${c.paciente_apellido || ""}`,
      dni: c.paciente_dni || "",
      telefono: c.paciente_telefono || "",
      email: c.paciente_email || "",
      edad: c.paciente_fecha_nac ? calcEdad(c.paciente_fecha_nac as string) : "",
      fecha: c.fecha,
      hora_inicio: c.hora_inicio,
      hora_fin: c.hora_fin,
      medico: c.medico || "",
      idx: c.idx || "",
      estado: estadoLabel[bs] || "Pendiente",
      total_tests: tests.length || 0,
      notas: (c.notas as string) || "",
    });
    const rowN = i + 2;
    const rStyle = rowStyle(i);
    sheet.getRow(rowN).eachCell((cell, colN) => {
      cell.font = rStyle.font;
      cell.fill = rStyle.fill;
      cell.border = rStyle.border;
      // Color the estado column
      if (colN === 11) cell.fill = statusColor(bs);
    });
  });
  sheet.getRow(1).eachCell((cell) => { cell.font = hdrStyle.font; cell.fill = hdrStyle.fill; });
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: citas.length + 1, column: sheet.columns.length } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  // Sheet 2: Análisis por Cita
  const aSheet = workbook.addWorksheet("Análisis por Cita");
  aSheet.columns = [
    { header: "Cita ID", key: "cita_id", width: 9 },
    { header: "Paciente", key: "paciente", width: 30 },
    { header: "DNI", key: "dni", width: 14 },
    { header: "Fecha", key: "fecha", width: 13 },
    { header: "Análisis", key: "test_id", width: 25 },
    { header: "Estado", key: "estado", width: 14 },
    { header: "Médico", key: "medico", width: 25 },
    { header: "IDX", key: "idx", width: 18 },
  ];
  let ai = 0;
  for (const c of citas) {
    const tests = (c.tests as { id: number; test_id: string; estado: string }[]) || [];
    for (const t of tests) {
      aSheet.addRow({
        cita_id: c.id,
        paciente: `${c.paciente_nombre || ""} ${c.paciente_apellido || ""}`,
        dni: c.paciente_dni || "",
        fecha: c.fecha,
        test_id: t.test_id.replace(/_/g, " "),
        estado: t.estado.replace("_", " "),
        medico: c.medico || "",
        idx: c.idx || "",
      });
      const rowN = ai + 2;
      const rStyle = rowStyle(ai);
      aSheet.getRow(rowN).eachCell((cell, colN) => {
        cell.font = rStyle.font;
        cell.fill = rStyle.fill;
        cell.border = rStyle.border;
        if (colN === 5) cell.fill = statusColor(t.estado);
      });
      ai++;
    }
  }
  aSheet.getRow(1).eachCell((cell) => { cell.font = hdrStyle.font; cell.fill = hdrStyle.fill; });
  if (ai > 0) aSheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: ai + 1, column: aSheet.columns.length } };
  aSheet.views = [{ state: "frozen", ySplit: 1 }];

  // Sheet 3: Estadísticas (admin only)
  if (req.user?.role === "admin") {
    const sSheet = workbook.addWorksheet("Estadísticas");
    const pendientes = citas.filter((c) => blockStatus((c.tests as { estado: string }[]) || [], !!c.resultado_id) === "pendiente").length;
    const enProceso = citas.filter((c) => blockStatus((c.tests as { estado: string }[]) || [], !!c.resultado_id) === "en_proceso").length;
    const completadas = citas.filter((c) => c.resultado_id).length;
    const totalAnalisis = citas.reduce((s, c) => s + ((c.tests as unknown[])?.length || 0), 0);

    sSheet.columns = [
      { header: "Métrica", key: "metrica", width: 35 },
      { header: "Valor", key: "valor", width: 12 },
    ];
    const metrics = [
      { metrica: "Total de Citas en el Período", valor: citas.length },
      { metrica: "Citas Pendientes", valor: pendientes },
      { metrica: "Citas en Proceso", valor: enProceso },
      { metrica: "Citas Completadas", valor: completadas },
      { metrica: "Total Análisis Solicitados", valor: totalAnalisis },
      { metrica: "Promedio Análisis por Cita", valor: citas.length ? (totalAnalisis / citas.length).toFixed(1) : 0 },
      { metrica: "Pacientes Atendidos", valor: new Set(citas.map((c) => `${c.paciente_nombre} ${c.paciente_apellido}`)).size },
      { metrica: "Médicos Registrados", valor: new Set(citas.map((c) => c.medico as string).filter(Boolean)).size },
    ];
    metrics.forEach((m) => sSheet.addRow(m));
    sSheet.getRow(1).eachCell((cell) => { cell.font = hdrStyle.font; cell.fill = hdrStyle.fill; });
    sSheet.views = [{ state: "frozen", ySplit: 1 }];
    // Bold metric names
    for (let i = 2; i <= metrics.length + 1; i++) {
      sSheet.getRow(i).getCell(1).font = { bold: true, size: 9, color: { argb: "FF1E293B" } };
    }
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=reporte-citas-${new Date().toISOString().split("T")[0]}.xlsx`);
  await workbook.xlsx.write(res);
  res.end();
});

// ── Resultados PDF ───────────────────────────────────────────────────────

router.get("/resultados/pdf",
  query("paciente_id").optional({ values: "falsy" }).isInt({ min: 1 }).withMessage("paciente_id inválido"),
  async (req, res) => {
  if (!req.user || !["admin", "bioanalista"].includes(req.user.role)) {
    res.status(403).json({ error: "No autorizado" }); return;
  }
  const pidErr = validationResult(req);
  if (!pidErr.isEmpty()) { res.status(400).json({ error: pidErr.array()[0].msg }); return; }
  const db = getDatabase();
  const paciente_id = (req.query as Record<string, string | undefined>).paciente_id;

  let sql = `SELECT r.*, u.nombre as paciente_nombre, u.apellido as paciente_apellido,
             u.email as paciente_email, p.dni as paciente_dni,
             ub.nombre as subido_por_nombre, ub.apellido as subido_por_apellido,
             TO_CHAR(c.fecha, 'YYYY-MM-DD') as cita_fecha, c.hora_inicio, c.hora_fin, c.medico, c.idx as cita_idx
             FROM resultados r
             JOIN pacientes p ON p.id = r.paciente_id
             JOIN users u ON u.id = p.user_id
             LEFT JOIN users ub ON ub.id = r.subido_por
             LEFT JOIN citas c ON c.id = r.cita_id`;
  const params: unknown[] = [];
  if (req.user?.role === "paciente") {
    sql += " WHERE p.user_id = ?";
    params.push(req.user.userId);
  } else if (paciente_id) {
    sql += " WHERE r.paciente_id = ?";
    params.push(paciente_id);
  }
  sql += " ORDER BY r.created_at DESC";
  const r2 = await db.exec(sql, params);
  const rows2 = r2.length ? parseRows(r2[0]) : [];

  const doc = new PDFDocument({ margin: 25, size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=reporte-resultados-${new Date().toISOString().split("T")[0]}.pdf`);
  doc.pipe(res);

  let totalPages = 1;

  drawHeaderBar(doc, "Portal de Laboratorio Clínico");
  drawTitle(doc, "REPORTE DE RESULTADOS");

  sectionTitle(doc, "RESUMEN");
  summaryBox(doc, [
    { label: "Total Resultados", value: rows2.length, color: C.primary },
    { label: "Con Cita", value: rows2.filter((r) => r.cita_id).length, color: C.success },
    { label: "Sin Cita", value: rows2.filter((r) => !r.cita_id).length, color: C.warning },
  ]);

  sectionTitle(doc, "LISTADO DE RESULTADOS");

  const newPage = () => { doc.addPage(); totalPages++; drawHeaderBar(doc, "Reporte de Resultados"); doc.y = 60; };

  const resHeaders = ["ID", "Paciente", "DNI", "Título", "Cita ID", "Bioanalista", "Fecha Subida"];
  const resColWidths = [22, 105, 44, 105, 38, 80, 55];
  const resRows: Cell[][] = rows2.map((r) => [
    { text: String(r.id || ""), color: C.textLight, align: "center" },
    { text: `${r.paciente_nombre || ""} ${r.paciente_apellido || ""}` },
    { text: r.paciente_dni ? String(r.paciente_dni) : "—", color: C.textLight, align: "center" },
    { text: String(r.titulo || "") },
    { text: String(r.cita_id || "—"), color: C.textLight, align: "center" },
    { text: r.cita_id ? `${r.subido_por_nombre || ""} ${r.subido_por_apellido || ""}` : "—", align: "center" },
    { text: String(r.created_at || "").slice(0, 10), color: C.textLight, align: "center" },
  ]);
  drawTable(doc, resHeaders, resColWidths, resRows, false, newPage);

  drawFooter(doc, totalPages, totalPages);
  doc.end();
});

// ── Resultados Excel ──────────────────────────────────────────────────────

router.get("/resultados/excel",
  query("paciente_id").optional({ values: "falsy" }).isInt({ min: 1 }).withMessage("paciente_id inválido"),
  async (req, res) => {
  if (!req.user || !["admin", "bioanalista"].includes(req.user.role)) {
    res.status(403).json({ error: "No autorizado" }); return;
  }
  const pidErr = validationResult(req);
  if (!pidErr.isEmpty()) { res.status(400).json({ error: pidErr.array()[0].msg }); return; }
  const db = getDatabase();
  const paciente_id = (req.query as Record<string, string | undefined>).paciente_id;

  let sql = `SELECT r.*, u.nombre as paciente_nombre, u.apellido as paciente_apellido,
             u.email as paciente_email, p.dni as paciente_dni, ub.nombre as subido_por_nombre,
             TO_CHAR(c.fecha, 'YYYY-MM-DD') as cita_fecha, c.hora_inicio, c.hora_fin, c.medico, c.idx as cita_idx
             FROM resultados r
             JOIN pacientes p ON p.id = r.paciente_id
             JOIN users u ON u.id = p.user_id
             LEFT JOIN users ub ON ub.id = r.subido_por
             LEFT JOIN citas c ON c.id = r.cita_id`;
  const params: unknown[] = [];
  if (req.user?.role === "paciente") {
    sql += " WHERE p.user_id = ?";
    params.push(req.user.userId);
  } else if (paciente_id) {
    sql += " WHERE r.paciente_id = ?";
    params.push(paciente_id);
  }
  sql += " ORDER BY r.created_at DESC";
  const result = await db.exec(sql, params);
  const rows = result[0]?.values || [];
  const cols = result[0]?.columns || [];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "LIFELAB";
  workbook.created = new Date();

  const hdrStyle = { font: { bold: true, color: { argb: "FFFFFFFF" }, size: 10 }, fill: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF0F172A" } } };
  const rowStyle = (i: number) => ({
    font: { size: 9, color: { argb: "FF1E293B" } },
    fill: (i % 2 === 0 ? { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF8FAFC" } } : { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFFFFFF" } }) as ExcelJS.Fill,
    border: { top: { style: "thin" as const, color: { argb: "FFE2E8F0" } }, bottom: { style: "thin" as const, color: { argb: "FFE2E8F0" } } },
  });

  const sheet = workbook.addWorksheet("Resultados");
  sheet.columns = [
    { header: "ID", key: "id", width: 6 },
    { header: "Paciente", key: "paciente", width: 30 },
    { header: "DNI", key: "dni", width: 14 },
    { header: "Email", key: "email", width: 30 },
    { header: "Título", key: "titulo", width: 35 },
    { header: "Tipo", key: "tipo", width: 16 },
    { header: "Cita ID", key: "cita_id", width: 9 },
    { header: "Bioanalista", key: "subido_por", width: 25 },
    { header: "Fecha Cita", key: "fecha_cita", width: 13 },
    { header: "Hora", key: "hora", width: 14 },
    { header: "Médico", key: "medico", width: 25 },
    { header: "IDX", key: "idx", width: 18 },
    { header: "Subido", key: "fecha", width: 13 },
  ];

  for (let i = 0; i < rows.length; i++) {
    const obj: Record<string, unknown> = {};
    cols.forEach((col: string, j: number) => { obj[col] = rows[i][j]; });
    sheet.addRow({
      id: obj.id,
      paciente: `${obj.paciente_nombre || ""} ${obj.paciente_apellido || ""}`,
      dni: obj.paciente_dni || "",
      email: obj.paciente_email || "",
      titulo: obj.titulo || "",
      tipo: obj.tipo || "",
      cita_id: obj.cita_id || "",
      subido_por: `${obj.subido_por_nombre || ""} ${obj.subido_por_apellido || ""}`,
      fecha_cita: obj.cita_fecha || "",
      hora: obj.hora_inicio ? `${obj.hora_inicio}-${obj.hora_fin}` : "",
      medico: obj.medico || "",
      idx: obj.cita_idx || "",
      fecha: (obj.created_at as string || "").slice(0, 10),
    });
    sheet.getRow(i + 2).eachCell((cell) => { const s = rowStyle(i); cell.font = s.font; cell.fill = s.fill; cell.border = s.border; });
  }
  sheet.getRow(1).eachCell((cell) => { cell.font = hdrStyle.font; cell.fill = hdrStyle.fill; });
  if (rows.length > 0) sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: rows.length + 1, column: sheet.columns.length } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  // Admin stats
  if (req.user?.role === "admin") {
    const sSheet = workbook.addWorksheet("Estadísticas");
    sSheet.columns = [
      { header: "Métrica", key: "metrica", width: 30 },
      { header: "Valor", key: "valor", width: 12 },
    ];
    const resultRows = rows.map((r) => {
      const obj: Record<string, unknown> = {};
      cols.forEach((col: string, j: number) => { obj[col] = r[j]; });
      return obj;
    });
    const metrics = [
      { metrica: "Total Resultados", valor: resultRows.length },
      { metrica: "Resultados con Cita", valor: resultRows.filter((r) => r.cita_id).length },
      { metrica: "Resultados sin Cita", valor: resultRows.filter((r) => !r.cita_id).length },
      { metrica: "Bioanalistas Activos", valor: new Set(resultRows.map((r) => `${r.subido_por_nombre}`).filter(Boolean)).size },
      { metrica: "Pacientes Atendidos", valor: new Set(resultRows.map((r) => `${r.paciente_nombre} ${r.paciente_apellido}`)).size },
    ];
    metrics.forEach((m) => sSheet.addRow(m));
    sSheet.getRow(1).eachCell((cell) => { cell.font = hdrStyle.font; cell.fill = hdrStyle.fill; });
    sSheet.views = [{ state: "frozen", ySplit: 1 }];
    for (let i = 2; i <= metrics.length + 1; i++) {
      sSheet.getRow(i).getCell(1).font = { bold: true, size: 9, color: { argb: "FF1E293B" } };
    }
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=reporte-resultados-${new Date().toISOString().split("T")[0]}.xlsx`);
  await workbook.xlsx.write(res);
  res.end();
});

export default router;
