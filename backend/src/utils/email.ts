import nodemailer from "nodemailer";
import dns from "dns";

function escaparHtml(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

let transporter: nodemailer.Transporter | null = null;

async function resolveHost(host: string): Promise<string> {
  try {
    const { address } = await dns.promises.lookup(host, { family: 4 });
    return address;
  } catch {
    return host;
  }
}

async function getTransporter() {
  if (transporter) return transporter;

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpIp = await resolveHost(smtpHost);
  console.log(`📧 SMTP conectando a ${smtpHost} (${smtpIp})`);

  const smtpPort = parseInt(process.env.SMTP_PORT || "587");
  transporter = nodemailer.createTransport({
    host: smtpIp,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
  });

  return transporter;
}

export async function sendPasswordResetEmail(email: string, resetUrl: string, nombre: string): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f3f4f6;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" width="100%" style="max-width: 600px;" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="background-color: #ffffff; border-radius: 16px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td style="background: linear-gradient(135deg, #0ea5e9, #3b82f6); padding: 40px 30px; text-align: center; border-radius: 16px 16px 0 0;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 0 auto 16px;">
                          <tr>
                            <td style="width: 56px; height: 56px; background-color: rgba(255,255,255,0.2); border-radius: 14px; text-align: center; vertical-align: middle; font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -1px;">
                              L
                            </td>
                          </tr>
                        </table>
                        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">LIFELAB</h1>
                        <p style="margin: 8px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">Recuperaci&oacute;n de contrase&ntilde;a</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 40px 30px;">
                        <p style="margin: 0 0 16px; color: #1f2937; font-size: 16px; line-height: 1.6;">Hola <strong>${escaparHtml(nombre)}</strong>,</p>
                        <p style="margin: 0 0 24px; color: #4b5563; font-size: 15px; line-height: 1.6;">
                          Recibimos una solicitud para restablecer la contrase&ntilde;a de tu cuenta en <strong>LIFELAB</strong>.
                          Si fuiste t&uacute;, haz clic en el bot&oacute;n de abajo para crear una nueva contrase&ntilde;a:
                        </p>
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 32px 0;">
                          <tr>
                            <td align="center">
                              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                  <td style="border-radius: 10px; background: linear-gradient(135deg, #0ea5e9, #3b82f6);">
                                    <a href="${resetUrl}" style="display: inline-block; color: #ffffff; text-decoration: none; padding: 16px 36px; font-size: 15px; font-weight: 600; border-radius: 10px; mso-hide: all;">Restablecer contrase&ntilde;a</a>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                        <p style="margin: 24px 0 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
                          O copia y pega este enlace en tu navegador:<br>
                          <span style="word-break: break-all; color: #0ea5e9;">${resetUrl}</span>
                        </p>
                        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
                        <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 1.6;">
                          Este enlace expira en <strong>1 hora</strong> por seguridad.
                        </p>
                        <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
                          Si no solicitaste este cambio, puedes ignorar este correo. Tu contrase&ntilde;a actual seguir&aacute; funcionando.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="background-color: #f9fafb; padding: 24px 30px; text-align: center; border-top: 1px solid #e5e7eb; border-radius: 0 0 16px 16px;">
                        <p style="margin: 0 0 8px; color: #9ca3af; font-size: 12px;">&copy; ${new Date().getFullYear()} LIFELAB. Todos los derechos reservados.</p>
                        <p style="margin: 0; color: #9ca3af; font-size: 12px;">Portal de Laboratorio M&eacute;dico</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 20px; text-align: center;">
                  <p style="margin: 0; color: #9ca3af; font-size: 11px; line-height: 1.5;">
                    Este es un correo autom&aacute;tico, por favor no respondas a este mensaje.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const t = await getTransporter();

  if (t) {
    try {
      await t.sendMail({
        from: `"LIFELAB" <${process.env.EMAIL_FROM || "noreply@lifelab.com"}>`,
        to: email,
        subject: "Restablece tu contraseña — LIFELAB",
        text: `Hola ${nombre},\n\nRecibimos una solicitud para restablecer tu contrase\u00f1a en LIFELAB.\n\nHaz clic en este enlace para crear una nueva contrase\u00f1a:\n${resetUrl}\n\nSi no solicitaste esto, ignora este correo.\n\n- LIFELAB`,
        html,
      });
      return;
    } catch (err) {
      console.error("Error enviando email de recuperación:", err);
    }
  }
  const maskedUrl = resetUrl.replace(/token=[^&]+/, "token=***");
  console.log("\n========================================");
  console.log("🔐 RESTABLECER CONTRASEÑA (modo desarrollo)");
  console.log(`   Para: ${email}`);
  console.log(`   Usuario: ${nombre}`);
  console.log(`   Enlace: ${maskedUrl}`);
  console.log("========================================\n");
}

export async function sendVerificationEmail(email: string, verifyUrl: string, nombre: string): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f3f4f6;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" width="100%" style="max-width: 600px;" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="background-color: #ffffff; border-radius: 16px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td style="background: linear-gradient(135deg, #0ea5e9, #3b82f6); padding: 40px 30px; text-align: center; border-radius: 16px 16px 0 0;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 0 auto 16px;">
                          <tr>
                            <td style="width: 56px; height: 56px; background-color: rgba(255,255,255,0.2); border-radius: 14px; text-align: center; vertical-align: middle; font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -1px;">
                              L
                            </td>
                          </tr>
                        </table>
                        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">LIFELAB</h1>
                        <p style="margin: 8px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">Verificaci&oacute;n de correo</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 40px 30px;">
                        <p style="margin: 0 0 16px; color: #1f2937; font-size: 16px; line-height: 1.6;">Hola <strong>${escaparHtml(nombre)}</strong>,</p>
                        <p style="margin: 0 0 24px; color: #4b5563; font-size: 15px; line-height: 1.6;">
                          Gracias por registrarte en <strong>LIFELAB</strong>. Para completar tu registro y acceder a todos los servicios,
                          confirma tu direcci&oacute;n de correo electr&oacute;nico haciendo clic en el bot&oacute;n de abajo:
                        </p>
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 32px 0;">
                          <tr>
                            <td align="center">
                              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                  <td style="border-radius: 10px; background: linear-gradient(135deg, #0ea5e9, #3b82f6);">
                                    <a href="${verifyUrl}" style="display: inline-block; color: #ffffff; text-decoration: none; padding: 16px 36px; font-size: 15px; font-weight: 600; border-radius: 10px; mso-hide: all;">Verificar correo</a>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                        <p style="margin: 24px 0 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
                          O copia y pega este enlace en tu navegador:<br>
                          <span style="word-break: break-all; color: #0ea5e9;">${verifyUrl}</span>
                        </p>
                        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
                        <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 1.6;">
                          Este enlace expira en <strong>24 horas</strong> por seguridad.
                        </p>
                        <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
                          Si no creaste esta cuenta, puedes ignorar este correo.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="background-color: #f9fafb; padding: 24px 30px; text-align: center; border-top: 1px solid #e5e7eb; border-radius: 0 0 16px 16px;">
                        <p style="margin: 0 0 8px; color: #9ca3af; font-size: 12px;">&copy; ${new Date().getFullYear()} LIFELAB. Todos los derechos reservados.</p>
                        <p style="margin: 0; color: #9ca3af; font-size: 12px;">Portal de Laboratorio M&eacute;dico</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 20px; text-align: center;">
                  <p style="margin: 0; color: #9ca3af; font-size: 11px; line-height: 1.5;">
                    Este es un correo autom&aacute;tico, por favor no respondas a este mensaje.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const t = await getTransporter();

  if (t) {
    try {
      await t.sendMail({
        from: `"LIFELAB" <${process.env.EMAIL_FROM || "noreply@lifelab.com"}>`,
        to: email,
        subject: "Verifica tu correo — LIFELAB",
        text: `Hola ${nombre},\n\nGracias por registrarte en LIFELAB.\n\nPara verificar tu cuenta, haz clic en este enlace:\n${verifyUrl}\n\nEste enlace expira en 24 horas.\n\nSi no creaste esta cuenta, ignora este correo.\n\n- LIFELAB`,
        html,
      });
      return;
    } catch (err) {
      console.error("Error enviando email de verificación:", err);
    }
  }
  console.log("\n========================================");
  console.log("📧 VERIFICAR CORREO");
  console.log(`   Para: ${email}`);
  console.log(`   Usuario: ${nombre}`);
  console.log(`   Enlace: ${verifyUrl}`);
  console.log("========================================\n");
}