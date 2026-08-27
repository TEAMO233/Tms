import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const THEME_STORAGE_KEY = "tms_theme";
export type ThemeName = "light" | "dark";

const legacyThemeClasses = [
  "aurora",
  "mesh",
  "deepsea",
  "sunrise",
  "cyber",
  "mint",
  "midnight",
  "clean",
  "forest",
  "lava",
  "sakura",
  "grape",
  "sand",
  "steel",
];

function readStoredTheme(): ThemeName {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: ThemeName) {
  const root = document.documentElement;

  root.classList.remove(...legacyThemeClasses);
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    localStorage.removeItem("skin");
  } catch {
    // ignore quota / private-mode failures
  }
}

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  setTheme: () => undefined,
  toggleTheme: () => undefined,
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    if (typeof document === "undefined") return "light";

    return document.documentElement.classList.contains("dark")
      ? "dark"
      : readStoredTheme();
  });

  const setTheme = useCallback((next: ThemeName) => {
    setThemeState(next);
    applyTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next: ThemeName = current === "dark" ? "light" : "dark";

      applyTheme(next);

      return next;
    });
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
