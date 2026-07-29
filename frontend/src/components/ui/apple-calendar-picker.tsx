import React, { useState, useEffect, useRef } from "react";

const ChevronLeftIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>;
const ChevronRightIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>;
const DropdownArrowIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>;
const CalendarIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const WEEKDAYS = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

export function normalizeDateString(str: string) {
  const d = new Date(str);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function formatDateString(date: Date) {
  if (isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function CalendarPicker({ value, onChange, placeholder = "Seleccionar fecha" }: { value: Date | null; onChange: (d: Date) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const today = value || new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [isDark, setIsDark] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayIndex = getFirstDayOfMonth(currentYear, currentMonth);

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  const handleSelectDay = (day: number) => {
    setSelectedDay(day);
    onChange(new Date(currentYear, currentMonth, day));
    setOpen(false);
  };

  const formatDisplay = (d: Date) => {
    return d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
  };

  const renderDays = () => {
    const days = [];
    for (let i = 0; i < firstDayIndex; i++) days.push(<div key={`e-${i}`} className="w-11 h-11" />);
    for (let day = 1; day <= daysInMonth; day++) {
      const isSelected = day === selectedDay && value?.getMonth() === currentMonth && value?.getFullYear() === currentYear;
      days.push(
        <button key={day} onClick={() => handleSelectDay(day)}
          className={`w-11 h-11 text-[17px] font-medium rounded-full flex items-center justify-center transition-all focus:outline-none ${
            isSelected ? "bg-primary text-white font-semibold shadow-md scale-105 z-10" : "text-foreground hover:bg-black/5 dark:hover:bg-white/10 dark:text-white"
          }`}>
          {day}
        </button>
      );
    }
    return days;
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-foreground dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all duration-200 flex items-center gap-2 text-left text-sm">
        <CalendarIcon />
        <span className={value ? "text-sm text-foreground dark:text-white" : "text-sm text-gray-400 dark:text-white/30"}>{value ? formatDisplay(value) : placeholder}</span>
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-0 sm:left-auto right-0 z-50 w-full sm:w-[340px] bg-white dark:bg-[#1C1C1E] border border-gray-200/60 dark:border-white/10 rounded-2xl shadow-xl p-5 transition-colors duration-200">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-1.5 text-base font-semibold text-foreground dark:text-white hover:opacity-75 transition-opacity focus:outline-none">
              <span>{MONTH_NAMES[currentMonth]} {currentYear}</span>
              <div className={`transition-transform duration-200 ${showDropdown ? "rotate-180" : "rotate-0"}`}><DropdownArrowIcon /></div>
            </button>
            <div className="flex items-center gap-1">
              <button onClick={prevMonth} className="p-1.5 text-foreground dark:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors focus:outline-none"><ChevronLeftIcon /></button>
              <button onClick={nextMonth} className="p-1.5 text-foreground dark:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors focus:outline-none"><ChevronRightIcon /></button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-y-1 mb-2 text-center">
            {WEEKDAYS.map(d => <div key={d} className="text-[11px] font-bold text-gray-400 dark:text-white/40 tracking-wider">{d}</div>)}
          </div>

          <div className="relative">
            <div className="grid grid-cols-7 gap-y-1 justify-items-center">{renderDays()}</div>

            {showDropdown && (
              <div className="absolute inset-0 z-30 flex flex-col p-3 rounded-xl bg-white dark:bg-[#1C1C1E] transition-all duration-200">
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100 dark:border-white/5">
                  <button onClick={() => setCurrentYear(y => y - 1)} className="p-1.5 text-foreground dark:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors"><ChevronLeftIcon /></button>
                  <span className="font-semibold text-foreground dark:text-white">{currentYear}</span>
                  <button onClick={() => setCurrentYear(y => y + 1)} className="p-1.5 text-foreground dark:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors"><ChevronRightIcon /></button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {MONTH_NAMES.map((m, idx) => (
                    <button key={m} onClick={() => { setCurrentMonth(idx); setShowDropdown(false); }}
                      className={`py-1.5 rounded-lg text-sm font-medium transition-all ${idx === currentMonth ? "bg-primary text-white" : "text-foreground dark:text-white hover:bg-black/5 dark:hover:bg-white/10"}`}>
                      {m.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
