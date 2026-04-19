export type Sex = "male" | "female";

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";

export type NutritionGoal = "lose_weight" | "build_muscle" | "improve_bloodwork";

export const ACTIVITY_LEVELS: { id: ActivityLevel; label: string; description: string; multiplier: number }[] = [
  { id: "sedentary", label: "Sedentary", description: "Desk job, little exercise", multiplier: 1.2 },
  { id: "light", label: "Light", description: "Light exercise 1–3 days/week", multiplier: 1.375 },
  { id: "moderate", label: "Moderate", description: "Moderate exercise 3–5 days/week", multiplier: 1.55 },
  { id: "active", label: "Active", description: "Hard exercise 6–7 days/week", multiplier: 1.725 },
  { id: "very_active", label: "Very active", description: "Athlete / physical job + training", multiplier: 1.9 },
];

export const NUTRITION_GOALS: {
  id: NutritionGoal;
  label: string;
  description: string;
}[] = [
  {
    id: "lose_weight",
    label: "Lose weight",
    description: "Moderate calorie deficit while keeping protein adequate.",
  },
  {
    id: "build_muscle",
    label: "Build muscle",
    description: "Small surplus with room for strength training recovery.",
  },
  {
    id: "improve_bloodwork",
    label: "Improve bloodwork / vitals",
    description: "Maintenance or gentle deficit; pair with whole foods and your clinician’s plan.",
  },
];

export type TdeeInput = {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  sex: Sex;
  activity: ActivityLevel;
  goal: NutritionGoal;
};

export type TdeeResult = {
  bmr: number;
  tdee: number;
  targetCalories: number;
  rangeMin: number;
  rangeMax: number;
  goalNotes: string;
  proteinGPerKgMin: number;
  proteinGPerKgMax: number;
};

function roundCalories(n: number): number {
  return Math.round(n / 10) * 10;
}

export function bmrMifflinStJeor(input: Pick<TdeeInput, "weightKg" | "heightCm" | "ageYears" | "sex">): number {
  const { weightKg, heightCm, ageYears, sex } = input;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return sex === "male" ? base + 5 : base - 161;
}

export function activityMultiplier(activity: ActivityLevel): number {
  const row = ACTIVITY_LEVELS.find((a) => a.id === activity);
  return row?.multiplier ?? 1.2;
}

export function calculateTdee(input: TdeeInput): TdeeResult {
  const bmr = bmrMifflinStJeor(input);
  const mult = activityMultiplier(input.activity);
  const tdee = roundCalories(bmr * mult);

  let targetCalories = tdee;
  let rangeMin = tdee;
  let rangeMax = tdee;
  let goalNotes = "";
  let proteinGPerKgMin = 1.2;
  let proteinGPerKgMax = 1.6;

  switch (input.goal) {
    case "lose_weight":
      targetCalories = roundCalories(tdee - 400);
      rangeMin = roundCalories(tdee - 500);
      rangeMax = roundCalories(tdee - 300);
      goalNotes =
        "About a 300–500 kcal deficit from TDEE is a common, sustainable fat-loss range. Adjust with hunger, energy, and rate of loss.";
      proteinGPerKgMin = 1.6;
      proteinGPerKgMax = 2.2;
      break;
    case "build_muscle":
      targetCalories = roundCalories(tdee + 250);
      rangeMin = roundCalories(tdee + 200);
      rangeMax = roundCalories(tdee + 350);
      goalNotes =
        "A modest surplus supports lean gains; if you gain faster than you want, nudge calories down toward the lower end of the range.";
      proteinGPerKgMin = 1.6;
      proteinGPerKgMax = 2.2;
      break;
    case "improve_bloodwork":
      targetCalories = roundCalories(tdee);
      rangeMin = roundCalories(tdee - 150);
      rangeMax = roundCalories(tdee + 50);
      goalNotes =
        "Maintenance or a very small deficit supports steady habits without aggressive restriction. Prioritize fiber, lean protein, and limits on ultra-processed foods—always follow your clinician for labs and meds.";
      proteinGPerKgMin = 1.2;
      proteinGPerKgMax = 1.8;
      break;
  }

  return {
    bmr: roundCalories(bmr),
    tdee,
    targetCalories,
    rangeMin,
    rangeMax,
    goalNotes,
    proteinGPerKgMin,
    proteinGPerKgMax,
  };
}

export function lbsToKg(lbs: number): number {
  return lbs * 0.45359237;
}

export function ftInToCm(feet: number, inches: number): number {
  const totalIn = feet * 12 + inches;
  return totalIn * 2.54;
}
