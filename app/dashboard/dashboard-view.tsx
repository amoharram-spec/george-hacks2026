"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { DashboardData, DailyMetric, Meal, Micronutrient } from "./mock-data";

type DashboardViewProps = {
  data: DashboardData;
};

const statusToneMap: Record<Micronutrient["status"], string> = {
  low: "bg-rose-100 text-rose-700",
  "on track": "bg-emerald-100 text-emerald-700",
  exceeded: "bg-amber-100 text-amber-700",
};

const quickActions = ["Upload Picture of meal", "View Plan", "Export Report"];
const primaryMicronutrientLabels = new Set([
  // --- Vitamins ---
  "Vitamin A", "Vitamin C", "Vitamin D", "Vitamin E", "Vitamin K",
  "Thiamine (B1)", "Riboflavin (B2)", "Niacin (B3)", "Pantothenic Acid (B5)",
  "Vitamin B6", "Vitamin B12", "Folate", "Folic Acid", "Biotin", "Choline",

  // --- Minerals ---
  "Calcium", "Chromium", "Copper", "Fluoride", "Iodine", "Iron",
  "Magnesium", "Manganese", "Molybdenum", "Phosphorus", "Potassium",
  "Selenium", "Sodium", "Zinc", "Chloride",

  // --- Amino Acids (Protein Detail) ---
  "Cystine", "Histidine", "Isoleucine", "Leucine", "Lysine",
  "Methionine", "Phenylalanine", "Threonine", "Tryptophan", "Tyrosine",
  "Valine", "Alanine", "Arginine", "Aspartic Acid", "Glutamic Acid",
  "Glycine", "Proline", "Serine", "Hydroxyproline",

  // --- Lipids (Fats & Cholesterol) ---
  "Saturated", "Monounsaturated", "Polyunsaturated",
  "Omega-3", "Omega-6", "Trans-Fat", "Cholesterol",
  "Phytosterol", "Alpha-Linolenic Acid (ALA)", "Eicosapentaenoic Acid (EPA)",
  "Docosahexaenoic Acid (DHA)", "Linoleic Acid",

  // --- Carbohydrates & Fiber ---
  "Fiber", "Soluble Fiber", "Insoluble Fiber", "Sugar", "Starch",
  "Net Carbs", "Added Sugar", "Sugar Alcohol",

  // --- Others --- 
  "Alcohol", "Caffeine", "Theobromine", "Ash", "Lycopene", "Lutein + Zeaxanthin"
]);
const smoothExpandTransition = {
  duration: 0.36,
  ease: [0.22, 1, 0.36, 1] as const,
};

function formatValue(value: number, unit: string) {
  return `${value}${unit}`;
}

function getPercent(consumed: number, target: number) {
  return Math.round((consumed / target) * 100);
}

function getClampedPercent(consumed: number, target: number) {
  return Math.min(getPercent(consumed, target), 100);
}

function getRemaining(consumed: number, target: number) {
  return Math.max(Number((target - consumed).toFixed(1)), 0);
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Macronutrients</p>
        </div>
      </div>

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
          <MicronutrientRow key={nutrient.label} nutrient={nutrient} />
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
                <MicronutrientRow key={nutrient.label} nutrient={nutrient} />
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
          <div
            className={`flex h-24 w-24 shrink-0 items-end rounded-[1.3rem] bg-gradient-to-br ${meal.palette} p-3 text-[11px] font-medium text-zinc-700`}
          >
            Photo
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">{meal.time}</p>
                <h3 className="mt-1 truncate text-[1.6rem] font-semibold leading-tight text-zinc-950">{meal.name}</h3>
              </div>
            </div>

            <p className="mt-2 text-sm font-semibold text-zinc-900">{meal.calories} Calories</p>
            <p className="mt-1 text-sm leading-6 text-emerald-600">{meal.note}</p>

            <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-zinc-500">
              <span className="rounded-full bg-zinc-50 px-3 py-1">Protein {meal.protein}g</span>
              <span className="rounded-full bg-zinc-50 px-3 py-1">Carbs {meal.carbs}g</span>
              <span className="rounded-full bg-zinc-50 px-3 py-1">Fat {meal.fat}g</span>
            </div>
          </div>
        </div>
      </button>

      <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${expanded ? "mt-4 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden border-t border-zinc-100 pt-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {meal.micros.map((micro) => (
              <div key={micro.label} className="rounded-2xl bg-zinc-50 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">{micro.label}</p>
                <p className="mt-1 text-sm font-semibold text-zinc-900">{micro.amount}</p>
              </div>
            ))}
          </div>
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
        const res = await fetch("/api/vitals", { cache: "no-store", headers: { 'Cache-Control': 'no-cache' } });
        if (res.ok) {
          const data = await res.json();
          setVitals(data);
        }
      } catch (err) {
        console.error("Failed to fetch vitals", err);
        setVitals(prev => ({ ...prev, live: false }));
      }
    };

    // Initial fetch
    fetchVitals();
    // Poll every second
    const interval = setInterval(fetchVitals, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("video", file);

    try {
      await fetch("/api/vitals", { method: "POST", body: formData });
      // The backend now started WSL processing, UI will update via polling 
      // once vitals.json is successfully overwritten with new data!
      setTimeout(() => setUploading(false), 2000);
    } catch (err) {
      console.error("Upload failed", err);
      setUploading(false);
    }
  };

  return (
    <article className="rounded-[1.9rem] border border-white/80 bg-white/95 p-5 shadow-[0_14px_40px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
          Presage Vitals
        </p>
        <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${uploading ? 'bg-amber-100 text-amber-700' : vitals.live ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${uploading ? 'bg-amber-500 animate-bounce' : vitals.live ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`}></span>
          {uploading ? 'PROCESSING...' : vitals.live ? 'LIVE SENSOR' : 'OFFLINE'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-zinc-50 rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden">
          {vitals.live && <div className="absolute inset-0 bg-red-50 opacity-50 animate-[pulse_1s_ease-in-out_infinite]" style={{ animationDuration: `${60 / (vitals.pulse || 60)}s` }}></div>}
          <div className="text-3xl font-semibold text-zinc-950 relative z-10">{vitals.pulse > 0 ? Math.round(vitals.pulse) : "--"}</div>
          <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest mt-1 relative z-10">BPM</div>
        </div>

        <div className="bg-zinc-50 rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden">
          {vitals.live && <div className="absolute inset-0 bg-blue-50 opacity-50 animate-[pulse_3s_ease-in-out_infinite]" style={{ animationDuration: `${60 / (vitals.breathing || 15)}s` }}></div>}
          <div className="text-3xl font-semibold text-zinc-950 relative z-10">{vitals.breathing > 0 ? Math.round(vitals.breathing) : "--"}</div>
          <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest mt-1 relative z-10">Resp Rate</div>
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
        className="w-full rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50 transition"
      >
        {uploading ? 'Processing Video...' : 'Upload Face Video (.mp4)'}
      </button>
    </article>
  );
}

export function DashboardView({ data }: DashboardViewProps) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [activeScrollArea, setActiveScrollArea] = useState<"left" | "right" | "meals" | null>(null);
  const leftSidebarRef = useRef<HTMLElement | null>(null);
  const rightColumnRef = useRef<HTMLElement | null>(null);
  const mealsListRef = useRef<HTMLDivElement | null>(null);

  const calories = data.dailySummary.find((metric) => metric.label === "Calories");
  const water = data.supportMetrics.find((metric) => metric.label === "Water");

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

  if (!calories || !water) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[#e8e6e1] px-4 py-4 sm:px-6 lg:h-screen lg:overflow-hidden lg:px-8 lg:py-6">
      <div className="mx-auto mb-3 flex w-full max-w-[1500px] justify-end">
        <Link
          href="/tdee"
          className="text-sm font-semibold text-zinc-600 underline-offset-4 transition hover:text-zinc-950 hover:underline"
        >
          TDEE calculator
        </Link>
      </div>
      <div className="mx-auto flex h-full w-full max-w-[1500px] flex-col gap-5 lg:grid lg:grid-cols-[340px_minmax(0,1fr)_340px] lg:gap-6">
        {/* Left sidebar — calories & macros */}
        <section
          ref={leftSidebarRef}
          className={`scrollbar-fade flex flex-col gap-5 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto lg:pr-2 ${activeScrollArea === "left" ? "scrollbar-fade-active" : ""}`}
        >
          <LiveVitalsCard />
          <CaloriesCard metric={calories} />
          <MacroWaterCard macros={data.macroRings} water={water} />
          <MicronutrientsCard micronutrients={data.micronutrients} />
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
                Scroll the list while keeping the rest of the dashboard visible on one page.
              </p>
            </div>

            <div
              ref={mealsListRef}
              className={`scrollbar-fade mt-5 flex-1 overflow-y-auto pr-1 ${activeScrollArea === "meals" ? "scrollbar-fade-active" : ""}`}
            >
              <div className="space-y-4 pb-2">
                {data.meals.map((meal) => (
                  <MealCard key={meal.id} meal={meal} />
                ))}
              </div>
            </div>
          </section>
        </section>
      </div>

      <div className="fixed right-5 bottom-5 z-20 sm:right-8 sm:bottom-8">
        <div className="relative flex flex-col items-end gap-3">
          {actionsOpen && (
            <div className="w-64 rounded-[1.75rem] border border-white/80 bg-white/95 p-3 shadow-[0_20px_50px_rgba(15,23,42,0.18)] backdrop-blur-sm">
              {quickActions.map((action) => (
                <button
                  key={action}
                  type="button"
                  className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                >
                  <span>{action}</span>
                  <span className="text-zinc-400">+</span>
                </button>
              ))}
            </div>
          )}

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
