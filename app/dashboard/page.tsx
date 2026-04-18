import type { Metadata } from "next";

import { DashboardView } from "./dashboard-view";
import { dashboardData } from "./mock-data";

export const metadata: Metadata = {
  title: "Nutrition Dashboard",
  description: "Daily nutrition dashboard with macro, micronutrient, and meal tracking.",
};

export default function DashboardPage() {
  return <DashboardView data={dashboardData} />;
}
