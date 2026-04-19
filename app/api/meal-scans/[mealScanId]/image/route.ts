import { get } from "@vercel/blob";
import { ObjectId } from "mongodb";

import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  segmentData: { params: Promise<{ mealScanId: string }> },
) {
  try {
    const { mealScanId } = await segmentData.params;

    if (!ObjectId.isValid(mealScanId)) {
      return new Response("Invalid meal scan ID.", { status: 400 });
    }

    const db = await getDatabase();
    const scan = await db.collection("mealScans").findOne({ _id: new ObjectId(mealScanId) });

    if (!scan || typeof scan.storageKey !== "string" || !scan.storageKey.trim()) {
      return new Response("Meal image not found.", { status: 404 });
    }

    const blob = await get(scan.storageKey, {
      access: "private",
      useCache: true,
    });

    if (!blob || blob.statusCode !== 200) {
      return new Response("Meal image not found.", { status: 404 });
    }

    const headers = new Headers();
    headers.set("Content-Type", blob.blob.contentType);
    headers.set("Cache-Control", "private, max-age=300");
    headers.set("ETag", blob.blob.etag);

    return new Response(blob.stream, {
      status: 200,
      headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load meal image.";

    return new Response(message, { status: 500 });
  }
}
