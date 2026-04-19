export type DailyMetric = {
  label: string;
  consumed: number;
  target: number;
  unit: string;
  tone: string;
};

export type Micronutrient = {
  key: string;
  label: string;
  consumed: number;
  target: number;
  unit: string;
  status: "low" | "on track" | "exceeded";
  tone: string;
};

export type NutrientAmount = {
  key: string;
  label: string;
  amount: number;
  unit: string;
};

export type MealFoodItem = {
  name: string;
  confidence: number | null;
  servingSizeEstimate: string;
  gramsEstimate: number | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  micronutrients: NutrientAmount[];
  dataSource: string;
};

export type Meal = {
  id: string;
  name: string;
  time: string;
  imageUrl: string | null;
  confidence: number | null;
  servingSizeEstimate: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  note: string;
  palette: string;
  micros: Array<{
    label: string;
    amount: string;
  }>;
  foods: MealFoodItem[];
  warnings: string[];
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
  recommendedTarget: number;
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
    priorityNutrients: string[];
    explanation: string;
  };
  proposedAdjustments: ProposedAdjustment[];
};

export type DashboardData = {
  dateLabel: string;
  dailySummary: DailyMetric[];
  macroRings: DailyMetric[];
  supportMetrics: DailyMetric[];
  micronutrients: Micronutrient[];
  meals: Meal[];
  recommendation: Recommendation;
};
