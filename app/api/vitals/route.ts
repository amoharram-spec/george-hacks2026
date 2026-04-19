import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DEMO_VITALS_SEQUENCE = [
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

const VITALS_PATH = path.join(process.cwd(), "vitals.json");
const UPLOADED_VIDEO_PATH = path.join(process.cwd(), "uploaded_video.mp4");

type StoredVitalsState = {
  mode?: "demo-sequence";
  demoStartedAt?: number;
  pulse?: number;
  breathing?: number;
  timestamp?: number;
};

function getDemoVitals(startedAt: number, now = Date.now()) {
  const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const index = Math.min(elapsedSeconds, DEMO_VITALS_SEQUENCE.length - 1);
  const sample = DEMO_VITALS_SEQUENCE[index];

  return {
    live: true,
    pulse: sample.pulse,
    breathing: sample.breathing,
    timestamp: startedAt + index * 1000,
  };
}

export async function GET() {
  try {
    if (!fs.existsSync(VITALS_PATH)) {
      return NextResponse.json({ live: false, pulse: 0, breathing: 0, msg: "vitals.json not found" });
    }

    const fileContent = fs.readFileSync(VITALS_PATH, "utf-8");
    const data = JSON.parse(fileContent) as StoredVitalsState;

    if (data.mode === "demo-sequence" && typeof data.demoStartedAt === "number") {
      return NextResponse.json(getDemoVitals(data.demoStartedAt));
    }

    const now = Date.now();
    const timestamp = data.timestamp || 0;
    const isLive = (now - timestamp) < 120000;

    return NextResponse.json({
      live: isLive,
      pulse: data.pulse || 0,
      breathing: data.breathing || 0,
      timestamp: data.timestamp
    });
  } catch {
    return NextResponse.json({ live: false, pulse: 0, breathing: 0, msg: "Error reading vitals.json" });
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
    const initialVitals = getDemoVitals(startedAt, startedAt);

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
