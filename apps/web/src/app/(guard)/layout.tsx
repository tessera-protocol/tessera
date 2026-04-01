"use client";

import { GuardDashboardProvider } from "@/lib/guard-dashboard-context";

export default function GuardRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <GuardDashboardProvider>{children}</GuardDashboardProvider>;
}
