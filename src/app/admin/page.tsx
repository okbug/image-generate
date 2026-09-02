import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

import { AdminPanel } from "./AdminPanel";

export const metadata: Metadata = {
  title: "管理后台 · AI 图片工坊",
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fadmin");
  if (user.role !== "admin") redirect("/");

  return <AdminPanel admin={user} />;
}
