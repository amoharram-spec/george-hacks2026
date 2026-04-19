import type { TdeeResult } from "@/lib/tdee";

export const TDEE_STORAGE_KEY = "onboarding-tdee-result";
export const TDEE_STORAGE_UPDATED_EVENT = "tdee-storage-updated";

export type StoredTdeeResult = Pick<TdeeResult, "tdee" | "targetCalories" | "rangeMin" | "rangeMax">;

export function readStoredTdeeResult(): StoredTdeeResult | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(TDEE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredTdeeResult>;

    if (
      typeof parsed.tdee !== "number" ||
      typeof parsed.targetCalories !== "number" ||
      typeof parsed.rangeMin !== "number" ||
      typeof parsed.rangeMax !== "number"
    ) {
      return null;
    }

    return parsed as StoredTdeeResult;
  } catch {
    return null;
  }
}

export function writeStoredTdeeResult(result: StoredTdeeResult | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!result) {
    window.localStorage.removeItem(TDEE_STORAGE_KEY);
    window.dispatchEvent(new Event(TDEE_STORAGE_UPDATED_EVENT));
    return;
  }

  window.localStorage.setItem(TDEE_STORAGE_KEY, JSON.stringify(result));
  window.dispatchEvent(new Event(TDEE_STORAGE_UPDATED_EVENT));
}
