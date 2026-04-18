"use client";

import { useState } from "react";

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
    <main className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-md">
        <h1 className="text-2xl font-bold text-center mb-2">Get Started</h1>
        <p className="text-sm text-gray-600 text-center mb-6">
          Enter your name and upload your bloodwork report as a PDF.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-2">
              Full Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              className="w-full rounded-lg border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div>
            <label htmlFor="pdf" className="block text-sm font-medium mb-2">
              Bloodwork PDF
            </label>
            <input
              id="pdf"
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              className="w-full rounded-lg border px-4 py-3"
            />

            {file && (
              <p className="mt-2 text-sm text-green-600">
                Selected: {file.name}
              </p>
            )}

            {error && (
              <p className="mt-2 text-sm text-red-600">
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!name.trim() || !file}
            className="w-full rounded-lg bg-black py-3 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </form>
      </div>
    </main>
  );
}