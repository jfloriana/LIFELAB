import React, { useState, useEffect, useRef } from "react";

const ChevronLeft = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
);
const ChevronRight = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
);

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const WEEKDAYS = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function firstDay(y: number, m: number) { return new Date(y, m, 1).getDay(); }

export function normalizeDateString(str: string) {
  const d = new Date(str);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function formatDateString(date: Date) {
  if (isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function classNames(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

interface CalendarPickerProps {
  value?: Date | null;
  onChange?: (d: Date) => void;
  placeholder?: string;
  isOpen?: boolean;
  onClose?: () => void;
  initialDate?: Date;
  minDate?: Date;
  showTime?: boolean;
}

export function CalendarPicker({
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  isOpen,
  onClose,
  initialDate,
  minDate,
}: CalendarPickerProps) {
  const todayRef = useRef(new Date());
  const today = todayRef.current;
  const initial = value ?? initialDate ?? today;

  const [open, setOpen] = useState(isOpen ?? false);
  const [year, setYear] = useState(initial.getFullYear());
  const [month, setMonth] = useState(initial.getMonth());
  const [mode, setMode] = useState<"days" | "months">("days");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen !== undefined) setOpen(isOpen);
    if (isOpen) {
      const d = value ?? initialDate ?? today;
      setYear(d.getFullYear());
      setMonth(d.getMonth());
      setMode("days");
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        onClose?.();
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const isPast = (y: number, m: number, d: number) => {
    if (!minDate) return false;
    const date = new Date(y, m, d);
    date.setHours(0, 0, 0, 0);
    const min = new Date(minDate);
    min.setHours(0, 0, 0, 0);
    return date < min;
  };

  const handleDay = (day: number) => {
    if (isPast(year, month, day)) return;
    onChange?.(new Date(year, month, day));
    setOpen(false);
    onClose?.();
  };

  const formatDisplay = (d: Date) =>
    d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });

  const renderDays = () => {
    const days: React.ReactNode[] = [];
    const dim = daysInMonth(year, month);
    const fd = firstDay(year, month);
    const selDay = value?.getDate();
    const selMonth = value?.getMonth();
    const selYear = value?.getFullYear();

    for (let i = 0; i < fd; i++) {
      days.push(<div key={`e${i}`} className="w-[46px] h-[46px]" />);
    }
    for (let d = 1; d <= dim; d++) {
      const selected = d === selDay && month === selMonth && year === selYear;
      const disabled = isPast(year, month, d);
      days.push(
        <button
          key={d}
          disabled={disabled}
          onClick={() => handleDay(d)}
          className={classNames(
            "w-[46px] h-[46px] text-[17px] font-medium rounded-full flex items-center justify-center transition-all select-none",
            selected
              ? "bg-primary text-white font-semibold"
              : disabled
                ? "text-muted-foreground/30 dark:text-white/15 cursor-default"
                : "text-foreground dark:text-white hover:bg-primary/10 dark:hover:bg-white/10 active:bg-primary/20"
          )}
        >
          {d}
        </button>
      );
    }
    return days;
  };

  const canGoNext = !minDate || new Date(year, month + 1, 0) < new Date(minDate.getFullYear() + 1, 0, 1) || true;
  const canGoPrev = !minDate || (() => {
    const firstOfMonth = new Date(year, month, 1);
    const m = new Date(minDate);
    m.setHours(0, 0, 0, 0);
    return firstOfMonth > m;
  })();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(!open); if (!open) setMode("days"); }}
        className="w-full h-10 px-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all duration-200 flex items-center gap-2.5 text-left text-sm"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary shrink-0">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span className={value ? "text-sm text-foreground dark:text-white" : "text-sm text-muted-foreground dark:text-white/30"}>
          {value ? formatDisplay(value) : placeholder}
        </span>
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-0 sm:left-auto right-0 z-50 w-full max-w-[340px] bg-card dark:bg-[#1C1C1E] border border-border dark:border-white/10 rounded-2xl shadow-lg dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] p-5 transition-colors duration-200">
          {mode === "months" ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setYear(y => y - 1)} className="p-1.5 text-foreground dark:text-white hover:bg-muted dark:hover:bg-white/10 rounded-lg transition-colors">
                  <ChevronLeft />
                </button>
                <span className="text-base font-semibold text-foreground dark:text-white">{year}</span>
                <button onClick={() => setYear(y => y + 1)} className="p-1.5 text-foreground dark:text-white hover:bg-muted dark:hover:bg-white/10 rounded-lg transition-colors">
                  <ChevronRight />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {MONTHS.map((m, i) => {
                  const isCur = i === month;
                  return (
                    <button
                      key={m}
                      onClick={() => { setMonth(i); setMode("days"); }}
                      className={classNames(
                        "py-2 rounded-xl text-sm font-medium transition-all",
                        isCur ? "bg-primary text-primary-foreground" : "text-foreground dark:text-white hover:bg-muted dark:hover:bg-white/10"
                      )}
                    >
                      {m.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setMode("months")}
                  className="flex items-center gap-1 text-base font-semibold text-foreground dark:text-white hover:opacity-75 transition-opacity"
                >
                  <span>{MONTHS[month]} {year}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5">
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </button>
                <div className="flex items-center gap-1">
                  <button onClick={prevMonth} className="p-1.5 text-foreground dark:text-white hover:bg-muted dark:hover:bg-white/10 rounded-lg transition-colors disabled:opacity-20" disabled={!canGoPrev}>
                    <ChevronLeft />
                  </button>
                  <button onClick={nextMonth} className="p-1.5 text-foreground dark:text-white hover:bg-muted dark:hover:bg-white/10 rounded-lg transition-colors">
                    <ChevronRight />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-y-1 mb-2">
                {WEEKDAYS.map(d => (
                  <div key={d} className="text-[11px] font-semibold text-gray-400 dark:text-white/40 text-center tracking-wider">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-y-1 justify-items-center">{renderDays()}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
