"use client";

import { useState } from "react";

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

function CircleMetric({ metric }: { metric: DailyMetric }) {
  const size = 120;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = getClampedPercent(metric.consumed, metric.target);
  const offset = circumference - (progress / 100) * circumference;

  return (
    <article className="rounded-[2rem] border border-white/80 bg-white/95 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-500">{metric.label}</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-950">
            {metric.consumed}
            <span className="ml-1 text-sm font-medium text-zinc-500">/ {metric.target}{metric.unit}</span>
          </p>
        </div>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
          {progress}%
        </span>
      </div>

      <div className="flex items-center gap-4">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e4e4e7"
            strokeWidth={strokeWidth}
          />
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
            className="fill-zinc-950 text-[20px] font-semibold"
          >
            {progress}%
          </text>
        </svg>

        <div className="space-y-2 text-sm text-zinc-600">
          <p>Target: {formatValue(metric.target, metric.unit)}</p>
          <p>Consumed: {formatValue(metric.consumed, metric.unit)}</p>
          <p>Remaining: {formatValue(getRemaining(metric.consumed, metric.target), metric.unit)}</p>
        </div>
      </div>
    </article>
  );
}

function LinearMetric({ metric }: { metric: DailyMetric }) {
  const progress = getPercent(metric.consumed, metric.target);
  const clampedProgress = getClampedPercent(metric.consumed, metric.target);

  return (
    <article className="rounded-[1.75rem] border border-white/80 bg-white/95 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-500">{metric.label}</p>
          <p className="mt-1 text-xl font-semibold text-zinc-950">
            {metric.consumed}
            <span className="ml-1 text-sm font-medium text-zinc-500">/ {metric.target}{metric.unit}</span>
          </p>
        </div>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
          {progress}%
        </span>
      </div>
      <div className="mt-4 h-3 rounded-full bg-zinc-100">
        <div
          className={`h-3 rounded-full ${metric.tone}`}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-zinc-500">
        <span>Remaining {formatValue(getRemaining(metric.consumed, metric.target), metric.unit)}</span>
        <span>{clampedProgress}% complete</span>
      </div>
    </article>
  );
}

function MealCard({ meal }: { meal: Meal }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="rounded-[2rem] border border-white/80 bg-white/95 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] transition-transform duration-200 hover:-translate-y-0.5">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="w-full text-left"
        aria-expanded={expanded}
      >
        <div className="flex flex-col gap-5 md:flex-row md:items-start">
          <div
            className={`flex h-28 w-full shrink-0 items-end rounded-[1.5rem] bg-gradient-to-br ${meal.palette} p-4 text-sm font-medium text-zinc-700 md:w-40`}
          >
            Meal photo
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">{meal.time}</p>
                <h3 className="mt-2 text-2xl font-semibold text-zinc-950">{meal.name}</h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600">{meal.note}</p>
              </div>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-semibold text-zinc-600">
                {expanded ? "Hide details" : "Show micros"}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MealStat label="Calories" value={`${meal.calories}`} unit="kcal" />
              <MealStat label="Protein" value={`${meal.protein}`} unit="g" />
              <MealStat label="Carbs" value={`${meal.carbs}`} unit="g" />
              <MealStat label="Fat" value={`${meal.fat}`} unit="g" />
            </div>
          </div>
        </div>
      </button>

      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${expanded ? "mt-5 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden border-t border-zinc-100 pt-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {meal.micros.map((micro) => (
              <div key={micro.label} className="rounded-2xl bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">{micro.label}</p>
                <p className="mt-2 text-lg font-semibold text-zinc-900">{micro.amount}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

function MealStat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-2xl bg-zinc-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-zinc-950">
        {value}
        <span className="ml-1 text-sm font-medium text-zinc-500">{unit}</span>
      </p>
    </div>
  );
}

export function DashboardView({ data }: DashboardViewProps) {
  const [actionsOpen, setActionsOpen] = useState(false);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7f5ef_0%,#f9fafb_30%,#f8fafc_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/80 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.95),_rgba(255,247,237,0.82)_45%,_rgba(240,249,255,0.9)_100%)] p-6 shadow-[0_22px_70px_rgba(15,23,42,0.08)] sm:p-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-zinc-400">{data.dateLabel}</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
                Your nutrition dashboard answers the day at a glance.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-zinc-600 sm:text-lg">
                See your calories, macro progress, logged meals, and the nutrients still worth targeting before tonight.
              </p>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-xl lg:flex-1">
              {data.dailySummary.map((metric) => {
                const progress = getPercent(metric.consumed, metric.target);

                return (
                  <article key={metric.label} className="rounded-[1.75rem] border border-white/80 bg-white/80 p-4 backdrop-blur-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-zinc-500">{metric.label}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${metric.tone}`}>
                        {progress}%
                      </span>
                    </div>
                    <p className="mt-4 text-2xl font-semibold text-zinc-950">
                      {metric.consumed}
                      <span className="ml-1 text-base font-medium text-zinc-500">/ {metric.target}{metric.unit}</span>
                    </p>
                    <p className="mt-3 text-sm text-zinc-500">
                      Remaining {formatValue(getRemaining(metric.consumed, metric.target), metric.unit)}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <div className="grid gap-6 lg:grid-cols-3">
            {data.macroRings.map((metric) => (
              <CircleMetric key={metric.label} metric={metric} />
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
            {data.supportMetrics.map((metric) => (
              <LinearMetric key={metric.label} metric={metric} />
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/80 bg-white/95 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-zinc-400">Recommendation</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
                {data.recommendation.title}
              </h2>
              <p className="mt-4 text-base leading-7 text-zinc-600">{data.recommendation.summary}</p>
              <p className="mt-3 text-base leading-7 text-zinc-600">{data.recommendation.alignment}</p>
            </div>

            <button
              type="button"
              className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-zinc-950 px-6 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              {data.recommendation.ctaLabel}
            </button>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
            <div className="rounded-[1.75rem] bg-zinc-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Suggested next meal</p>
              <p className="mt-3 text-lg font-semibold text-zinc-950">{data.recommendation.nextMeal}</p>
            </div>

            <div className="grid gap-3">
              {data.recommendation.reasons.map((reason) => (
                <div key={reason} className="rounded-[1.5rem] border border-zinc-100 bg-white p-4">
                  <p className="text-sm leading-6 text-zinc-600">{reason}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/80 bg-white/95 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-zinc-400">Micronutrients</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">Spot nutrient gaps before the day ends.</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-zinc-500">
              Compact progress rows make it clear where you are low, on track, or already above target.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {data.micronutrients.map((nutrient) => {
              const progress = getPercent(nutrient.consumed, nutrient.target);
              const clampedProgress = getClampedPercent(nutrient.consumed, nutrient.target);

              return (
                <article key={nutrient.label} className="rounded-[1.75rem] bg-zinc-50 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-zinc-950">{nutrient.label}</h3>
                      <p className="mt-1 text-sm text-zinc-500">
                        {nutrient.consumed}{nutrient.unit} consumed of {nutrient.target}{nutrient.unit}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusToneMap[nutrient.status]}`}>
                      {nutrient.status}
                    </span>
                  </div>

                  <div className="mt-4 h-3 rounded-full bg-white">
                    <div
                      className={`h-3 rounded-full ${nutrient.tone}`}
                      style={{ width: `${clampedProgress}%` }}
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between text-sm text-zinc-500">
                    <span>Remaining {formatValue(getRemaining(nutrient.consumed, nutrient.target), nutrient.unit)}</span>
                    <span>{progress}% complete</span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/80 bg-white/95 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-zinc-400">Today&apos;s meals</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">A visual feed of everything you logged today.</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-zinc-500">
              Tap any meal card to reveal the micronutrient details behind the calorie estimate.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-5">
            {data.meals.map((meal) => (
              <MealCard key={meal.id} meal={meal} />
            ))}
          </div>
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
