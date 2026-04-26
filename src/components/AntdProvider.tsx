"use client";

import { useEffect, useState } from "react";
import { ConfigProvider, theme } from "antd";
import zhCN from "antd/locale/zh_CN";

function useIsDark(): boolean {
  const [isDark, setIsDark] = useState<boolean>(false);

  useEffect(() => {
    const update = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

export function AntdProvider({ children }: { children: React.ReactNode }) {
  const isDark = useIsDark();

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: "#6366f1",
          colorInfo: "#6366f1",
          borderRadius: 12,
          fontFamily:
            "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
        },
        components: {
          Select: { controlHeight: 44, borderRadiusLG: 12 },
          Input: { controlHeight: 44, borderRadiusLG: 12 },
          Button: { controlHeight: 44, borderRadiusLG: 12 },
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
