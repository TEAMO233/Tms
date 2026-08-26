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
                background: "#ffffff",
                color: "#27272a",
                border: "1px solid #e4e4e7",
                borderRadius: "10px",
                boxShadow: "0 8px 24px rgba(24, 24, 27, 0.08)",
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
