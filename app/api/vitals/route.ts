import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

import { getDemoVitalsSession, getEmptyVitalsState } from "@/lib/vitals";

const VITALS_PATH = path.join(process.cwd(), "vitals.json");
const UPLOADED_VIDEO_PATH = path.join(process.cwd(), "uploaded_video.mp4");

type StoredVitalsState = {
  mode?: "demo-sequence";
  demoStartedAt?: number;
  pulse?: number;
  breathing?: number;
  timestamp?: number;
};

export async function GET() {
  try {
    if (!fs.existsSync(VITALS_PATH)) {
      return NextResponse.json(getEmptyVitalsState("vitals.json not found"));
    }

    const fileContent = fs.readFileSync(VITALS_PATH, "utf-8");
    const data = JSON.parse(fileContent) as StoredVitalsState;

    if (data.mode === "demo-sequence" && typeof data.demoStartedAt === "number") {
      return NextResponse.json(getDemoVitalsSession(data.demoStartedAt));
    }

    const now = Date.now();
    const timestamp = data.timestamp || 0;
    const isLive = (now - timestamp) < 120000;

    return NextResponse.json({
      live: isLive,
      pulse: data.pulse || 0,
      breathing: data.breathing || 0,
      timestamp: data.timestamp || null,
      sessionId: null,
      currentIndex: 0,
      sequenceLength: 0,
      progressPercent: isLive ? 100 : 0,
      isComplete: isLive,
      status: isLive ? "complete" : "idle",
      samples: typeof data.pulse === "number" && typeof data.breathing === "number" && data.timestamp
        ? [{ pulse: data.pulse, breathing: data.breathing, timestamp: data.timestamp }]
        : [],
      averages: typeof data.pulse === "number" && typeof data.breathing === "number"
        ? { pulse: data.pulse, breathing: data.breathing }
        : null,
    });
  } catch {
    return NextResponse.json(getEmptyVitalsState("Error reading vitals.json"));
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("video") as File;
    if (!file) {
      return NextResponse.json({ error: "No video provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(UPLOADED_VIDEO_PATH, buffer);

    const startedAt = Date.now();
    const initialVitals = getDemoVitalsSession(startedAt, startedAt);

    fs.writeFileSync(
      VITALS_PATH,
      JSON.stringify(
        {
          mode: "demo-sequence",
          demoStartedAt: startedAt,
          pulse: initialVitals.pulse,
          breathing: initialVitals.breathing,
          timestamp: initialVitals.timestamp,
        },
        null,
        2
      )
    );

    return NextResponse.json({ success: true, message: "Demo vitals started", ...initialVitals });
  } catch (err) {
    console.error("Upload error", err);
    return NextResponse.json({ error: "Failed to process video" }, { status: 500 });
  }
}
