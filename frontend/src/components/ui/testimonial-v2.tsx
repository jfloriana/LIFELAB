import React from 'react';
import { motion } from "framer-motion";
import { Star } from 'lucide-react';

export interface TestimonialData {
  text: string;
  name: string;
  role?: string;
  image?: string;
  estrellas?: number;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

interface TestimonialsColumnProps {
  className?: string;
  testimonials: TestimonialData[];
  duration?: number;
}

const TestimonialsColumn = ({ className, testimonials: items, duration = 10 }: TestimonialsColumnProps) => {
  return (
    <div className={className}>
      <motion.ul
        animate={{ translateY: "-50%" }}
        transition={{
          duration,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        }}
        className="flex flex-col gap-6 pb-6 bg-transparent list-none m-0 p-0"
      >
        {[...new Array(2)].map((_, index) => (
          <React.Fragment key={index}>
            {items.map((item, i) => (
              <motion.li
                key={`${index}-${i}`}
                aria-hidden={index === 1 ? "true" : "false"}
                tabIndex={index === 1 ? -1 : 0}
                whileHover={{
                  scale: 1.03,
                  y: -8,
                  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.12), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.05)",
                  transition: { type: "spring", stiffness: 400, damping: 17 }
                }}
                whileFocus={{
                  scale: 1.03,
                  y: -8,
                  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.12), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.05)",
                  transition: { type: "spring", stiffness: 400, damping: 17 }
                }}
                className="p-10 rounded-3xl border border-neutral-200 dark:border-white/5 shadow-lg shadow-black/5 max-w-xs w-full bg-white dark:bg-[#0E1325] transition-all duration-300 cursor-default select-none group focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <blockquote className="m-0 p-0">
                  {item.estrellas && (
                    <div className="flex gap-1 mb-3">
                      {Array.from({ length: item.estrellas }).map((_, s) => (
                        <Star key={s} size={14} className="fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                  )}
                  <p className="text-neutral-600 dark:text-white/60 leading-relaxed font-normal m-0 transition-colors duration-300">
                    {item.text}
                  </p>
                  <footer className="flex items-center gap-3 mt-6">
                    {item.image ? (
                      <img
                        width={40}
                        height={40}
                        src={item.image}
                        alt={`Avatar de ${item.name}`}
                        className="h-10 w-10 rounded-full object-cover ring-2 ring-neutral-100 dark:ring-white/10 group-hover:ring-primary/30 transition-all duration-300"
                      />
                    ) : (
                      <div                         className="h-10 w-10 rounded-full bg-gradient-to-br from-teal-400 to-cyan-400 flex items-center justify-center ring-2 ring-neutral-100 dark:ring-white/10 group-hover:ring-primary/30 transition-all duration-300">
                        <span className="text-white font-semibold text-sm">
                          {item.name.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div className="flex flex-col">
                      <cite className="font-semibold not-italic tracking-tight leading-5 text-neutral-900 dark:text-white transition-colors duration-300 text-sm">
                        {item.name}
                      </cite>
                      {item.role && (
                        <span className="text-sm leading-5 tracking-tight text-neutral-500 dark:text-white/40 mt-0.5 transition-colors duration-300">
                          {item.role}
                        </span>
                      )}
                    </div>
                  </footer>
                </blockquote>
              </motion.li>
            ))}
          </React.Fragment>
        ))}
      </motion.ul>
    </div>
  );
};

interface TestimonialsSectionProps {
  testimonials?: TestimonialData[];
}

export function TestimonialsSection({ testimonials }: TestimonialsSectionProps) {
  const data = testimonials && testimonials.length > 0 ? testimonials : [];
  if (data.length === 0) return null;
  const columns = chunkArray(data, Math.ceil(data.length / 3));
  const col1 = columns[0] || [];
  const col2 = columns[1] || [];
  const col3 = columns[2] || [];

  return (
    <section className="bg-transparent py-24 relative overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 50, rotate: -2 }}
        whileInView={{ opacity: 1, y: 0, rotate: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{
          duration: 1.2,
          ease: [0.16, 1, 0.3, 1],
          opacity: { duration: 0.8 }
        }}
        className="container px-4 z-10 mx-auto"
      >
        <div className="flex flex-col items-center justify-center max-w-[540px] mx-auto mb-16">
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-center text-neutral-900 dark:text-white transition-colors">
            Lo que dicen nuestros pacientes
          </h2>
          <p className="text-center mt-5 text-neutral-500 dark:text-neutral-400 text-lg leading-relaxed max-w-sm transition-colors">
            Conoce las experiencias de quienes confían en nosotros.
          </p>
        </div>

        <div
          className="flex justify-center gap-6 mt-10 [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)] max-h-[740px] overflow-hidden"
          role="region"
          aria-label="Testimonios de pacientes"
        >
          <TestimonialsColumn testimonials={col1} duration={15} />
          <TestimonialsColumn testimonials={col2} className="hidden md:block" duration={19} />
          <TestimonialsColumn testimonials={col3} className="hidden lg:block" duration={17} />
        </div>
      </motion.div>
    </section>
  );
}

export default TestimonialsSection;
