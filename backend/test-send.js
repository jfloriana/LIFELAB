const n = require('nodemailer');
const t = n.createTransport({
  host: 'smtp.gmail.com', port: 587, secure: false,
  auth: { user: 'jfloriana@unitru.edu.pe', pass: 'sgeq qeny ryao iubp' },
  connectionTimeout: 10000, greetingTimeout: 10000,
});
t.sendMail({
  from: '"LIFELAB" <jfloriana@unitru.edu.pe>',
  to: 'jfloriana@unitru.edu.pe',
  subject: 'Test LIFELAB',
  text: 'Si ves esto, SMTP funciona correctamente.',
}).then(() => console.log('ENVIADO')).catch(e => {
  console.error('ERROR:', e.message);
  if (e.response) console.error('RESP:', e.response);
  process.exit(1);
});
