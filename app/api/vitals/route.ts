import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

export async function GET() {
  try {
    // The vitals.json file is located at the root of the project
    const vitalsPath = path.join(process.cwd(), "vitals.json");
    
    if (!fs.existsSync(vitalsPath)) {
      return NextResponse.json({ live: false, pulse: 0, breathing: 0, msg: "vitals.json not found" });
    }

    const fileContent = fs.readFileSync(vitalsPath, "utf-8");
    const data = JSON.parse(fileContent);

    // Provide a more lenient check to see if the data is fresh (updated within the last 2 minutes)
    const now = Date.now();
    const timestamp = data.timestamp || 0;
    const isLive = (now - timestamp) < 120000;

    return NextResponse.json({
      live: isLive,
      pulse: data.pulse || 0,
      breathing: data.breathing || 0,
      timestamp: data.timestamp
    });
  } catch (error) {
    return NextResponse.json({ live: false, pulse: 0, breathing: 0, msg: "Error reading vitals.json" });
  }
}

const execAsync = promisify(exec);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("video") as File;
    if (!file) {
      return NextResponse.json({ error: "No video provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const videoPath = path.join(process.cwd(), "uploaded_video.mp4");
    fs.writeFileSync(videoPath, buffer);

    const apiKey = process.env.PRESAGE_API_KEY || "YOUR_KEY";
    
    // Convert Windows path for the binary and common project files
    const companionDir = "/mnt/c/Users/abdel/Downloads/Georgehacks26/george-hacks2026/presage-companion";
    const absoluteVideoPath = "/mnt/c/Users/abdel/Downloads/Georgehacks26/george-hacks2026/uploaded_video.mp4";
    const absoluteVitalsJson = "/mnt/c/Users/abdel/Downloads/Georgehacks26/george-hacks2026/vitals.json";
    
    console.log("Triggering Presage SDK in Ubuntu-22.04...");
    
    // We run this asynchronously. It will overwrite vitals.json.
    // Explicitly using Ubuntu-22.04 which has our SDK installed.
    exec(`wsl -d Ubuntu-22.04 -e bash -c "cd ${companionDir} && ./live_vitals ${apiKey} ${absoluteVideoPath} ${absoluteVitalsJson}"`);

    return NextResponse.json({ success: true, message: "Processing started" });
  } catch (err) {
    console.error("Upload error", err);
    return NextResponse.json({ error: "Failed to process video" }, { status: 500 });
  }
}
