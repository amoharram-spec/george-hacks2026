"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  ACTIVITY_LEVELS,
  NUTRITION_GOALS,
  calculateTdee,
  ftInToCm,
  lbsToKg,
  type ActivityLevel,
  type NutritionGoal,
  type Sex,
  type TdeeResult,
} from "@/lib/tdee";

type UnitSystem = "metric" | "imperial";

/**
 * Safely parses a string into a positive float. Returns null if invalid or <= 0.
 * Useful for validating raw form inputs before doing math.
 */
function parsePositive(value: string): number | null {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Props for the TdeeCalculator component.
 */
export type TdeeCalculatorProps = {
  /** `page` = full /tdee layout with title and dashboard link; `embedded` = flows inside another screen (e.g. onboarding). */
  variant?: "page" | "embedded";
  /** When inputs yield a valid height/weight, parent can use these for APIs (e.g. lab upload). */
  onMetricsChange?: (metrics: { weightKg: number; heightCm: number } | null) => void;
  /** When inputs yield a valid result, parent can persist the calorie target. */
  onResultChange?: (result: TdeeResult | null) => void;
};

export function TdeeCalculator({ variant = "page", onMetricsChange, onResultChange }: TdeeCalculatorProps) {
  const embedded = variant === "embedded";
  const activityRadioName = embedded ? "onboarding-tdee-activity" : "tdee-activity";
  const goalRadioName = embedded ? "onboarding-tdee-goal" : "tdee-goal";
  const inputPanelClass = embedded
    ? "space-y-6 rounded-2xl border border-zinc-200 bg-zinc-50/50 p-5 sm:p-6"
    : "space-y-6 rounded-[1.9rem] border border-white/80 bg-white/95 p-6 shadow-[0_14px_40px_rgba(15,23,42,0.08)]";
  const resultPanelClass = embedded
    ? "rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6"
    : "rounded-[1.9rem] border border-white/80 bg-white/95 p-6 shadow-[0_14px_40px_rgba(15,23,42,0.08)]";
  const titleTextClass = embedded ? "text-black" : "text-zinc-950";
  const bodyTextClass = embedded ? "text-black/85" : "text-zinc-700";
  const helperTextClass = embedded ? "text-black/70" : "text-zinc-500";
  const subtleTextClass = embedded ? "text-black/55" : "text-zinc-400";
  const [units, setUnits] = useState<UnitSystem>("metric");
  const [weight, setWeight] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<Sex>("male");
  const [activity, setActivity] = useState<ActivityLevel>("moderate");
  const [goal, setGoal] = useState<NutritionGoal>("lose_weight");

  /**
   * Complex derived state: We compute numerical inputs on the fly.
   * By keeping the real state as raw strings (e.g., `weight`, `height`), we avoid forcing 
   * formatting on users as they type. This side-effect-free memo handles metric vs imperial conversions.
   */
  const parsedInputs = useMemo(() => {
    const ageYears = parsePositive(age);
    if (ageYears === null || ageYears < 13 || ageYears > 100) return null;

    let weightKg: number | null = null;
    let heightCmVal: number | null = null;

    if (units === "metric") {
      weightKg = parsePositive(weight);
      heightCmVal = parsePositive(heightCm);
      if (heightCmVal !== null && (heightCmVal < 100 || heightCmVal > 250)) heightCmVal = null;
    } else {
      const lbs = parsePositive(weight);
      const ft = Number.parseInt(heightFt, 10);
      const inch = Number.parseFloat(heightIn);
      if (lbs === null || !Number.isFinite(inch)) return null;
      if (!Number.isFinite(ft) || ft < 3 || ft > 8) return null;
      if (inch < 0 || inch >= 12) return null;
      weightKg = lbsToKg(lbs);
      heightCmVal = ftInToCm(ft, inch);
    }

    if (weightKg === null || heightCmVal === null) return null;
    if (weightKg < 30 || weightKg > 300) return null;

    return { weightKg, heightCmVal, ageYears };
  }, [age, heightCm, heightFt, heightIn, units, weight]);

  /**
   * Executes the actual TDEE calculation only when valid form inputs exist.
   * Changes in user goal or activity immediately reflect in real-time UI without pressing "Submit".
   */
  const result = useMemo(() => {
    if (!parsedInputs) return null;
    return calculateTdee({
      weightKg: parsedInputs.weightKg,
      heightCm: parsedInputs.heightCmVal,
      ageYears: parsedInputs.ageYears,
      sex,
      activity,
      goal,
    });
  }, [activity, goal, parsedInputs, sex]);

  const proteinRange =
    result && parsedInputs
      ? {
          minG: Math.round(parsedInputs.weightKg * result.proteinGPerKgMin),
          maxG: Math.round(parsedInputs.weightKg * result.proteinGPerKgMax),
        }
      : null;

  useEffect(() => {
    if (!onMetricsChange) return;
    onMetricsChange(
      parsedInputs ? { weightKg: parsedInputs.weightKg, heightCm: parsedInputs.heightCmVal } : null,
    );
  }, [onMetricsChange, parsedInputs]);

  useEffect(() => {
    if (!onResultChange) return;
    onResultChange(result);
  }, [onResultChange, result]);

  return (
    <div className={embedded ? "w-full" : "mx-auto w-full max-w-lg"}>
      {!embedded && (
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${subtleTextClass}`}>Nutrition</p>
            <h1 className={`mt-1 text-2xl font-semibold tracking-tight ${titleTextClass}`}>TDEE calculator</h1>
          </div>
          <Link
            href="/dashboard"
            className="shrink-0 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-black shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
          >
            Dashboard
          </Link>
        </div>
      )}

      {embedded && (
        <div className="mb-4">
          <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${subtleTextClass}`}>Daily energy</p>
          <h2 className={`mt-1 text-lg font-semibold tracking-tight ${titleTextClass}`}>TDEE &amp; calorie target</h2>
          <p className={`mt-1 text-sm ${bodyTextClass}`}>
            We use your body stats and goal to estimate maintenance calories and a sensible daily target.
          </p>
        </div>
      )}

      <div className={inputPanelClass}>
        <div className="flex rounded-2xl border border-zinc-200 p-1">
          {(
            [
              { id: "metric" as const, label: "Metric" },
              { id: "imperial" as const, label: "Imperial" },
            ] as const
          ).map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => setUnits(u.id)}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
                units === u.id ? "bg-zinc-950 text-white shadow-sm" : "text-black/70 hover:bg-zinc-50"
              }`}
            >
              {u.label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className={`text-sm font-medium ${bodyTextClass}`}>Weight ({units === "metric" ? "kg" : "lb"})</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-950 outline-none ring-zinc-950/10 focus:ring-2"
              placeholder={units === "metric" ? "e.g. 72" : "e.g. 165"}
            />
          </label>

          {units === "metric" ? (
            <label className="block sm:col-span-2">
              <span className={`text-sm font-medium ${bodyTextClass}`}>Height (cm)</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-950 outline-none ring-zinc-950/10 focus:ring-2"
                placeholder="e.g. 178"
              />
            </label>
          ) : (
            <div className="sm:col-span-2">
              <span className={`text-sm font-medium ${bodyTextClass}`}>Height</span>
              <div className="mt-1.5 flex gap-3">
                <label className="flex flex-1 flex-col">
                  <span className={`text-xs ${helperTextClass}`}>ft</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={3}
                    max={8}
                    value={heightFt}
                    onChange={(e) => setHeightFt(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-950 outline-none ring-zinc-950/10 focus:ring-2"
                    placeholder="5"
                  />
                </label>
                <label className="flex flex-1 flex-col">
                  <span className={`text-xs ${helperTextClass}`}>in</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={11.99}
                    step="0.5"
                    value={heightIn}
                    onChange={(e) => setHeightIn(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-950 outline-none ring-zinc-950/10 focus:ring-2"
                    placeholder="10"
                  />
                </label>
              </div>
            </div>
          )}

          <label className="block">
            <span className={`text-sm font-medium ${bodyTextClass}`}>Age (years)</span>
            <input
              type="number"
              inputMode="numeric"
              min={13}
              max={100}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-950 outline-none ring-zinc-950/10 focus:ring-2"
              placeholder="e.g. 28"
            />
          </label>

          <fieldset className="block">
            <legend className={`text-sm font-medium ${bodyTextClass}`}>Sex (for BMR equation)</legend>
            <div className="mt-1.5 flex gap-2">
              {(["male", "female"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSex(s)}
                  className={`flex-1 rounded-xl border py-3 text-sm font-semibold capitalize transition ${
                    sex === s
                      ? "border-zinc-950 bg-zinc-950 text-white"
                      : "border-zinc-200 bg-white text-black/75 hover:bg-zinc-50"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div>
            <span className={`text-sm font-medium ${bodyTextClass}`}>Activity level</span>
          <div className="mt-2 space-y-2">
            {ACTIVITY_LEVELS.map((lvl) => (
              <label
                key={lvl.id}
                className={`flex cursor-pointer flex-col rounded-2xl border px-4 py-3 transition ${
                  activity === lvl.id ? "border-zinc-950 bg-zinc-50 ring-1 ring-zinc-950/10" : "border-zinc-200 hover:bg-zinc-50/80"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name={activityRadioName}
                    checked={activity === lvl.id}
                    onChange={() => setActivity(lvl.id)}
                    className="h-4 w-4 accent-zinc-950"
                  />
                  <span className="font-semibold text-zinc-900">{lvl.label}</span>
                </div>
                <span className={`mt-1 pl-7 text-xs ${helperTextClass}`}>{lvl.description}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
            <span className={`text-sm font-medium ${bodyTextClass}`}>Goal</span>
          <div className="mt-2 space-y-2">
            {NUTRITION_GOALS.map((g) => (
              <label
                key={g.id}
                className={`flex cursor-pointer flex-col rounded-2xl border px-4 py-3 transition ${
                  goal === g.id ? "border-zinc-950 bg-zinc-50 ring-1 ring-zinc-950/10" : "border-zinc-200 hover:bg-zinc-50/80"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name={goalRadioName}
                    checked={goal === g.id}
                    onChange={() => setGoal(g.id)}
                    className="h-4 w-4 accent-zinc-950"
                  />
                  <span className="font-semibold text-zinc-900">{g.label}</span>
                </div>
                <span className={`mt-1 pl-7 text-xs ${bodyTextClass}`}>{g.description}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <section className={`${resultPanelClass} ${embedded ? "mt-4" : "mt-6"}`}>
        <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${subtleTextClass}`}>Estimate</p>
        {!result ? (
          <p className={`mt-3 text-sm leading-6 ${helperTextClass}`}>
            Enter valid weight, height, and age (13–100) to see BMR, TDEE, and a calorie target aligned with your goal.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-zinc-50 p-4">
                <p className={`text-[11px] font-semibold uppercase tracking-wider ${subtleTextClass}`}>BMR</p>
                <p className={`mt-1 text-2xl font-semibold ${titleTextClass}`}>{result.bmr}</p>
                <p className={`text-xs ${helperTextClass}`}>kcal/day at rest</p>
              </div>
              <div className="rounded-2xl bg-zinc-50 p-4">
                <p className={`text-[11px] font-semibold uppercase tracking-wider ${subtleTextClass}`}>TDEE</p>
                <p className={`mt-1 text-2xl font-semibold ${titleTextClass}`}>{result.tdee}</p>
                <p className={`text-xs ${helperTextClass}`}>kcal/day maintenance</p>
              </div>
            </div>
            <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
              <p className={`text-[11px] font-semibold uppercase tracking-wider ${embedded ? "text-black/70" : "text-rose-700/80"}`}>Suggested intake</p>
              <p className={`mt-1 text-3xl font-semibold ${titleTextClass}`}>{result.targetCalories}</p>
              <p className={`mt-1 text-sm ${bodyTextClass}`}>
                Typical range: <span className="font-semibold text-black">{result.rangeMin}</span>–
                <span className="font-semibold text-black">{result.rangeMax}</span> kcal/day
              </p>
            </div>
            {proteinRange && (
              <p className={`text-sm leading-6 ${bodyTextClass}`}>
                <span className="font-semibold text-black">Protein ballpark:</span> about {proteinRange.minG}–{proteinRange.maxG}
                g/day (from your entered weight).
              </p>
            )}
            <p className={`text-sm leading-6 ${bodyTextClass}`}>{result.goalNotes}</p>
            <p className={`text-xs leading-5 ${subtleTextClass}`}>
              Estimates use the Mifflin–St Jeor equation and standard activity factors. They are not medical advice; use
              professional guidance for conditions, medications, and lab targets.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
