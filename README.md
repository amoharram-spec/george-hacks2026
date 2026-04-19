# George Hacks 2026 - Nutrition Companion

A Next.js prototype that helps users organize lab report data and daily nutrition insights in one place.

## Project Purpose

This project is an early-stage nutrition companion app.
It is designed to help users:

- upload bloodwork/lab report PDFs
- extract and parse key lab markers
- view a nutrition-focused dashboard with macro and micronutrient tracking
- optionally process a face video for live vitals through a local companion binary

This tool is for informational support and should not replace professional medical advice.

## What the App Does Today

The current codebase includes two main user flows:

1. **Onboarding + Lab Report Processing** (`/onboarding`)
   - step-based onboarding (name, height, weight)
   - PDF upload (up to 4MB)
   - text extraction from PDF
   - optional lab value parsing with Gemini
   - parsed lab markers and warnings displayed in the UI

2. **Nutrition Dashboard** (`/dashboard`)
   - daily nutrition dashboard UI
   - macro and micronutrient cards
   - meal cards with nutrient details
   - quick actions UI (display-only currently)
   - "Presage Vitals" card that polls `/api/vitals` and supports video upload for processing

## Key Features

- **PDF Lab Report Upload**
  - Validates PDF type and size
  - Uploads file to Vercel Blob storage
  - Extracts text from the uploaded PDF

- **AI-Assisted Lab Parsing**
  - Sends extracted text to Gemini (`gemini-2.5-flash`)
  - Normalizes parsed markers into a consistent JSON shape
  - Stores parsing warnings and parser output

- **MongoDB Persistence**
  - Stores lab report metadata, extracted text, parse status, and parsed markers

- **Nutrition Dashboard UI**
  - Includes macros, micros, meals, and recommendation widgets
  - Uses static mock data for nutrition values in this version

- **Optional Vitals Processing Flow**
  - Uploads a video to `/api/vitals`
  - Triggers an external Presage C++ binary workflow (machine-specific setup required)

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **UI:** React 19, Tailwind CSS 4, Framer Motion
- **Storage:** Vercel Blob (`@vercel/blob`)
- **Database:** MongoDB (`mongodb` driver)
- **PDF Processing:** `pdf-parse`
- **Linting:** ESLint (Next.js config)

## Setup / Installation

### Prerequisites

- Node.js (recommended: latest LTS, 20+)
- npm
- MongoDB instance
- Gemini API key (for lab parsing)
- Vercel Blob token (for lab upload endpoint)

### 1) Clone and install dependencies

```bash
git clone <your-repo-url>
cd george-hacks2026-1
npm install
```

### 2) Create environment variables

Create a `.env.local` file in the project root:

```env
MONGODB_URI=your_mongodb_connection_string
GEMINI_API_KEY=your_gemini_api_key
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
PRESAGE_API_KEY=your_presage_api_key_optional
```

### Environment variable notes

- `MONGODB_URI` - required for lab report API routes.
- `GEMINI_API_KEY` - required to parse extracted lab text with Gemini.
- `BLOB_READ_WRITE_TOKEN` - required for `@vercel/blob` uploads in `/api/lab-reports`.
- `PRESAGE_API_KEY` - used by `/api/vitals` POST flow; optional unless using the Presage vitals upload flow.

## Run Locally

Start the development server:

```bash
npm run dev
```

Then open:

- `http://localhost:3000/onboarding` for onboarding + lab upload flow
- `http://localhost:3000/dashboard` for the nutrition dashboard

## How to Use the App

### Onboarding and Lab Parsing

1. Open `/onboarding`
2. Enter name, height (cm), and weight (kg)
3. Upload a PDF lab report (under 4MB)
4. Wait for upload + text extraction
5. Click **Parse with Gemini** to extract structured lab markers
6. Review parsed values and warnings

### Dashboard

1. Open `/dashboard`
2. Review daily summary cards and meal cards
3. (Optional) Upload a face video in **Presage Vitals** to trigger vitals processing
4. The vitals card polls `/api/vitals` for updated values

## Basic Project Structure

```text
app/
  api/
    lab-reports/
      route.ts                      # Upload PDF + extract text + persist report
      [reportId]/
        route.ts                    # Fetch report by ID
        parse/route.ts              # Parse extracted text with Gemini
    vitals/route.ts                 # Read vitals.json / trigger video processing
  dashboard/
    page.tsx
    dashboard-view.tsx
    mock-data.ts                    # Dashboard data is currently mocked
  onboarding/
    page.tsx                        # Multi-step onboarding + upload UI
  layout.tsx
  page.tsx                          # Default Next.js starter page

lib/
  mongodb.ts                        # MongoDB client and database helper

presage-companion/
  live_vitals.cpp                   # C++ companion binary source
  CMakeLists.txt
  setup_presage_sdk.sh
```

## Important Notes and Limitations

- The root route (`/`) is still the default Next.js starter page.
- Dashboard nutrition values are currently mock data (`app/dashboard/mock-data.ts`).
- No authentication or user accounts are implemented yet.
- The Presage vitals pipeline is environment-specific and currently contains hardcoded WSL/Windows paths in `app/api/vitals/route.ts`.
- PDF extraction quality may be limited for scanned PDFs without OCR.
- This project is a prototype and not production-hardened.
- Nutrition and lab insights are informational; users should consult licensed clinicians for medical decisions.

## Available Scripts

- `npm run dev` - start local development server
- `npm run build` - create production build
- `npm run start` - run production server
- `npm run lint` - run ESLint
