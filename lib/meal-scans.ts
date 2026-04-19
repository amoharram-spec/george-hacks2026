import type { DashboardData, Meal, MealFoodItem, Micronutrient, NutrientAmount } from "@/app/dashboard/types";

const DEFAULT_MEAL_PALETTES = [
  "from-orange-200 via-rose-100 to-amber-50",
  "from-sky-100 via-violet-50 to-white",
  "from-emerald-100 via-lime-50 to-white",
  "from-yellow-100 via-stone-100 to-white",
  "from-fuchsia-100 via-rose-50 to-white",
];

const MICRONUTRIENT_TARGETS = [
  { key: "vitamin-a", label: "Vitamin A", unit: "mcg", target: 900, names: ["Vitamin A, RAE"] },
  { key: "vitamin-c", label: "Vitamin C", unit: "mg", target: 90, names: ["Vitamin C, total ascorbic acid"] },
  { key: "vitamin-d", label: "Vitamin D", unit: "mcg", target: 20, names: ["Vitamin D (D2 + D3)", "Vitamin D"] },
  { key: "vitamin-e", label: "Vitamin E", unit: "mg", target: 15, names: ["Vitamin E (alpha-tocopherol)"] },
  { key: "vitamin-k", label: "Vitamin K", unit: "mcg", target: 120, names: ["Vitamin K (phylloquinone)"] },
  { key: "thiamine-b1", label: "Thiamine (B1)", unit: "mg", target: 1.2, names: ["Thiamin"] },
  { key: "riboflavin-b2", label: "Riboflavin (B2)", unit: "mg", target: 1.3, names: ["Riboflavin"] },
  { key: "niacin-b3", label: "Niacin (B3)", unit: "mg", target: 16, names: ["Niacin"] },
  { key: "pantothenic-acid-b5", label: "Pantothenic Acid (B5)", unit: "mg", target: 5, names: ["Pantothenic acid"] },
  { key: "vitamin-b6", label: "Vitamin B6", unit: "mg", target: 1.7, names: ["Vitamin B-6"] },
  { key: "folate", label: "Folate", unit: "mcg", target: 400, names: ["Folate, total"] },
  { key: "vitamin-b12", label: "Vitamin B12", unit: "mcg", target: 2.4, names: ["Vitamin B-12"] },
  { key: "choline", label: "Choline", unit: "mg", target: 550, names: ["Choline, total"] },
  { key: "calcium", label: "Calcium", unit: "mg", target: 1000, names: ["Calcium, Ca"] },
  { key: "iron", label: "Iron", unit: "mg", target: 18, names: ["Iron, Fe"] },
  { key: "magnesium", label: "Magnesium", unit: "mg", target: 400, names: ["Magnesium, Mg"] },
  { key: "phosphorus", label: "Phosphorus", unit: "mg", target: 1250, names: ["Phosphorus, P"] },
  { key: "potassium", label: "Potassium", unit: "mg", target: 3400, names: ["Potassium, K"] },
  { key: "sodium", label: "Sodium", unit: "mg", target: 2300, names: ["Sodium, Na"] },
  { key: "zinc", label: "Zinc", unit: "mg", target: 11, names: ["Zinc, Zn"] },
  { key: "selenium", label: "Selenium", unit: "mcg", target: 55, names: ["Selenium, Se"] },
  { key: "copper", label: "Copper", unit: "mg", target: 0.9, names: ["Copper, Cu"] },
  { key: "manganese", label: "Manganese", unit: "mg", target: 2.3, names: ["Manganese, Mn"] },
] as const;

const MACRO_NUTRIENT_NAMES = {
  calories: ["Energy"],
  protein: ["Protein"],
  carbs: ["Carbohydrate, by difference"],
  fat: ["Total lipid (fat)"],
  fiber: ["Fiber, total dietary"],
  sugar: ["Sugars, total including NLEA", "Sugars, total"],
  sodium: ["Sodium, Na"],
} as const;

type GeminiDetectedFood = {
  name: string;
  confidence?: number;
  servingSizeEstimate?: string;
  gramsEstimate?: number;
  preparation?: string;
  searchHint?: string;
  assumptions?: string[];
};

type GeminiMealScan = {
  mealLabel?: string;
  overallConfidence?: number;
  foods?: GeminiDetectedFood[];
  warnings?: string[];
};

type NormalizedGeminiFood = {
  name: string;
  confidence: number | null;
  servingSizeEstimate: string;
  gramsEstimate: number | null;
  preparation: string;
  searchHint: string;
  assumptions: string[];
};

type FdcSearchFood = {
  fdcId: number;
  description?: string;
  dataType?: string;
};

type FdcFoodNutrient = {
  amount?: number;
  unitName?: string;
  nutrient?: {
    name?: string;
    unitName?: string;
  };
};

type FdcFoodDetails = {
  fdcId: number;
  description?: string;
  dataType?: string;
  foodNutrients?: FdcFoodNutrient[];
};

class UsdaRequestError extends Error {
  status: number;
  context: string;

  constructor(message: string, status: number, context: string) {
    super(message);
    this.name = "UsdaRequestError";
    this.status = status;
    this.context = context;
  }
}

export class UsdaGroundingError extends Error {
  foodName: string;

  constructor(foodName: string, message: string) {
    super(message);
    this.name = "UsdaGroundingError";
    this.foodName = foodName;
  }
}

export type GroundedMealFood = MealFoodItem & {
  assumptions: string[];
  sourceFoodId: number;
};

export type MealScanDocument = {
  _id?: { toString(): string };
  mealLabel: string;
  imageUrl: string | null;
  createdAt: Date;
  analysisConfidence: number | null;
  warnings: string[];
  foods: GroundedMealFood[];
};

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "meal-scan";
}

export function parseJsonText<T>(rawText: string) {
  const trimmed = rawText.trim();
  const withoutFence = trimmed.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();

  return JSON.parse(withoutFence) as T;
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

export function normalizeGeminiMealScan(input: unknown) {
  if (!input || typeof input !== "object") {
    return {
      mealLabel: "Scanned meal",
      overallConfidence: null,
      foods: [] as NormalizedGeminiFood[],
      warnings: ["Gemini did not return a valid meal analysis payload."],
    };
  }

  const candidate = input as GeminiMealScan;
  const foods = Array.isArray(candidate.foods)
    ? candidate.foods
        .map((food) => {
          if (!food || typeof food !== "object") {
            return null;
          }

          const name = typeof food.name === "string" ? food.name.trim() : "";
          if (!name) {
            return null;
          }

          const normalizedFood: NormalizedGeminiFood = {
            name,
            confidence: normalizeNumber(food.confidence),
            servingSizeEstimate:
              typeof food.servingSizeEstimate === "string" && food.servingSizeEstimate.trim()
                ? food.servingSizeEstimate.trim()
                : "estimated serving",
            gramsEstimate: normalizeNumber(food.gramsEstimate),
            preparation: typeof food.preparation === "string" ? food.preparation.trim() : "",
            searchHint: typeof food.searchHint === "string" ? food.searchHint.trim() : "",
            assumptions: Array.isArray(food.assumptions)
              ? food.assumptions.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
              : [],
          };

          return normalizedFood;
        })
        .filter((food): food is NormalizedGeminiFood => food !== null)
    : [];

  return {
    mealLabel:
      typeof candidate.mealLabel === "string" && candidate.mealLabel.trim() ? candidate.mealLabel.trim() : "Scanned meal",
    overallConfidence: normalizeNumber(candidate.overallConfidence),
    foods,
    warnings: Array.isArray(candidate.warnings)
      ? candidate.warnings.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [],
  };
}

function convertUnit(value: number, fromUnit: string | undefined, toUnit: string) {
  const normalizedFrom = fromUnit?.toLowerCase() ?? "";
  const normalizedTo = toUnit.toLowerCase();

  if (normalizedFrom === normalizedTo || !normalizedFrom) {
    return value;
  }

  if (normalizedFrom === "g" && normalizedTo === "mg") {
    return value * 1000;
  }

  if (normalizedFrom === "mg" && normalizedTo === "g") {
    return value / 1000;
  }

  if ((normalizedFrom === "ug" || normalizedFrom === "mcg") && normalizedTo === "mg") {
    return value / 1000;
  }

  if (normalizedFrom === "mg" && (normalizedTo === "ug" || normalizedTo === "mcg")) {
    return value * 1000;
  }

  if ((normalizedFrom === "ug" || normalizedFrom === "mcg") && (normalizedTo === "ug" || normalizedTo === "mcg")) {
    return value;
  }

  return value;
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function extractNutrientAmount(food: FdcFoodDetails, nutrientNames: readonly string[], outputUnit: string) {
  const nutrient = food.foodNutrients?.find((item) => {
    const nutrientName = item.nutrient?.name?.toLowerCase();
    return nutrientName ? nutrientNames.some((name) => nutrientName === name.toLowerCase()) : false;
  });

  if (!nutrient || typeof nutrient.amount !== "number") {
    return 0;
  }

  return convertUnit(nutrient.amount, nutrient.nutrient?.unitName ?? nutrient.unitName, outputUnit);
}

function getScaleFactor(gramsEstimate: number | null) {
  if (!gramsEstimate || gramsEstimate <= 0) {
    return 1;
  }

  return gramsEstimate / 100;
}

function pickTopMicronutrients(micronutrients: NutrientAmount[]) {
  return micronutrients
    .slice()
    .sort((left, right) => right.amount - left.amount)
    .filter((nutrient) => nutrient.amount > 0)
    .slice(0, 4)
    .map((nutrient) => ({
      label: nutrient.label,
      amount: `${round(nutrient.amount)}${nutrient.unit}`,
    }));
}

function getMealServingLabel(foods: GroundedMealFood[]) {
  const labels = foods
    .map((food) => food.servingSizeEstimate)
    .filter((value, index, values) => value && values.indexOf(value) === index)
    .slice(0, 2);

  return labels.join(" + ") || "estimated serving";
}

function getMealNote(foods: GroundedMealFood[], warnings: string[]) {
  if (warnings.length > 0) {
    return warnings[0];
  }

  const topProtein = foods.reduce((best, food) => (food.protein > best.protein ? food : best), foods[0]);
  const topFiber = foods.reduce((best, food) => (food.fiber > best.fiber ? food : best), foods[0]);

  if (topProtein && topProtein.protein >= 20) {
    return `${topProtein.name} drives most of the protein in this meal.`;
  }

  if (topFiber && topFiber.fiber >= 5) {
    return `${topFiber.name} contributes the strongest fiber coverage here.`;
  }

  return "Nutrition was grounded against USDA FoodData Central using estimated serving sizes.";
}

function getStatus(consumed: number, target: number): Micronutrient["status"] {
  const ratio = target === 0 ? 0 : consumed / target;

  if (ratio >= 1.1) {
    return "exceeded";
  }

  if (ratio >= 0.75) {
    return "on track";
  }

  return "low";
}

function getTone(status: Micronutrient["status"]) {
  if (status === "exceeded") {
    return "bg-amber-300";
  }

  if (status === "on track") {
    return "bg-emerald-300";
  }

  return "bg-rose-300";
}

function getDateLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

function getTimeLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function buildMealFromScan(scan: MealScanDocument, index: number): Meal {
  const totals = scan.foods.reduce(
    (accumulator, food) => {
      accumulator.calories += food.calories;
      accumulator.protein += food.protein;
      accumulator.carbs += food.carbs;
      accumulator.fat += food.fat;
      accumulator.fiber += food.fiber;
      accumulator.sugar += food.sugar;
      accumulator.sodium += food.sodium;

      food.micronutrients.forEach((nutrient) => {
        const existing = accumulator.micronutrients.get(nutrient.key);
        if (existing) {
          existing.amount += nutrient.amount;
          return;
        }

        accumulator.micronutrients.set(nutrient.key, { ...nutrient });
      });

      return accumulator;
    },
    {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodium: 0,
      micronutrients: new Map<string, NutrientAmount>(),
    },
  );

  const micronutrients = Array.from(totals.micronutrients.values()).sort((left, right) => right.amount - left.amount);

  return {
    id: scan._id?.toString() ?? `${slugify(scan.mealLabel)}-${index}`,
    name: scan.mealLabel,
    time: getTimeLabel(scan.createdAt),
    imageUrl: scan.imageUrl,
    confidence: scan.analysisConfidence,
    servingSizeEstimate: getMealServingLabel(scan.foods),
    calories: round(totals.calories, 0),
    protein: round(totals.protein),
    carbs: round(totals.carbs),
    fat: round(totals.fat),
    fiber: round(totals.fiber),
    sugar: round(totals.sugar),
    sodium: round(totals.sodium, 0),
    note: getMealNote(scan.foods, scan.warnings),
    palette: DEFAULT_MEAL_PALETTES[index % DEFAULT_MEAL_PALETTES.length],
    micros: pickTopMicronutrients(micronutrients),
    foods: scan.foods,
    warnings: scan.warnings,
  };
}

export function buildDashboardDataFromMealScans(scans: MealScanDocument[]): DashboardData {
  const meals = scans
    .slice()
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .map((scan, index) => buildMealFromScan(scan, index));

  const macroTotals = meals.reduce(
    (accumulator, meal) => {
      accumulator.calories += meal.calories;
      accumulator.protein += meal.protein;
      accumulator.carbs += meal.carbs;
      accumulator.fat += meal.fat;
      accumulator.fiber += meal.fiber;
      accumulator.sugar += meal.sugar;
      accumulator.sodium += meal.sodium;

      meal.foods.forEach((food) => {
        food.micronutrients.forEach((nutrient) => {
          accumulator.micronutrients.set(nutrient.key, (accumulator.micronutrients.get(nutrient.key) ?? 0) + nutrient.amount);
        });
      });

      return accumulator;
    },
    {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodium: 0,
      micronutrients: new Map<string, number>(),
    },
  );

  const dailySummary = [
    { label: "Calories", consumed: round(macroTotals.calories, 0), target: 2100, unit: "kcal", tone: "bg-rose-100 text-rose-700" },
    { label: "Protein", consumed: round(macroTotals.protein), target: 150, unit: "g", tone: "bg-emerald-100 text-emerald-700" },
    { label: "Carbs", consumed: round(macroTotals.carbs), target: 210, unit: "g", tone: "bg-amber-100 text-amber-700" },
    { label: "Fat", consumed: round(macroTotals.fat), target: 70, unit: "g", tone: "bg-sky-100 text-sky-700" },
  ];

  const macroRings = [
    { label: "Protein", consumed: round(macroTotals.protein), target: 150, unit: "g", tone: "#38b26d" },
    { label: "Carbs", consumed: round(macroTotals.carbs), target: 210, unit: "g", tone: "#f3a646" },
    { label: "Fat", consumed: round(macroTotals.fat), target: 70, unit: "g", tone: "#58a8f2" },
  ];

  const supportMetrics = [
    { label: "Calories", consumed: round(macroTotals.calories, 0), target: 2100, unit: "kcal", tone: "bg-rose-400" },
    { label: "Fiber", consumed: round(macroTotals.fiber), target: 30, unit: "g", tone: "bg-lime-400" },
    { label: "Water", consumed: 0, target: 2.7, unit: "L", tone: "bg-cyan-400" },
  ];

  const micronutrients: Micronutrient[] = MICRONUTRIENT_TARGETS.map((definition) => {
    const consumed = round(macroTotals.micronutrients.get(definition.key) ?? 0);
    const status = getStatus(consumed, definition.target);

    return {
      key: definition.key,
      label: definition.label,
      consumed,
      target: definition.target,
      unit: definition.unit,
      status,
      tone: getTone(status),
    };
  });

  const lowestMicros = micronutrients.slice().sort((left, right) => left.consumed / left.target - right.consumed / right.target).slice(0, 3);
  const topProteinMeal = meals.slice().sort((left, right) => right.protein - left.protein)[0];

  return {
    dateLabel: getDateLabel(scans[0]?.createdAt ?? new Date()),
    dailySummary,
    macroRings,
    supportMetrics,
    micronutrients,
    meals,
    recommendation: {
      title: lowestMicros.length > 0 ? `Prioritize ${lowestMicros.map((item) => item.label.toLowerCase()).join(", ")} next` : "Keep meals balanced across macros and micros",
      summary:
        lowestMicros.length > 0
          ? `The current meal log is still light on ${lowestMicros.map((item) => item.label).join(", ")}.`
          : "The current meal log is balanced across the major tracked nutrients.",
      alignment: topProteinMeal
        ? `${topProteinMeal.name} is currently the strongest protein contributor in the dashboard.`
        : "Scan meals through the + menu to start building a grounded daily nutrition profile.",
      nextMeal: lowestMicros.length > 0
        ? `Add foods that close the gap in ${lowestMicros[0].label.toLowerCase()} without overshooting sodium.`
        : "Keep using whole-food meals with clear portions so estimates stay grounded.",
      reasons: [
        meals.length > 0
          ? `${meals.length} scanned meal${meals.length === 1 ? " has" : "s have"} been grounded against USDA FoodData Central.`
          : "No meals scanned yet, so today’s dashboard is waiting for image-based entries.",
        `${round(macroTotals.protein)}g protein and ${round(macroTotals.fiber)}g fiber have been logged so far.`,
        `Sodium currently sits at ${round(macroTotals.sodium, 0)}mg against a 2300mg target.`,
      ],
      ctaLabel: "View Plan",
    },
  };
}

function getSearchQuery(food: NormalizedGeminiFood) {
  const parts = [food.preparation, food.searchHint, food.name].filter(Boolean);
  return parts.join(" ").trim() || food.name;
}

function getDataTypeRank(dataType?: string) {
  const value = dataType?.toLowerCase() ?? "";

  if (value.includes("foundation")) {
    return 0;
  }

  if (value.includes("survey")) {
    return 1;
  }

  if (value.includes("sr legacy")) {
    return 2;
  }

  if (value.includes("branded")) {
    return 4;
  }

  return 3;
}

function getErrorBodySummary(text: string) {
  const trimmed = text.replace(/\s+/g, " ").trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("<")) {
    return null;
  }

  return trimmed.slice(0, 240);
}

async function fetchJson<T>(url: string, init: RequestInit | undefined, context: string) {
  const response = await fetch(url, init);

  if (!response.ok) {
    const message = getErrorBodySummary(await response.text());
    throw new UsdaRequestError(
      message ?? `USDA request failed with ${response.status} during ${context}.`,
      response.status,
      context,
    );
  }

  return (await response.json()) as T;
}

async function searchUsdaFood(apiKey: string, query: string) {
  const payload = await fetchJson<{ foods?: FdcSearchFood[] }>(
    `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, pageSize: 5 }),
      cache: "no-store",
    },
    `USDA food search for "${query}"`,
  );

  const candidates = payload.foods ?? [];
  return candidates.sort((left, right) => getDataTypeRank(left.dataType) - getDataTypeRank(right.dataType));
}

async function fetchUsdaFoodDetails(apiKey: string, fdcId: number) {
  return fetchJson<FdcFoodDetails>(`https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${apiKey}`, {
    cache: "no-store",
  }, `USDA food details for fdcId ${fdcId}`);
}

function buildGroundedMicronutrients(food: FdcFoodDetails, scaleFactor: number) {
  return MICRONUTRIENT_TARGETS.map((definition) => ({
    key: definition.key,
    label: definition.label,
    amount: round(extractNutrientAmount(food, definition.names, definition.unit) * scaleFactor),
    unit: definition.unit,
  })).filter((nutrient) => nutrient.amount > 0);
}

export async function groundFoodWithUsda(apiKey: string, food: NormalizedGeminiFood): Promise<GroundedMealFood> {
  const searchQuery = getSearchQuery(food);
  const matches = await searchUsdaFood(apiKey, searchQuery);

  if (matches.length === 0) {
    throw new UsdaGroundingError(food.name, `No USDA match found for ${food.name} using query "${searchQuery}".`);
  }

  const candidateFailures: string[] = [];

  for (const match of matches.slice(0, 5)) {
    try {
      const details = await fetchUsdaFoodDetails(apiKey, match.fdcId);
      const scaleFactor = getScaleFactor(food.gramsEstimate ?? null);
      const micronutrients = buildGroundedMicronutrients(details, scaleFactor);

      return {
        name: food.name,
        confidence: food.confidence ?? null,
        servingSizeEstimate: food.servingSizeEstimate ?? "estimated serving",
        gramsEstimate: food.gramsEstimate ?? null,
        calories: round(extractNutrientAmount(details, MACRO_NUTRIENT_NAMES.calories, "kcal") * scaleFactor, 0),
        protein: round(extractNutrientAmount(details, MACRO_NUTRIENT_NAMES.protein, "g") * scaleFactor),
        carbs: round(extractNutrientAmount(details, MACRO_NUTRIENT_NAMES.carbs, "g") * scaleFactor),
        fat: round(extractNutrientAmount(details, MACRO_NUTRIENT_NAMES.fat, "g") * scaleFactor),
        fiber: round(extractNutrientAmount(details, MACRO_NUTRIENT_NAMES.fiber, "g") * scaleFactor),
        sugar: round(extractNutrientAmount(details, MACRO_NUTRIENT_NAMES.sugar, "g") * scaleFactor),
        sodium: round(extractNutrientAmount(details, MACRO_NUTRIENT_NAMES.sodium, "mg") * scaleFactor, 0),
        micronutrients,
        dataSource: `USDA FoodData Central (${details.dataType ?? match.dataType ?? "unknown"})`,
        assumptions: food.assumptions ?? [],
        sourceFoodId: match.fdcId,
      };
    } catch (error) {
      if (error instanceof UsdaRequestError) {
        candidateFailures.push(`${match.fdcId}: ${error.message}`);
        if (error.status === 404) {
          continue;
        }
      }

      if (error instanceof Error) {
        candidateFailures.push(`${match.fdcId}: ${error.message}`);
      }
    }
  }

  throw new UsdaGroundingError(
    food.name,
    `Unable to ground ${food.name} against USDA data. Query: "${searchQuery}". Tried ${Math.min(matches.length, 5)} candidate${matches.length === 1 ? "" : "s"}.${candidateFailures.length > 0 ? ` Last errors: ${candidateFailures.join(" | ")}` : ""}`,
  );
}
