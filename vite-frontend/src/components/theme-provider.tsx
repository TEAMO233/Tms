import { useEffect, type ReactNode } from "react";

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

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;

    root.classList.remove("dark", ...legacyThemeClasses);
    root.style.colorScheme = "light";
    localStorage.removeItem("skin");
  }, []);

  return <>{children}</>;
}
