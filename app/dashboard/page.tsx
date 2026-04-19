import type { Metadata } from "next";

import { getDatabase } from "@/lib/mongodb";
import { buildDashboardDataFromMealScans, type MealScanDocument } from "@/lib/meal-scans";

import { DashboardView } from "./dashboard-view";
import { dashboardData } from "./mock-data";

function getMealScanImageUrl(mealScanId: string) {
  return `/api/meal-scans/${mealScanId}/image`;
}

export const metadata: Metadata = {
  title: "Nutrition Dashboard",
  description: "Daily nutrition dashboard with macro, micronutrient, and meal tracking.",
};

export const dynamic = "force-dynamic";

async function getDashboardViewData() {
  try {
    const db = await getDatabase();
    const collection = db.collection("mealScans");
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const scans = (await collection
      .find({
        status: "completed",
        createdAt: { $gte: start, $lt: end },
      })
      .sort({ createdAt: -1 })
      .toArray()) as unknown as Array<MealScanDocument & { storageUrl?: string }>;

    if (scans.length === 0) {
      return dashboardData;
    }

    return buildDashboardDataFromMealScans(
      scans.map((scan) => ({
        ...scan,
        createdAt: new Date(scan.createdAt),
        imageUrl: scan._id ? getMealScanImageUrl(scan._id.toString()) : null,
      })),
    );
  } catch {
    return dashboardData;
  }
}

export default async function DashboardPage() {
  const data = await getDashboardViewData();

  return <DashboardView data={data} />;
}
