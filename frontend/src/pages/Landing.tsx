import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import {
  Heart, Calendar, Shield, Phone, Mail, MapPin,
  Stethoscope, Facebook, Instagram, ChevronRight,
  Microscope, Award, Clock, CheckCircle, Building,
  FlaskConical, ChevronDown, Users, Star, Smartphone
} from "lucide-react";
import { SilkAurora } from "@/components/ui/silk-aurora";
import { TestimonialsSection, type TestimonialData } from "@/components/ui/testimonial-v2";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { FAQ } from "@/components/ui/faq-tabs";
import MapLifelab from "@/components/ui/map-lifelab";
import { getResenasAprobadas } from "@/services/api";
import { useTheme } from "@/contexts/ThemeContext";

export default function Landing() {
  const navigate = useNavigate();
  const { isDark, toggle: toggleDark } = useTheme();
  const [resenas, setResenas] = useState<TestimonialData[]>([]);
  const [subscribeEmail, setSubscribeEmail] = useState("");

  useEffect(() => {
    getResenasAprobadas()
      .then((data) => {
        const mapped: TestimonialData[] = (data as Array<Record<string, unknown>>)
          .filter((r) => r.nombre && r.texto)
          .map((r) => ({
            text: r.texto as string,
            name: r.nombre as string,
            role: "Paciente",
            estrellas: (r.estrellas as number) || 5,
          }));
        setResenas(mapped);
      })
      .catch(() => {});
  }, []);

  const auroraColors = isDark
    ? {
        baseColor: "#0a0e1a",
        midColor: "#0f1b3d",
        sheenColor: "#67e8f9",
        accentColor: "#2dd4bf",
      }
    : {
        baseColor: "#e8f0f4",
        midColor: "#deeaf0",
        sheenColor: "#22d3ee",
        accentColor: "#0891B2",
      };

  const fadeUp = {
    hidden: { opacity: 0, y: 40 },
    visible: (i = 0) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.7, delay: i * 0.15, ease: [0.16, 1, 0.3, 1] as const },
    }),
  };

  return (
    <div className="min-h-screen bg-background dark:bg-[#070B18] transition-colors duration-300 selection:bg-primary/20">
      {/* Hero */}
      <section className="relative min-h-screen">
        <SilkAurora className="absolute inset-0 min-h-0" speed={0.8} intensity={1.5} lightOverlays={!isDark} {...auroraColors} />
        <div className="relative z-20 flex flex-col min-h-screen">
          <nav className="flex items-center justify-between px-6 md:px-12 py-5">
            <div className="flex items-center gap-3">
              <Stethoscope className="w-6 h-6 text-primary" />
              <span className="text-xl font-bold text-foreground dark:text-white">LIFELAB</span>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle isDark={isDark} onToggle={toggleDark} />
              <button className="text-sm text-foreground/70 dark:text-white/70 hover:text-foreground dark:hover:text-white transition-colors">Contacto</button>
              <button onClick={() => navigate("/auth")} className="px-5 py-2 text-sm font-semibold text-primary border-2 border-primary rounded-lg hover:bg-primary hover:text-white transition-all duration-200">
                Iniciar Sesión
              </button>
            </div>
          </nav>

          <div className="flex-1 flex items-center px-6 md:px-12 pb-20">
            <div className="max-w-[820px]">
              <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
                className="text-xs font-medium uppercase tracking-[0.24em] text-primary mb-5">
                Portal del Paciente
              </motion.p>
              <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
                className="text-[13cqi] md:text-[8cqi] lg:text-[6.4cqi] font-semibold leading-[0.86] tracking-normal bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent dark:from-secondary dark:via-white dark:to-secondary">
                Tu Salud, Siempre Conectada
              </motion.h1>
              <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
                className="mt-7 max-w-[620px] text-base md:text-xl leading-relaxed text-text-muted dark:text-white/68">
                Accede a tu historial clínico, agenda citas, consulta resultados y mantente en contacto con tus médicos desde cualquier lugar.
              </motion.p>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }}
                className="flex flex-wrap gap-4 mt-10">
                <button onClick={() => navigate("/auth")} className="px-8 py-3.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary-dark transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg shadow-primary/25">
                  Iniciar Sesión
                </button>
                <button onClick={() => navigate("/register")} className="px-8 py-3.5 border-2 border-primary text-primary rounded-xl font-semibold text-sm hover:bg-primary hover:text-white transition-all duration-300 hover:scale-105 active:scale-95">
                  Crear Cuenta
                </button>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 relative">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="text-center mb-16">
            <motion.p variants={fadeUp} custom={0} className="text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-4">Lo que ofrecemos</motion.p>
            <motion.h2 variants={fadeUp} custom={1} className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground dark:text-white">
              Servicios completos para tu salud
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="mt-4 text-text-muted text-lg max-w-2xl mx-auto">
              Una plataforma integral diseñada para cuidar de ti y tu familia.
            </motion.p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: Heart, title: "Historial Clínico", desc: "Accede a tus resultados y antecedentes médicos desde cualquier lugar, en cualquier momento." },
              { icon: Calendar, title: "Agenda de Citas", desc: "Programa y gestiona tus citas médicas de forma rápida y sencilla sin necesidad de llamar." },
              { icon: Shield, title: "Datos Seguros", desc: "Tus datos protegidos con los más altos estándares de seguridad y confidencialidad." },
              { icon: Microscope, title: "Resultados Online", desc: "Consulta tus resultados de laboratorio en línea tan pronto estén disponibles." },
            ].map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.div key={feature.title} initial="hidden" whileInView="visible" viewport={{ once: true }}
                  custom={i} variants={fadeUp}
                  className="group p-8 rounded-2xl border border-border bg-surface dark:bg-[#0E1325] hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground dark:text-white mb-2">{feature.title}</h3>
                  <p className="text-text-muted text-sm leading-relaxed">{feature.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="py-24 px-6 relative bg-surface dark:bg-[#070B18]">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="text-center mb-16">
            <motion.p variants={fadeUp} custom={0} className="text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-4">Proceso sencillo</motion.p>
            <motion.h2 variants={fadeUp} custom={1} className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground dark:text-white">
              ¿Cómo funciona?
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="mt-4 text-text-muted text-lg max-w-2xl mx-auto">
              Tres pasos simples para acceder a todos tus resultados de laboratorio.
            </motion.p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-8 relative">
            {[
              { icon: CheckCircle, step: "01", title: "Regístrate en línea", desc: "Crea tu cuenta en menos de 2 minutos. Solo necesitas tu correo y tus datos básicos." },
              { icon: FlaskConical, step: "02", title: "Realiza tus exámenes", desc: "Visita cualquiera de nuestras sedes. Tu médico ya puede solicitar tus análisis." },
              { icon: Smartphone, step: "03", title: "Recibe tus resultados", desc: "Accede a tus resultados desde cualquier dispositivo. Te notificaremos cuando estén listos." },
            ].map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div key={step.step} initial="hidden" whileInView="visible" viewport={{ once: true }}
                  custom={i} variants={fadeUp}
                  className="relative group">
                  <div className="p-8 rounded-2xl border border-border bg-surface dark:bg-[#0E1325] hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-300">
                    <span className="text-5xl font-black text-primary/10 dark:text-primary/5 select-none absolute top-4 right-6 leading-none">{step.step}</span>
                    <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                      <Icon className="w-7 h-7 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground dark:text-white mb-2">{step.title}</h3>
                    <p className="text-text-muted text-sm leading-relaxed">{step.desc}</p>
                  </div>
                  {i < 2 && (
                    <div className="hidden md:block absolute top-1/2 -right-4 -translate-y-1/2 z-10">
                      <ChevronRight className="w-6 h-6 text-primary/40" />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials with Aurora */}
      <section className="relative">
        <SilkAurora className="absolute inset-0 min-h-0" speed={0.6} intensity={1.0} lightOverlays={!isDark} {...auroraColors} />
        <div className="relative z-10">
          <TestimonialsSection testimonials={resenas} />
        </div>
      </section>

      {/* Mapa */}
      <section className="py-24 px-6 relative bg-surface dark:bg-[#070B18]">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="text-center mb-12">
            <motion.p variants={fadeUp} custom={0} className="text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-4">Encuéntranos</motion.p>
            <motion.h2 variants={fadeUp} custom={1} className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground dark:text-white">
              Nuestras Sedes
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="mt-4 text-text-muted text-lg max-w-2xl mx-auto">
              Usa tu ubicación actual para encontrar la ruta más cercana.
            </motion.p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
            <MapLifelab />
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <FAQ
        title="Preguntas Frecuentes"
        subtitle="Resolvemos tus dudas"
        categories={{
          general: "General",
          resultados: "Resultados",
          citas: "Citas y Pagos",
          preparacion: "Preparación",
        }}
        faqData={{
          general: [
            { question: "¿Necesito una orden médica para realizarme exámenes?", answer: "Sí, la mayoría de nuestros exámenes requieren una orden médica. Sin embargo, ofrecemos perfiles preventivos que puedes solicitar sin receta." },
            { question: "¿Qué métodos de pago aceptan?", answer: "Aceptamos efectivo, tarjetas de crédito/débito, transferencias bancarias y todas las principales aseguradoras con las que tenemos convenio." },
            { question: "¿Cómo puedo registrarme en el portal?", answer: "Puedes registrarte desde el botón 'Crear Cuenta' en la parte superior. Solo necesitas tu correo electrónico y crear una contraseña segura." },
          ],
          resultados: [
            { question: "¿Cuánto tiempo tardan los resultados?", answer: "Los resultados de exámenes básicos están disponibles en 24 horas. Los exámenes especializados pueden demorar entre 48 y 72 horas hábiles." },
            { question: "¿Cómo puedo ver mis resultados en línea?", answer: "Una vez registrado en nuestro portal, recibirás una notificación por correo cuando tus resultados estén listos. Ingresa con tu usuario y contraseña para descargarlos." },
            { question: "¿Puedo descargar mis resultados en PDF?", answer: "Sí, todos los resultados están disponibles en formato PDF para que puedas descargarlos, imprimirlos o compartirlos con tu médico." },
          ],
          citas: [
            { question: "¿Cómo agendo una cita?", answer: "Puedes agendar tus citas directamente desde nuestro portal en línea, seleccionando la sede, el día y la hora que mejor te convenga." },
            { question: "¿Puedo reprogramar o cancelar mi cita?", answer: "Sí, puedes reprogramar o cancelar tu cita hasta 24 horas antes desde el portal. También puedes llamarnos al (01) 234-5678." },
            { question: "¿Aceptan seguros médicos?", answer: "Sí, trabajamos con las principales aseguradoras del país. Al agendar tu cita puedes verificar si tu seguro tiene cobertura." },
          ],
          preparacion: [
            { question: "¿Debo ayunar para mis exámenes?", answer: "Depende del tipo de examen. Al agendar tu cita te indicaremos si requieres ayuno y por cuánto tiempo. Generalmente son 8 horas para exámenes de sangre." },
            { question: "¿Qué debo llevar el día de mi cita?", answer: "Debes llevar tu documento de identidad, la orden médica (si aplica) y los resultados de exámenes anteriores si tu médico los solicita." },
            { question: "¿Hay alguna preparación especial para exámenes de orina?", answer: "Se recomienda recoger la primera orina de la mañana. Para otros tipos de exámenes de orina, sigue las indicaciones específicas que te darán al agendar." },
          ],
        }}
      />

      {/* Footer */}
      <footer className="bg-[#070B18] text-white">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-10">
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <Stethoscope className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white">LIFELAB</span>
              </div>
              <p className="text-sm text-neutral-400 leading-relaxed mb-6">
                Transformando la experiencia de salud a través de la tecnología. Tu bienestar es nuestra prioridad.
              </p>
              <div className="flex items-center gap-3">
                <a href="#" className="w-10 h-10 rounded-xl bg-[#1877F2]/15 flex items-center justify-center text-[#1877F2] hover:bg-[#1877F2] hover:text-white hover:shadow-lg hover:shadow-[#1877F2]/25 transition-all duration-300" aria-label="Facebook">
                  <Facebook size={17} />
                </a>
                <a href="#" className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F58529]/15 via-[#DD2A7B]/15 to-[#8134AF]/15 flex items-center justify-center text-[#DD2A7B] hover:from-[#F58529] hover:via-[#DD2A7B] hover:to-[#8134AF] hover:text-white hover:shadow-lg hover:shadow-[#DD2A7B]/25 transition-all duration-300" aria-label="Instagram">
                  <Instagram size={17} />
                </a>
                <a href="#" className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white hover:text-black hover:shadow-lg transition-all duration-300" aria-label="TikTok">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4.5 h-4.5" aria-hidden="true">
                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                  </svg>
                </a>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-5">Servicios</h4>
              <ul className="space-y-3">
                {["Historial clínico", "Agenda de citas", "Resultados online"].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-sm text-neutral-400 hover:text-white transition-colors flex items-center gap-2">
                      <ChevronRight size={12} className="text-primary" /> {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-5">Enlaces</h4>
              <ul className="space-y-3">
                {["Quiénes somos", "Equipo médico", "Testimonios", "Blog", "Trabaja con nosotros"].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-sm text-neutral-400 hover:text-white transition-colors flex items-center gap-2">
                      <ChevronRight size={12} className="text-primary" /> {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-5">Contacto</h4>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-sm text-neutral-400">
                  <MapPin size={16} className="text-primary shrink-0 mt-0.5" />
                  Av. Salud 123, Miraflores, Lima
                </li>
                <li className="flex items-center gap-3 text-sm text-neutral-400">
                  <Phone size={16} className="text-primary shrink-0" />
                  (01) 234-5678
                </li>
                <li className="flex items-center gap-3 text-sm text-neutral-400">
                  <Mail size={16} className="text-primary shrink-0" />
                  contacto@lifelab.pe
                </li>
              </ul>
              <div className="mt-6">
                <p className="text-sm font-medium text-white mb-3">Boletín informativo</p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="tu@email.com"
                    value={subscribeEmail}
                    onChange={(e) => setSubscribeEmail(e.target.value)}
                    className="flex-1 h-10 px-4 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <button
                    onClick={() => {
                      if (!subscribeEmail) return;
                      const body = encodeURIComponent(
                        `Hola,\n\nTe compartimos información sobre LIFELAB - Portal del Paciente:\n\n` +
                        `LIFELAB es un laboratorio clínico con más de 15 años de experiencia.\n` +
                        `Ofrecemos más de 200 exámenes de laboratorio con resultados en 24 horas.\n` +
                        `Atención en 3 sedes: Miraflores, San Isidro y San Borja.\n` +
                        `Horario: Lun - Sáb 7:00 am - 8:00 pm.\n` +
                        `Contáctanos: (01) 234-5678 | contacto@lifelab.pe\n\n` +
                        `Agenda tu cita y consulta tus resultados en línea: https://lifelab.pe\n\n` +
                        `¡Gracias por confiar en nosotros!`
                      );
                      window.location.href = `mailto:${subscribeEmail}?subject=${encodeURIComponent("Información de LIFELAB - Portal del Paciente")}&body=${body}`;
                      setSubscribeEmail("");
                    }}
                    className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors"
                  >
                    Suscribir
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/5">
          <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-neutral-500">
              &copy; {new Date().getFullYear()} LIFELAB. Todos los derechos reservados.
            </p>
            <div className="flex gap-6 text-sm text-neutral-500">
              <a href="#" className="hover:text-white transition-colors">Términos</a>
              <a href="#" className="hover:text-white transition-colors">Privacidad</a>
              <a href="#" className="hover:text-white transition-colors">Cookies</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
