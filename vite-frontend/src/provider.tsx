import type { NavigateOptions } from "react-router-dom";

import * as React from "react";
import { HeroUIProvider } from "@heroui/system";
import { useHref, useNavigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { I18nProvider } from "@react-aria/i18n";

import { ThemeProvider } from "@/components/theme-provider";

declare module "@react-types/shared" {
  interface RouterConfig {
    routerOptions: NavigateOptions;
  }
}

export interface ProvidersProps {
  children: React.ReactNode;
}

export function Provider({ children }: ProvidersProps) {
  const navigate = useNavigate();

  return (
    <I18nProvider locale="zh-CN">
      <HeroUIProvider navigate={navigate} useHref={useHref}>
        <ThemeProvider>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 2400,
              style: {
                background: "var(--tms-surface)",
                color: "var(--tms-text)",
                border: "1px solid var(--tms-border)",
                borderRadius: "10px",
                boxShadow: "var(--tms-shadow-md)",
                fontSize: "14px",
              },
              success: {
                style: {
                  borderColor: "#a7f3d0",
                },
              },
              error: {
                style: {
                  borderColor: "#fecaca",
                },
              },
            }}
          />
        </ThemeProvider>
      </HeroUIProvider>
    </I18nProvider>
  );
}
