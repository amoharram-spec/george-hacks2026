import type { Metadata } from "next";

import { TdeeCalculator } from "./tdee-calculator";

export const metadata: Metadata = {
  title: "TDEE calculator",
  description: "Estimate daily energy needs from weight, height, activity, and nutrition goals.",
};

export default function TdeePage() {
  return (
    <main className="min-h-screen bg-[#e8e6e1] px-4 py-10 sm:px-6 lg:px-8">
      <TdeeCalculator />
    </main>
  );
}
