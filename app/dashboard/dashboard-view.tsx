"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { startTransition, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

import { readStoredTdeeResult } from "@/lib/tdee-storage";

import type { DashboardData, DailyMetric, Meal, Micronutrient } from "./types";

type DashboardViewProps = {
  data: DashboardData;
};

type MealScanResponse = {
  mealScanId: string;
  dashboardData: DashboardData;
  error?: string;
};

const primaryMicronutrientLabels = new Set([
  "Vitamin A", "Vitamin C", "Vitamin D", "Vitamin E", "Vitamin K",
  "Thiamine (B1)", "Riboflavin (B2)", "Niacin (B3)", "Pantothenic Acid (B5)",
  "Vitamin B6", "Vitamin B12", "Folate", "Choline",
  "Calcium", "Copper", "Iron", "Magnesium", "Manganese", "Phosphorus",
  "Potassium", "Selenium", "Sodium", "Zinc",
]);

const statusToneMap: Record<Micronutrient["status"], string> = {
  low: "bg-rose-100 text-rose-700",
  "on track": "bg-emerald-100 text-emerald-700",
  exceeded: "bg-amber-100 text-amber-700",
};

const smoothExpandTransition = {
  duration: 0.36,
  ease: [0.22, 1, 0.36, 1] as const,
};

function formatValue(value: number, unit: string) {
  return `${value}${unit}`;
}

function getPercent(consumed: number, target: number) {
  return target === 0 ? 0 : Math.round((consumed / target) * 100);
}

function getClampedPercent(consumed: number, target: number) {
  return Math.min(getPercent(consumed, target), 100);
}

function getRemaining(consumed: number, target: number) {
  return Math.max(Number((target - consumed).toFixed(1)), 0);
}

function formatConfidence(confidence: number | null) {
  if (confidence === null) {
    return "N/A";
  }

  return `${Math.round(confidence * 100)}%`;
}

function CaloriesCard({ metric }: { metric: DailyMetric }) {
  const progress = getPercent(metric.consumed, metric.target);

  return (
    <article className="rounded-[1.9rem] border border-white/80 bg-white/95 p-5 shadow-[0_14px_40px_rgba(15,23,42,0.08)]">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Calories</p>
      <p className="mt-4 text-5xl font-semibold leading-none text-zinc-950">{metric.consumed}</p>
      <div className="mt-4 h-2.5 rounded-full bg-zinc-100">
        <div className="h-2.5 rounded-full bg-rose-300" style={{ width: `${getClampedPercent(metric.consumed, metric.target)}%` }} />
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-zinc-500">
        <span>{progress}% complete</span>
        <span>{formatValue(getRemaining(metric.consumed, metric.target), metric.unit)} left</span>
      </div>
    </article>
  );
}

function MiniRing({ metric }: { metric: DailyMetric }) {
  const size = 52;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = getClampedPercent(metric.consumed, metric.target);
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e4e4e7" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={metric.tone}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          className="fill-zinc-950 text-[10px] font-semibold"
        >
          {progress}%
        </text>
      </svg>
      <div>
        <p className="text-[11px] font-semibold text-zinc-800">{metric.label}</p>
        <p className="text-[11px] text-zinc-500">{metric.consumed}/{metric.target}{metric.unit}</p>
      </div>
    </div>
  );
}

function MacroWaterCard({ macros, water }: { macros: DailyMetric[]; water: DailyMetric }) {
  return (
    <article className="rounded-[1.9rem] border border-white/80 bg-white/95 p-5 shadow-[0_14px_40px_rgba(15,23,42,0.08)]">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Macronutrients</p>

      <div className="mt-5 grid grid-cols-4 justify-items-center gap-4">
        {macros.map((metric) => (
          <MiniRing key={metric.label} metric={metric} />
        ))}
        <MiniRing metric={{ ...water, tone: "#5ec6e8" }} />
      </div>
    </article>
  );
}

function MicronutrientRow({ nutrient }: { nutrient: Micronutrient }) {
  const progress = getPercent(nutrient.consumed, nutrient.target);
  const clampedProgress = getClampedPercent(nutrient.consumed, nutrient.target);

  return (
    <div className="grid grid-cols-[minmax(0,96px)_1fr_auto] items-center gap-3 text-sm">
      <p className="truncate font-medium text-zinc-700">{nutrient.label}</p>
      <div className="flex items-center gap-3">
        <div className="h-2.5 flex-1 rounded-full bg-zinc-100">
          <div className={`h-2.5 rounded-full ${nutrient.tone}`} style={{ width: `${clampedProgress}%` }} />
        </div>
        <span className="w-10 text-right text-xs font-medium text-zinc-500">{progress}%</span>
      </div>
      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusToneMap[nutrient.status]}`}>
        {nutrient.status}
      </span>
    </div>
  );
}

function MicronutrientsCard({ micronutrients }: { micronutrients: Micronutrient[] }) {
  const [expanded, setExpanded] = useState(false);

  const primaryNutrients = micronutrients.filter((nutrient) => primaryMicronutrientLabels.has(nutrient.label));
  const additionalNutrients = micronutrients.filter((nutrient) => !primaryMicronutrientLabels.has(nutrient.label));

  return (
    <article className="rounded-[2rem] border border-white/80 bg-white/95 p-5 shadow-[0_14px_40px_rgba(15,23,42,0.08)]">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Micronutrients</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">Vitamins and minerals</h2>
        </div>
        <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
          {expanded ? "Show less" : "Show all"}
        </span>
      </button>

      <div className="mt-6 grid gap-4">
        {primaryNutrients.map((nutrient) => (
          <MicronutrientRow key={nutrient.key} nutrient={nutrient} />
        ))}
      </div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="additional-micronutrients"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: smoothExpandTransition,
              opacity: { duration: 0.18, ease: "easeOut" },
            }}
            className="overflow-hidden"
          >
            <motion.div
              initial={{ y: -8 }}
              animate={{ y: 0 }}
              exit={{ y: -8 }}
              transition={smoothExpandTransition}
              className="mt-4 grid gap-4"
            >
              {additionalNutrients.map((nutrient) => (
                <MicronutrientRow key={nutrient.key} nutrient={nutrient} />
              ))}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </article>
  );
}

function MealCard({ meal }: { meal: Meal }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="rounded-[1.9rem] border border-white/80 bg-white/95 p-4 shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
      <button type="button" onClick={() => setExpanded((current) => !current)} className="w-full text-left" aria-expanded={expanded}>
        <div className="flex gap-4">
          <div className={`h-24 w-24 shrink-0 overflow-hidden rounded-[1.3rem] bg-gradient-to-br ${meal.palette}`}>
            {meal.imageUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={meal.imageUrl} alt={meal.name} className="h-full w-full object-cover" />
              </>
            ) : (
              <div className="flex h-full w-full items-end p-3 text-[11px] font-medium text-zinc-700">Photo</div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">{meal.time}</p>
                <h3 className="mt-1 truncate text-[1.6rem] font-semibold leading-tight text-zinc-950">{meal.name}</h3>
              </div>
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
                {formatConfidence(meal.confidence)} confidence
              </span>
            </div>

            <p className="mt-2 text-sm font-semibold text-zinc-900">{meal.calories} Calories</p>
            <p className="mt-1 text-sm leading-6 text-emerald-600">{meal.note}</p>

            <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-zinc-500">
              <span className="rounded-full bg-zinc-50 px-3 py-1">Protein {meal.protein}g</span>
              <span className="rounded-full bg-zinc-50 px-3 py-1">Carbs {meal.carbs}g</span>
              <span className="rounded-full bg-zinc-50 px-3 py-1">Fat {meal.fat}g</span>
              <span className="rounded-full bg-zinc-50 px-3 py-1">Fiber {meal.fiber}g</span>
            </div>
          </div>
        </div>
      </button>

      <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${expanded ? "mt-4 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden border-t border-zinc-100 pt-4">
          <div className="flex flex-wrap gap-2 text-xs font-medium text-zinc-500">
            <span className="rounded-full bg-zinc-50 px-3 py-1">Serving {meal.servingSizeEstimate}</span>
            <span className="rounded-full bg-zinc-50 px-3 py-1">Sugar {meal.sugar}g</span>
            <span className="rounded-full bg-zinc-50 px-3 py-1">Sodium {meal.sodium}mg</span>
          </div>

          {meal.warnings.length > 0 ? (
            <div className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {meal.warnings.join(" ")}
            </div>
          ) : null}

          <div className="mt-4 grid gap-3">
            {meal.foods.map((food) => (
              <div key={`${meal.id}-${food.name}`} className="rounded-[1.4rem] border border-zinc-100 bg-zinc-50/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-950">{food.name}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {food.servingSizeEstimate}
                      {food.gramsEstimate ? ` • ~${food.gramsEstimate}g` : ""}
                      {food.confidence !== null ? ` • ${formatConfidence(food.confidence)} confidence` : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-500">{food.dataSource}</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-zinc-500">
                  <span className="rounded-full bg-white px-3 py-1">{food.calories} kcal</span>
                  <span className="rounded-full bg-white px-3 py-1">P {food.protein}g</span>
                  <span className="rounded-full bg-white px-3 py-1">C {food.carbs}g</span>
                  <span className="rounded-full bg-white px-3 py-1">F {food.fat}g</span>
                  <span className="rounded-full bg-white px-3 py-1">Fiber {food.fiber}g</span>
                  <span className="rounded-full bg-white px-3 py-1">Sugar {food.sugar}g</span>
                  <span className="rounded-full bg-white px-3 py-1">Sodium {food.sodium}mg</span>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {food.micronutrients.slice(0, 8).map((micro) => (
                    <div key={`${food.name}-${micro.key}`} className="rounded-2xl bg-white px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">{micro.label}</p>
                      <p className="mt-1 text-sm font-semibold text-zinc-900">{micro.amount}{micro.unit}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {meal.micros.length > 0 ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {meal.micros.map((micro) => (
                <div key={micro.label} className="rounded-2xl bg-zinc-50 px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">{micro.label}</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-900">{micro.amount}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function LiveVitalsCard() {
  const [vitals, setVitals] = useState({ live: false, pulse: 0, breathing: 0 });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchVitals = async () => {
      try {
        const res = await fetch("/api/vitals", { cache: "no-store", headers: { "Cache-Control": "no-cache" } });
        if (res.ok) {
          const data = await res.json();
          setVitals(data);
        }
      } catch (err) {
        console.error("Failed to fetch vitals", err);
        setVitals((prev) => ({ ...prev, live: false }));
      }
    };

    fetchVitals();
    const interval = setInterval(fetchVitals, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("video", file);

    try {
      await fetch("/api/vitals", { method: "POST", body: formData });
      setTimeout(() => setUploading(false), 2000);
    } catch (err) {
      console.error("Upload failed", err);
      setUploading(false);
    } finally {
      event.target.value = "";
    }
  };

  return (
    <article className="rounded-[1.9rem] border border-white/80 bg-white/95 p-5 shadow-[0_14px_40px_rgba(15,23,42,0.08)]">
      <div className="mb-4 flex items-center justify-between">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Presage Vitals</p>
        <span className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${uploading ? "bg-amber-100 text-amber-700" : vitals.live ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${uploading ? "bg-amber-500 animate-bounce" : vitals.live ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"}`}></span>
          {uploading ? "PROCESSING..." : vitals.live ? "LIVE SENSOR" : "OFFLINE"}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl bg-zinc-50 p-4">
          {vitals.live && <div className="absolute inset-0 bg-red-50 opacity-50 animate-[pulse_1s_ease-in-out_infinite]" style={{ animationDuration: `${60 / (vitals.pulse || 60)}s` }}></div>}
          <div className="relative z-10 text-3xl font-semibold text-zinc-950">{vitals.pulse > 0 ? Math.round(vitals.pulse) : "--"}</div>
          <div className="relative z-10 mt-1 text-[10px] font-medium uppercase tracking-widest text-zinc-500">BPM</div>
        </div>

        <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl bg-zinc-50 p-4">
          {vitals.live && <div className="absolute inset-0 bg-blue-50 opacity-50 animate-[pulse_3s_ease-in-out_infinite]" style={{ animationDuration: `${60 / (vitals.breathing || 15)}s` }}></div>}
          <div className="relative z-10 text-3xl font-semibold text-zinc-950">{vitals.breathing > 0 ? Math.round(vitals.breathing) : "--"}</div>
          <div className="relative z-10 mt-1 text-[10px] font-medium uppercase tracking-widest text-zinc-500">Resp Rate</div>
        </div>
      </div>

      <input
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileUpload}
        disabled={uploading}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="w-full rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-50"
      >
        {uploading ? "Processing Video..." : "Upload Face Video (.mp4)"}
      </button>
    </article>
  );
}

export function DashboardView({ data }: DashboardViewProps) {
  const [uploadedDashboardData, setUploadedDashboardData] = useState<DashboardData | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [mealUploading, setMealUploading] = useState(false);
  const [mealUploadError, setMealUploadError] = useState("");
  const [activeScrollArea, setActiveScrollArea] = useState<"left" | "right" | "meals" | null>(null);
  const [calorieTargetOverride] = useState<number | null>(() => readStoredTdeeResult()?.targetCalories ?? null);
  const leftSidebarRef = useRef<HTMLElement | null>(null);
  const rightColumnRef = useRef<HTMLElement | null>(null);
  const mealsListRef = useRef<HTMLDivElement | null>(null);
  const mealFileInputRef = useRef<HTMLInputElement>(null);

  const dashboardData = useMemo<DashboardData>(() => {
    const baseData = uploadedDashboardData ?? data;

    if (calorieTargetOverride === null) {
      return baseData;
    }

    return {
      ...baseData,
      dailySummary: baseData.dailySummary.map((metric) =>
        metric.label === "Calories" ? { ...metric, target: calorieTargetOverride } : metric,
      ),
      supportMetrics: baseData.supportMetrics.map((metric) =>
        metric.label === "Calories" ? { ...metric, target: calorieTargetOverride } : metric,
      ),
    };
  }, [calorieTargetOverride, data, uploadedDashboardData]);

  const calories = dashboardData.dailySummary.find((metric) => metric.label === "Calories");
  const water = dashboardData.supportMetrics.find((metric) => metric.label === "Water");

  useEffect(() => {
    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    const registerScrollFade = (key: "left" | "right" | "meals", node: HTMLElement | null) => {
      if (!node) {
        return () => undefined;
      }

      const handleScroll = () => {
        setActiveScrollArea(key);

        const existingTimer = timers.get(key);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        const nextTimer = setTimeout(() => {
          setActiveScrollArea((current) => (current === key ? null : current));
          timers.delete(key);
        }, 900);

        timers.set(key, nextTimer);
      };

      node.addEventListener("scroll", handleScroll, { passive: true });

      return () => {
        node.removeEventListener("scroll", handleScroll);
        const existingTimer = timers.get(key);
        if (existingTimer) {
          clearTimeout(existingTimer);
          timers.delete(key);
        }
      };
    };

    const cleanups = [
      registerScrollFade("left", leftSidebarRef.current),
      registerScrollFade("right", rightColumnRef.current),
      registerScrollFade("meals", mealsListRef.current),
    ];

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, []);

  const handleMealUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setMealUploading(true);
    setMealUploadError("");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/meal-scans", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as MealScanResponse;

      if (!response.ok) {
        setMealUploadError(payload.error ?? "Meal scan failed.");
        return;
      }

      startTransition(() => {
        setUploadedDashboardData(payload.dashboardData);
      });
      setActionsOpen(false);
    } catch {
      setMealUploadError("Meal scan failed. Please try again.");
    } finally {
      setMealUploading(false);
      event.target.value = "";
    }
  };

  const handleQuickAction = (action: string) => {
    if (action !== "Upload Picture of meal" && action !== "Scanning meal...") {
      return;
    }

    setMealUploadError("");
    mealFileInputRef.current?.click();
  };

  if (!calories || !water) {
    return null;
  }

  const quickActions = [mealUploading ? "Scanning meal..." : "Upload Picture of meal", "View Plan", "Export Report"] as const;

  return (
    <main className="min-h-screen bg-[#e8e6e1] px-4 py-4 sm:px-6 lg:h-screen lg:overflow-hidden lg:px-8 lg:py-6">
      <div className="mx-auto mb-3 flex w-full max-w-[1500px] items-center justify-between gap-4">
        <p className="text-sm font-medium text-zinc-500">{dashboardData.dateLabel}</p>
        <Link
          href="/tdee"
          className="text-sm font-semibold text-zinc-600 underline-offset-4 transition hover:text-zinc-950 hover:underline"
        >
          TDEE calculator
        </Link>
      </div>
      <div className="mx-auto flex h-full w-full max-w-[1500px] flex-col gap-5 lg:grid lg:grid-cols-[340px_minmax(0,1fr)_340px] lg:gap-6">
        <section
          ref={leftSidebarRef}
          className={`scrollbar-fade flex flex-col gap-5 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto lg:pr-2 ${activeScrollArea === "left" ? "scrollbar-fade-active" : ""}`}
        >
          <LiveVitalsCard />
          <CaloriesCard metric={calories} />
          <MacroWaterCard macros={dashboardData.macroRings} water={water} />
          <MicronutrientsCard micronutrients={dashboardData.micronutrients} />
        </section>

        <section
          ref={rightColumnRef}
          className={`scrollbar-fade flex min-h-0 flex-col lg:h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-2 ${activeScrollArea === "right" ? "scrollbar-fade-active" : ""}`}
        >
          <section className="flex min-h-0 flex-1 flex-col rounded-[2rem] border border-white/80 bg-white/95 p-5 shadow-[0_14px_40px_rgba(15,23,42,0.08)] lg:min-h-[720px]">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Today&apos;s meals</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">All meals logged today</h2>
              </div>
              <p className="max-w-sm text-right text-sm leading-6 text-zinc-500">
                Scan a meal image from the + menu to detect foods, ground the numbers with USDA data, and save the result.
              </p>
            </div>

            <div
              ref={mealsListRef}
              className={`scrollbar-fade mt-5 flex-1 overflow-y-auto pr-1 ${activeScrollArea === "meals" ? "scrollbar-fade-active" : ""}`}
            >
              {dashboardData.meals.length > 0 ? (
                <div className="space-y-4 pb-2">
                  {dashboardData.meals.map((meal) => (
                    <MealCard key={meal.id} meal={meal} />
                  ))}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center rounded-[1.6rem] border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-12 text-center text-sm leading-6 text-zinc-500">
                  No meals scanned yet. Use the + button to upload a meal photo and generate a grounded nutrition breakdown.
                </div>
              )}
            </div>
          </section>
        </section>

        <section className="rounded-[2rem] border border-white/80 bg-white/95 p-5 shadow-[0_14px_40px_rgba(15,23,42,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Recommendation</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">{dashboardData.recommendation.title}</h2>
          <p className="mt-4 text-sm leading-6 text-zinc-600">{dashboardData.recommendation.summary}</p>
          <p className="mt-4 text-sm leading-6 text-zinc-600">{dashboardData.recommendation.alignment}</p>
          <p className="mt-4 rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-700">{dashboardData.recommendation.nextMeal}</p>
          <div className="mt-4 space-y-3">
            {dashboardData.recommendation.reasons.map((reason) => (
              <div key={reason} className="rounded-2xl border border-zinc-100 px-4 py-3 text-sm text-zinc-600">
                {reason}
              </div>
            ))}
          </div>
        </section>
      </div>

      <input
        ref={mealFileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={handleMealUpload}
        disabled={mealUploading}
      />

      <div className="fixed bottom-5 right-5 z-20 sm:bottom-8 sm:right-8">
        <div className="relative flex flex-col items-end gap-3">
          {mealUploadError ? (
            <div className="w-72 rounded-[1.3rem] border border-rose-200 bg-white/95 px-4 py-3 text-sm text-rose-700 shadow-[0_20px_50px_rgba(15,23,42,0.12)]">
              {mealUploadError}
            </div>
          ) : null}

          {actionsOpen ? (
            <div className="w-64 rounded-[1.75rem] border border-white/80 bg-white/95 p-3 shadow-[0_20px_50px_rgba(15,23,42,0.18)] backdrop-blur-sm">
              {quickActions.map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => handleQuickAction(action)}
                  disabled={mealUploading && action.includes("Upload Picture")}
                  className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>{action}</span>
                  <span className="text-zinc-400">+</span>
                </button>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setActionsOpen((current) => !current)}
            aria-expanded={actionsOpen}
            aria-label="Open quick actions"
            className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-950 text-4xl font-light text-white shadow-[0_18px_40px_rgba(15,23,42,0.3)] transition hover:scale-105 hover:bg-zinc-800"
          >
            +
          </button>
        </div>
      </div>
    </main>
  );
}
