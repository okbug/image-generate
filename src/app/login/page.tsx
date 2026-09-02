import { Suspense } from "react";
import type { Metadata } from "next";

import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = {
  title: "登录 · AI 图片工坊",
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <AuthForm mode="login" />
    </Suspense>
  );
}
