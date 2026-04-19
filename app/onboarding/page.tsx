"use client";

import { useState } from "react";

import { TdeeCalculator } from "../tdee/tdee-calculator";

export default function OnboardingPage() {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!name.trim() || !file) return;

    console.log("Name:", name);
    console.log("Uploaded file:", file.name);

    alert("Form submitted successfully.");
  };

  return (
    <main className="min-h-screen bg-[#e8e6e1] px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="rounded-[1.9rem] border border-white/80 bg-white/95 p-6 shadow-[0_14px_40px_rgba(15,23,42,0.08)] sm:p-8">
          <h1 className="text-center text-2xl font-semibold tracking-tight text-zinc-950">Get started</h1>
          <p className="mt-2 text-center text-sm leading-6 text-zinc-600">
            Tell us your name, estimate your daily calories, then upload your bloodwork report as a PDF.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-8">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-zinc-700">
                Full name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                autoComplete="name"
                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-950 outline-none ring-zinc-950/10 placeholder:text-zinc-400 focus:ring-2"
              />
            </div>

            <TdeeCalculator variant="embedded" />

            <div>
              <label htmlFor="pdf" className="block text-sm font-medium text-zinc-700">
                Bloodwork PDF
              </label>
              <input
                id="pdf"
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-800"
              />

              {file && <p className="mt-2 text-sm font-medium text-emerald-700">Selected: {file.name}</p>}

              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            </div>

            <button
              type="submit"
              disabled={!name.trim() || !file}
              className="w-full rounded-xl bg-zinc-950 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
