"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useState, type ChangeEvent, type FormEvent } from "react";

import { writeStoredTdeeResult } from "@/lib/tdee-storage";
import type { TdeeResult } from "@/lib/tdee";

import { TdeeCalculator } from "../tdee/tdee-calculator";

type OnboardingStep = "name" | "tdee" | "labs";

/**
 * Shape of a medical lab marker successfully parsed by Gemini.
 */
type ParsedLab = {
  key: string;
  label: string;
  value: number | string | null;
  unit: string | null;
  referenceRange: string | null;
  flag: "low" | "normal" | "high" | "abnormal" | "unknown";
  sourceText: string | null;
};

/**
 * Encapsulates the entire lifecycle of a lab report upload.
 * It tracks the multi-step flow: 
 * 1. File uploaded and raw text extracted
 * 2. Sent to Gemini for structured JSON parsing (`parsedLabs`)
 */
type LabReportResponse = {
  reportId: string;
  status: "text_extracted" | "parsed";
  fileName: string;
  storageUrl?: string;
  textLength: number;
  likelyScanned: boolean;
  textPreview: string;
  parsedLabs: ParsedLab[] | null;
  parseWarnings: string[];
  errorMessage?: string | null;
};

function formatLabValue(lab: ParsedLab) {
  if (lab.value === null || lab.value === "") {
    return "No value";
  }

  return `${lab.value}${lab.unit ? ` ${lab.unit}` : ""}`;
}

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

      const payload = (await response.json()) as LabReportResponse & { error?: string };

      if (!response.ok) {
        setSubmitError(payload.error ?? "Parsing failed.");
        return;
      }

      setReport((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          status: payload.status,
          parsedLabs: payload.parsedLabs,
          parseWarnings: payload.parseWarnings,
        };
      });
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
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black/10"
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
            Server upload mode is capped at 4MB so it stays deployable on Vercel.
          </p>

          {file ? <p className="mt-2 text-sm text-emerald-600">Selected: {file.name}</p> : null}
        </div>
      </motion.div>
    );
  };

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <section className="rounded-3xl border bg-white p-8 shadow-md">
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
              {currentStep !== "name" ? (
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setCurrentStep(currentStep === "labs" ? "tdee" : "name");
                  }}
                  className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Back
                </button>
              ) : null}

              <button
                type="submit"
                disabled={
                  currentStep === "name"
                    ? !canContinueName
                    : currentStep === "tdee"
                      ? !canContinueTdee
                      : !canSubmitLabs || isUploading
                }
                className="flex-1 rounded-xl bg-black py-3 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {currentStep === "name"
                  ? "Continue"
                  : currentStep === "tdee"
                    ? "Continue"
                    : isUploading
                      ? "Uploading and extracting..."
                      : "Upload and extract text"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-3xl border bg-white p-8 shadow-md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-950">Lab Report Processing</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Complete the three-step onboarding flow, then your PDF is uploaded, text is extracted, and lab values are saved for review.
              </p>
            </div>

            {report ? (
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700">
                {report.status.replace("_", " ")}
              </span>
            ) : null}
          </div>

          {!report ? (
            <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm leading-6 text-gray-600">
              Your extracted text preview and parsed lab values will appear here after the final upload step.
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">File</p>
                  <p className="mt-2 text-sm font-medium text-gray-900">{report.fileName}</p>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Extracted Text</p>
                  <p className="mt-2 text-sm font-medium text-gray-900">{report.textLength.toLocaleString()} characters</p>
                  <p className="mt-1 text-sm text-gray-600">
                    {report.likelyScanned ? "Likely scanned PDF" : "Looks like text-based PDF"}
                  </p>
                </div>
              </div>

              {report.parseWarnings.length > 0 ? (
                <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
                  {report.parseWarnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              ) : null}

              <div>
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-950">Text Preview</h3>
                  {report.status !== "parsed" ? (
                    <button
                      type="button"
                      onClick={handleParse}
                      disabled={isParsing || report.textLength === 0}
                      className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isParsing ? "Parsing with Gemini..." : "Parse with Gemini"}
                    </button>
                  ) : null}
                </div>

                <div className="mt-3 rounded-2xl bg-gray-950 p-4 text-sm leading-6 text-gray-100">
                  {report.textPreview || "No text extracted from the PDF."}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-950">Parsed Labs</h3>

                {!report.parsedLabs || report.parsedLabs.length === 0 ? (
                  <div className="mt-3 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-700">
                    No parsed lab values yet.
                  </div>
                ) : (
                  <div className="mt-3 grid gap-3">
                    {report.parsedLabs.map((lab) => (
                      <article key={lab.key} className="rounded-2xl border bg-gray-50 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h4 className="font-semibold text-gray-900">{lab.label}</h4>
                            <p className="mt-1 text-sm text-gray-700">{formatLabValue(lab)}</p>
                            {lab.referenceRange ? (
                              <p className="mt-1 text-sm text-gray-700">Reference range: {lab.referenceRange}</p>
                            ) : null}
                          </div>

                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700">
                            {lab.flag}
                          </span>
                        </div>

                        {lab.sourceText ? <p className="mt-3 text-sm text-gray-700">Source: {lab.sourceText}</p> : null}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
