import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type ThemeContextType = {
  isDark: boolean;
  toggle: () => void;
  setDark: (dark: boolean) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  isDark: true,
  toggle: () => {},
  setDark: () => {},
});

function getInitialTheme(): boolean {
  const stored = localStorage.getItem("theme");
  if (stored === "dark") return true;
  if (stored === "light") return false;
  return true;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  const toggle = () => setIsDark((prev) => !prev);
  const setDark = (dark: boolean) => setIsDark(dark);

  return (
    <ThemeContext.Provider value={{ isDark, toggle, setDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
