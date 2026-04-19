export type DailyMetric = {
  label: string;
  consumed: number;
  target: number;
  unit: string;
  tone: string;
};

export type Micronutrient = {
  label: string;
  consumed: number;
  target: number;
  unit: string;
  status: "low" | "on track" | "exceeded";
  tone: string;
};

export type Meal = {
  id: string;
  name: string;
  time: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  note: string;
  palette: string;
  micros: Array<{
    label: string;
    amount: string;
  }>;
};

export type Recommendation = {
  title: string;
  summary: string;
  alignment: string;
  nextMeal: string;
  reasons: string[];
  ctaLabel: string;
};

export type ProposedAdjustment = {
  metric: string;
  recommended_target: number;
  unit: string;
  reasoning: string;
};

export type AIInsight = {
  summary: {
    deficiencies: Array<{
      marker: string;
      value: string;
      status: string;
      impact: string;
    }>;
    trends: string;
  };
  strategy: {
    priority_nutrients: string[];
    explanation: string;
  };
  proposed_adjustments: ProposedAdjustment[];
};

export type DashboardData = {
  dateLabel: string;
  dailySummary: DailyMetric[];
  macroRings: DailyMetric[];
  supportMetrics: DailyMetric[];
  micronutrients: Micronutrient[];
  meals: Meal[];
  recommendation: Recommendation;
  aiInsight?: AIInsight;
};

export const dashboardData: DashboardData = {
  dateLabel: "Saturday, April 18",
  dailySummary: [
    { label: "Calories", consumed: 1540, target: 2100, unit: "kcal", tone: "bg-rose-100 text-rose-700" },
    { label: "Protein", consumed: 102, target: 150, unit: "g", tone: "bg-emerald-100 text-emerald-700" },
    { label: "Carbs", consumed: 140, target: 210, unit: "g", tone: "bg-amber-100 text-amber-700" },
    { label: "Fat", consumed: 48, target: 70, unit: "g", tone: "bg-sky-100 text-sky-700" },
  ],
  macroRings: [
    { label: "Protein", consumed: 102, target: 150, unit: "g", tone: "#38b26d" },
    { label: "Carbs", consumed: 140, target: 210, unit: "g", tone: "#f3a646" },
    { label: "Fat", consumed: 48, target: 70, unit: "g", tone: "#58a8f2" },
  ],
  supportMetrics: [
    { label: "Calories", consumed: 1540, target: 2100, unit: "kcal", tone: "bg-rose-400" },
    { label: "Fiber", consumed: 24, target: 30, unit: "g", tone: "bg-lime-400" },
    { label: "Water", consumed: 1.8, target: 2.7, unit: "L", tone: "bg-cyan-400" },
  ],
  micronutrients: [
    { label: "Iron", consumed: 11, target: 18, unit: "mg", status: "low", tone: "bg-rose-300" },
    { label: "Magnesium", consumed: 250, target: 400, unit: "mg", status: "low", tone: "bg-violet-300" },
    { label: "Potassium", consumed: 2600, target: 3400, unit: "mg", status: "low", tone: "bg-indigo-300" },
    { label: "Calcium", consumed: 920, target: 1000, unit: "mg", status: "on track", tone: "bg-sky-300" },
    { label: "Sodium", consumed: 2450, target: 2300, unit: "mg", status: "exceeded", tone: "bg-orange-300" },
    { label: "Vitamin D", consumed: 14, target: 20, unit: "mcg", status: "low", tone: "bg-yellow-300" },
    { label: "Vitamin B12", consumed: 3.9, target: 2.4, unit: "mcg", status: "exceeded", tone: "bg-teal-300" },
    { label: "Folate", consumed: 350, target: 400, unit: "mcg", status: "on track", tone: "bg-green-300" },
    { label: "Zinc", consumed: 9, target: 11, unit: "mg", status: "on track", tone: "bg-emerald-300" },
    { label: "Omega-3", consumed: 1.2, target: 1.6, unit: "g", status: "low", tone: "bg-cyan-300" },
    { label: "Vitamin C", consumed: 96, target: 90, unit: "mg", status: "exceeded", tone: "bg-pink-300" },
    { label: "Vitamin A", consumed: 770, target: 900, unit: "mcg", status: "on track", tone: "bg-fuchsia-300" },
  ],
  meals: [
    {
      id: "meal-1",
      name: "Salmon Bowl with Quinoa",
      time: "12:25 PM",
      calories: 458,
      protein: 34,
      carbs: 38,
      fat: 18,
      note: "Strong omega-3 support and steady protein coverage.",
      palette: "from-orange-200 via-rose-100 to-amber-50",
      micros: [
        { label: "Omega-3", amount: "1.1g" },
        { label: "Vitamin D", amount: "8.4mcg" },
        { label: "Magnesium", amount: "92mg" },
        { label: "Potassium", amount: "760mg" },
      ],
    },
    {
      id: "meal-2",
      name: "Eggs and Sourdough",
      time: "8:05 AM",
      calories: 346,
      protein: 21,
      carbs: 27,
      fat: 16,
      note: "Good start for protein, but light on magnesium and fiber.",
      palette: "from-yellow-100 via-stone-100 to-white",
      micros: [
        { label: "Vitamin B12", amount: "1.2mcg" },
        { label: "Choline", amount: "280mg" },
        { label: "Iron", amount: "2.8mg" },
        { label: "Sodium", amount: "540mg" },
      ],
    },
    {
      id: "meal-3",
      name: "Greek Yogurt Berry Cup",
      time: "3:40 PM",
      calories: 218,
      protein: 17,
      carbs: 24,
      fat: 4,
      note: "Helps calcium and protein, but still leaves iron low for the day.",
      palette: "from-sky-100 via-violet-50 to-white",
      micros: [
        { label: "Calcium", amount: "260mg" },
        { label: "Vitamin C", amount: "34mg" },
        { label: "Potassium", amount: "310mg" },
        { label: "Folate", amount: "42mcg" },
      ],
    },
  ],
  recommendation: {
    title: "Eat a salmon, spinach, and quinoa dinner next",
    summary:
      "You are on pace for protein, but still trailing magnesium, potassium, iron, vitamin D, and omega-3.",
    alignment:
      "This keeps the day aligned with your recovery-focused plan and supports the low vitamin D and iron signals in your lab profile.",
    nextMeal: "Add roasted sweet potato and pumpkin seeds to close the magnesium and potassium gap without overshooting calories.",
    reasons: [
      "Protein is 68% complete, so the next meal should prioritize micronutrient recovery instead of chasing more calories alone.",
      "Sodium is already above target, so choose minimally processed foods for the next meal.",
      "Omega-3 and vitamin D are still behind plan, making fish or fortified dairy the highest-impact option tonight.",
    ],
    ctaLabel: "View Plan",
  },
};
