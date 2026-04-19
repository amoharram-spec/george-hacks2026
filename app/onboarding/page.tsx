"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useState, type ChangeEvent, type FormEvent } from "react";

import { writeStoredTdeeResult } from "@/lib/tdee-storage";
import type { TdeeResult } from "@/lib/tdee";

import { TdeeCalculator } from "../tdee/tdee-calculator";

type OnboardingStep = "name" | "tdee" | "labs";

type LabReportResponse = {
  reportId: string;
  status: "text_extracted" | "parsed";
  fileName: string;
  storageUrl?: string;
  textLength: number;
  likelyScanned: boolean;
  textPreview: string;
  parseWarnings: string[];
  errorMessage?: string | null;
};

const stepTitles: Record<OnboardingStep, string> = {
  name: "Let’s start with your name",
  tdee: "Daily calories & energy needs",
  labs: "Upload your lab results",
};

const stepDescriptions: Record<OnboardingStep, string> = {
  name: "We’ll use this to personalize your nutrition plan and keep the flow feeling human.",
  tdee: "Height, weight, age, activity, and goal power a TDEE estimate so targets line up with your plan.",
  labs: "Add your latest PDF report so we can extract markers and connect them to your plan.",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("name");
  const [name, setName] = useState("");
  const [bodyMetrics, setBodyMetrics] = useState<{ weightKg: number; heightCm: number } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [report, setReport] = useState<LabReportResponse | null>(null);

  const stepIndex = { name: 1, tdee: 2, labs: 3 } as const;

  const canContinueName = name.trim().length > 0;
  const canContinueTdee = bodyMetrics !== null;
  const canSubmitLabs = canContinueName && canContinueTdee && Boolean(file);

  const handleTdeeMetrics = useCallback((metrics: { weightKg: number; heightCm: number } | null) => {
    setBodyMetrics(metrics);
  }, []);

  const handleTdeeResult = useCallback((result: TdeeResult | null) => {
    writeStoredTdeeResult(
      result
        ? {
            tdee: result.tdee,
            targetCalories: result.targetCalories,
            rangeMin: result.rangeMin,
            rangeMax: result.rangeMax,
          }
        : null,
    );
  }, []);

  const resetCurrentError = () => {
    if (error) setError("");
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;

    if (!selectedFile) {
      setFile(null);
      setError("");
      return;
    }

    if (selectedFile.type !== "application/pdf") {
      setFile(null);
      setError("Please upload a PDF file only.");
      return;
    }

    setFile(selectedFile);
    setError("");
    setSubmitError("");
  };

  /** Continues wizard logic, ensuring user fields are filled correctly before proceeding. */
  const goToNextStep = () => {
    if (currentStep === "name") {
      if (!canContinueName) {
        setError("Please enter your name to continue.");
        return;
      }

      setError("");
      setCurrentStep("tdee");
      return;
    }

    if (currentStep === "tdee") {
      if (!canContinueTdee) {
        setError("Complete the calculator with valid height, weight, and age so we can continue.");
        return;
      }

      setError("");
      setCurrentStep("labs");
    }
  };

  /**
   * Final step submission handler. 
   * Form data contains the PDF file and user metadata. 
   * Calls an API route that stores the PDF and extracts raw text but *does not* structure the labs mathematically yet.
   */
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (currentStep === "name") {
      goToNextStep();
      return;
    }

    if (currentStep === "tdee") {
      goToNextStep();
      return;
    }

    if (!canSubmitLabs || !file || !bodyMetrics) {
      setError("Please complete the earlier steps and choose a PDF file.");
      return;
    }

    setIsUploading(true);
    setSubmitError("");
    setReport(null);

    const formData = new FormData();
    formData.append("name", name.trim());
    formData.append("heightCm", String(bodyMetrics.heightCm));
    formData.append("weightKg", String(bodyMetrics.weightKg));
    formData.append("file", file);

    try {
      const response = await fetch("/api/lab-reports", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as LabReportResponse & { error?: string };

      if (!response.ok) {
        setSubmitError(payload.error ?? "Upload failed.");
        return;
      }

      setReport(payload);
    } catch {
      setSubmitError("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Separate logic specifically to call Gemini bounding.
   * We offload extraction to a second step so UI doesn't time out while Gemini reads huge medical documents.
   */
  const handleParse = async () => {
    if (!report) return;

    setIsParsing(true);
    setSubmitError("");

    try {
      const response = await fetch(`/api/lab-reports/${report.reportId}/parse`, {
        method: "POST",
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setSubmitError(payload.error ?? "Parsing failed.");
        return;
      }

      // Automatically redirect to dashboard after success
      router.push("/dashboard");
    } catch {
      setSubmitError("Parsing failed. Please try again.");
    } finally {
      setIsParsing(false);
    }
  };

  const renderStep = () => {
    if (currentStep === "name") {
      return (
        <motion.div
          key="name"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="space-y-5"
        >
          <div>
            <label htmlFor="name" className="mb-2 block text-sm font-medium text-gray-900">
              Full Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                resetCurrentError();
              }}
              placeholder="Enter your full name"
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-sm font-medium text-zinc-950 outline-none shadow-sm transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 placeholder:text-zinc-400"
            />
          </div>
        </motion.div>
      );
    }

    if (currentStep === "tdee") {
      return (
        <motion.div
          key="tdee"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="space-y-4"
        >
          <TdeeCalculator
            variant="embedded"
            onMetricsChange={handleTdeeMetrics}
            onResultChange={handleTdeeResult}
          />
        </motion.div>
      );
    }

    return (
      <motion.div
        key="labs"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className="space-y-4"
      >
        <div>
          <label htmlFor="pdf" className="mb-2 block text-sm font-medium text-gray-900">
            Lab Report PDF
          </label>
          <input
            id="pdf"
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"
          />

          <p className="mt-2 text-xs text-gray-500">
            Your clinical data will be analyzed by our AI Bioinformatician.
          </p>

          {file ? <p className="mt-2 text-sm text-emerald-600">Selected: {file.name}</p> : null}
        </div>
      </motion.div>
    );
  };

  return (
    <main className="min-h-screen bg-zinc-50/50 px-4 py-10 selection:bg-emerald-100 selection:text-emerald-900">
      <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
        <section className="rounded-[2.5rem] border border-white/80 bg-white/95 p-8 shadow-[0_20px_50px_rgba(15,23,42,0.12)] backdrop-blur-sm">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
                Step {stepIndex[currentStep]} of 3
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-950">{stepTitles[currentStep]}</h1>
              <p className="mt-2 text-sm leading-6 text-gray-600">{stepDescriptions[currentStep]}</p>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-3 gap-2">
            {(["name", "tdee", "labs"] as OnboardingStep[]).map((step) => (
              <div
                key={step}
                className={`h-1.5 rounded-full transition-colors ${stepIndex[step] <= stepIndex[currentStep] ? "bg-black" : "bg-gray-200"}`}
              />
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <AnimatePresence mode="wait">{renderStep()}</AnimatePresence>

            {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

            {submitError ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</p> : null}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={
                  currentStep === "name"
                    ? !canContinueName
                    : currentStep === "tdee"
                      ? !canContinueTdee
                      : !canSubmitLabs || isUploading
                }
                className="flex-1 rounded-2xl bg-zinc-950 py-4 text-sm font-bold text-white shadow-lg shadow-zinc-950/20 transition-all hover:bg-zinc-800 hover:shadow-xl active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                {currentStep === "name"
                  ? "Initialize Profile"
                  : currentStep === "tdee"
                    ? "Confirm Energy Goals"
                    : isUploading
                      ? "Uploading Laboratory Data..."
                      : "Upload and Proceed"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-[2.5rem] border border-white/80 bg-white/95 p-8 shadow-[0_20px_50px_rgba(15,23,42,0.12)] backdrop-blur-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-950">Onboarding Preview</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Finish the steps and upload your report. Insights will be waiting for you in the dashboard.
              </p>
            </div>
          </div>

          {!report ? (
            <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm leading-6 text-gray-600">
              Ready to process your health profile?
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              <div className="rounded-2xl bg-emerald-50 p-6 text-center border border-emerald-100">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-emerald-700 text-xl font-bold">✓</span>
                </div>
                <h3 className="text-lg font-bold text-emerald-900">Upload Complete</h3>
                <p className="text-sm text-emerald-700 mt-2 mb-6">Your bloodwork has been successfully extracted.</p>
                <button
                  type="button"
                  onClick={handleParse}
                  disabled={isParsing}
                  className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isParsing ? "Analyzing Biomarkers..." : "Synthesize AI Insights & Go to Dashboard"}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
