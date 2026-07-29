import sgMail from "@sendgrid/mail";

function escaparHtml(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function getFromEmail(): string | null {
  const from = process.env.EMAIL_FROM;
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!from || !apiKey) return null;
  sgMail.setApiKey(apiKey);
  return from;
}

function buildHtml(title: string, nombre: string, bodyHtml: string, linkUrl: string, linkText: string, footerNote: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f3f4f6;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f3f4f6;">
        <tr><td align="center" style="padding:40px 20px;">
          <table role="presentation" width="100%" style="max-width:600px;" cellspacing="0" cellpadding="0" border="0">
            <tr><td style="background-color:#ffffff;border-radius:16px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr><td style="background:linear-gradient(135deg,#0ea5e9,#3b82f6);padding:40px 30px;text-align:center;border-radius:16px 16px 0 0;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto 16px;">
                    <tr><td style="width:56px;height:56px;background-color:rgba(255,255,255,0.2);border-radius:14px;text-align:center;vertical-align:middle;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-1px;">L</td></tr>
                  </table>
                  <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">LIFELAB</h1>
                  <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">${title}</p>
                </td></tr>
                <tr><td style="padding:40px 30px;">
                  <p style="margin:0 0 16px;color:#1f2937;font-size:16px;line-height:1.6;">Hola <strong>${escaparHtml(nombre)}</strong>,</p>
                  ${bodyHtml}
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:32px 0;">
                    <tr><td align="center">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                        <tr><td style="border-radius:10px;background:linear-gradient(135deg,#0ea5e9,#3b82f6);">
                          <a href="${linkUrl}" style="display:inline-block;color:#ffffff;text-decoration:none;padding:16px 36px;font-size:15px;font-weight:600;border-radius:10px;mso-hide:all;">${linkText}</a>
                        </td></tr>
                      </table>
                    </td></tr>
                  </table>
                  <p style="margin:24px 0 0;color:#6b7280;font-size:13px;line-height:1.6;">O copia y pega este enlace en tu navegador:<br>
                    <span style="word-break:break-all;color:#0ea5e9;">${linkUrl}</span>
                  </p>
                  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;">
                  <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">${footerNote}</p>
                </td></tr>
                <tr><td style="background-color:#f9fafb;padding:24px 30px;text-align:center;border-top:1px solid #e5e7eb;border-radius:0 0 16px 16px;">
                  <p style="margin:0 0 8px;color:#9ca3af;font-size:12px;">&copy; ${new Date().getFullYear()} LIFELAB. Todos los derechos reservados.</p>
                  <p style="margin:0;color:#9ca3af;font-size:12px;">Portal de Laboratorio M&eacute;dico</p>
                </td></tr>
              </table>
            </td></tr>
            <tr><td style="padding:20px;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:11px;line-height:1.5;">Este es un correo autom&aacute;tico, por favor no respondas a este mensaje.</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

export async function sendPasswordResetEmail(email: string, resetUrl: string, nombre: string): Promise<void> {
  const from = getFromEmail();
  if (!from) {
    const maskedUrl = resetUrl.replace(/token=[^&]+/, "token=***");
    console.log("\n========================================");
    console.log("🔐 RESTABLECER CONTRASEÑA (modo desarrollo)");
    console.log(`   Para: ${email}`);
    console.log(`   Usuario: ${nombre}`);
    console.log(`   Enlace: ${maskedUrl}`);
    console.log("========================================\n");
    return;
  }

  const bodyHtml = `
    <p style="margin:0 0 24px;color:#4b5563;font-size:15px;line-height:1.6;">
      Recibimos una solicitud para restablecer la contrase&ntilde;a de tu cuenta en <strong>LIFELAB</strong>.
      Si fuiste t&uacute;, haz clic en el bot&oacute;n de abajo para crear una nueva contrase&ntilde;a:
    </p>`;

  const html = buildHtml("Recuperaci&oacute;n de contrase&ntilde;a", nombre, bodyHtml, resetUrl,
    "Restablecer contrase&ntilde;a",
    "Este enlace expira en <strong>1 hora</strong> por seguridad. Si no solicitaste este cambio, puedes ignorar este correo.");

  try {
    await sgMail.send({
      to: email,
      from,
      subject: "Restablece tu contraseña — LIFELAB",
      text: `Hola ${nombre},\n\nRecibimos una solicitud para restablecer tu contraseña en LIFELAB.\n\nHaz clic en este enlace para crear una nueva contraseña:\n${resetUrl}\n\nSi no solicitaste esto, ignora este correo.\n\n- LIFELAB`,
      html,
    });
    console.log(`✅ Email de recuperación enviado a ${email}`);
  } catch (err) {
    console.error("Error enviando email de recuperación:", err);
    const maskedUrl = resetUrl.replace(/token=[^&]+/, "token=***");
    console.log("\n========================================");
    console.log("🔐 FALLBACK — Link de recuperación");
    console.log(`   Para: ${email}`);
    console.log(`   Enlace: ${maskedUrl}`);
    console.log("========================================\n");
  }
}

export async function sendVerificationEmail(email: string, verifyUrl: string, nombre: string): Promise<void> {
  const from = getFromEmail();
  if (!from) {
    console.log("\n========================================");
    console.log("📧 VERIFICAR CORREO (modo desarrollo)");
    console.log(`   Para: ${email}`);
    console.log(`   Usuario: ${nombre}`);
    console.log(`   Enlace: ${verifyUrl}`);
    console.log("========================================\n");
    return;
  }

  const bodyHtml = `
    <p style="margin:0 0 24px;color:#4b5563;font-size:15px;line-height:1.6;">
      Gracias por registrarte en <strong>LIFELAB</strong>. Para completar tu registro y acceder a todos los servicios,
      confirma tu direcci&oacute;n de correo electr&oacute;nico haciendo clic en el bot&oacute;n de abajo:
    </p>`;

  const html = buildHtml("Verificaci&oacute;n de correo", nombre, bodyHtml, verifyUrl,
    "Verificar correo",
    "Este enlace expira en <strong>24 horas</strong> por seguridad. Si no creaste esta cuenta, ignora este correo.");

  try {
    await sgMail.send({
      to: email,
      from,
      subject: "Verifica tu correo — LIFELAB",
      text: `Hola ${nombre},\n\nGracias por registrarte en LIFELAB.\n\nPara verificar tu cuenta, haz clic en este enlace:\n${verifyUrl}\n\nEste enlace expira en 24 horas.\n\nSi no creaste esta cuenta, ignora este correo.\n\n- LIFELAB`,
      html,
    });
    console.log(`✅ Email de verificación enviado a ${email}`);
  } catch (err) {
    console.error("Error enviando email de verificación:", err);
    console.log("\n========================================");
    console.log("📧 FALLBACK — Link de verificación");
    console.log(`   Para: ${email}`);
    console.log(`   Enlace: ${verifyUrl}`);
    console.log("========================================\n");
  }
}
