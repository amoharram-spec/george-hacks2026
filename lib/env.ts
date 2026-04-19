function readEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

export function getGeminiApiKey() {
  return readEnv("GEMINI_API_KEY", "GOOGLE_API_KEY");
}

export function getUsdaApiKey() {
  return readEnv("USDA_API_KEY", "FDC_API_KEY", "FOODDATA_CENTRAL_API_KEY");
}
