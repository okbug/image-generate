import { Suspense } from "react";
import type { Metadata } from "next";

import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = {
  title: "注册 · AI 图片工坊",
};

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <AuthForm mode="register" />
    </Suspense>
  );
}
