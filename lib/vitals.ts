export const DEMO_VITALS_SEQUENCE = [
  { pulse: 61.2, breathing: 12.6 },
  { pulse: 57.6, breathing: 10.8 },
  { pulse: 55.8, breathing: 10.8 },
  { pulse: 50.4, breathing: 9 },
  { pulse: 46.8, breathing: 9 },
  { pulse: 41.4, breathing: 7.2 },
  { pulse: 41.4, breathing: 7.2 },
  { pulse: 180, breathing: 7.2 },
  { pulse: 180, breathing: 7.2 },
  { pulse: 180, breathing: 7.2 },
  { pulse: 180, breathing: 7.2 },
  { pulse: 180, breathing: 7.2 },
  { pulse: 52.2, breathing: 7.2 },
  { pulse: 180, breathing: 7.2 },
  { pulse: 64.8, breathing: 7.2 },
  { pulse: 178.2, breathing: 9 },
  { pulse: 180, breathing: 9 },
  { pulse: 180, breathing: 7.2 },
  { pulse: 178.2, breathing: 7.2 },
  { pulse: 171, breathing: 5.4 },
  { pulse: 169.2, breathing: 5.4 },
  { pulse: 165.6, breathing: 5.4 },
  { pulse: 167.4, breathing: 25.2 },
  { pulse: 171, breathing: 27 },
] as const;

export type VitalsSample = {
  pulse: number;
  breathing: number;
  timestamp: number;
};

export type VitalsAverages = {
  pulse: number;
  breathing: number;
};

export type VitalsStreamResponse = {
  live: boolean;
  pulse: number;
  breathing: number;
  timestamp: number | null;
  sessionId: number | null;
  currentIndex: number;
  sequenceLength: number;
  progressPercent: number;
  isComplete: boolean;
  status: "idle" | "reading" | "complete";
  samples: VitalsSample[];
  averages: VitalsAverages | null;
  msg?: string;
};

function roundToSingleDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function getAverage(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return roundToSingleDecimal(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function getEmptyVitalsState(message?: string): VitalsStreamResponse {
  return {
    live: false,
    pulse: 0,
    breathing: 0,
    timestamp: null,
    sessionId: null,
    currentIndex: 0,
    sequenceLength: DEMO_VITALS_SEQUENCE.length,
    progressPercent: 0,
    isComplete: false,
    status: "idle",
    samples: [],
    averages: null,
    msg: message,
  };
}

export function getDemoVitalsSession(startedAt: number, now = Date.now()): VitalsStreamResponse {
  const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const lastIndex = DEMO_VITALS_SEQUENCE.length - 1;
  const currentIndex = Math.min(elapsedSeconds, lastIndex);
  const isComplete = currentIndex >= lastIndex;
  const sample = DEMO_VITALS_SEQUENCE[currentIndex];
  const samples = DEMO_VITALS_SEQUENCE.slice(0, currentIndex + 1).map((entry, index) => ({
    pulse: entry.pulse,
    breathing: entry.breathing,
    timestamp: startedAt + index * 1000,
  }));
  const averages = isComplete
    ? {
        pulse: getAverage(samples.map((entry) => entry.pulse)),
        breathing: getAverage(samples.map((entry) => entry.breathing)),
      }
    : null;

  return {
    live: !isComplete,
    pulse: sample.pulse,
    breathing: sample.breathing,
    timestamp: startedAt + currentIndex * 1000,
    sessionId: startedAt,
    currentIndex: currentIndex + 1,
    sequenceLength: DEMO_VITALS_SEQUENCE.length,
    progressPercent: Math.round(((currentIndex + 1) / DEMO_VITALS_SEQUENCE.length) * 100),
    isComplete,
    status: isComplete ? "complete" : "reading",
    samples,
    averages,
  };
}
