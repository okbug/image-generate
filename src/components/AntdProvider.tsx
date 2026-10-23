"use client";

import { useEffect, useState } from "react";
import { App, ConfigProvider, theme } from "antd";
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
        // Claude 风格：陶土橙主色 + 暖色中性底，深色模式用炭灰
        token: {
          colorPrimary: isDark ? "#d97757" : "#c96442",
          colorInfo: isDark ? "#d97757" : "#c96442",
          colorLink: isDark ? "#d97757" : "#c96442",
          colorBgContainer: isDark ? "#30302e" : "#ffffff",
          colorBgElevated: isDark ? "#30302e" : "#ffffff",
          colorBgLayout: isDark ? "#262624" : "#faf9f5",
          colorBorder: isDark ? "#3d3d3a" : "#e8e6dc",
          colorBorderSecondary: isDark ? "#3d3d3a" : "#f0eee6",
          colorText: isDark ? "#faf9f5" : "#1f1e1d",
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
      {/* App 提供带主题上下文的 message / modal；它会包一层 div，让这层继续撑满 body 的 flex 布局 */}
      <App className="flex flex-1 flex-col">{children}</App>
    </ConfigProvider>
  );
}
