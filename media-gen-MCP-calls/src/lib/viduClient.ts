// Point this at the official Vidu creation endpoint or override via VIDU_API_URL.
const DEFAULT_VIDU_ENDPOINT = "https://api.vidu.com/v1/videos";

export type ViduVideoStatus = "queued" | "completed" | "failed";

export interface CreateViduVideoOptions {
  prompt: string;
  durationSeconds: number;
  aspectRatio: string;
  style?: string;
   // Optional URL of a reference image to guide the video (image-to-video).
  referenceImageUrl?: string;
}

export interface ViduVideoResult {
  videoUrl: string;
  status: ViduVideoStatus;
  previewImageUrl?: string;
  jobId?: string;
  rawResponse?: unknown;
}

/**
 * Minimal Vidu API client used by the XMCP tool. Update the endpoint or
 * payload mapping below once the official Vidu REST contract is available.
 */
export async function createViduVideo(
  options: CreateViduVideoOptions,
): Promise<ViduVideoResult> {
  const apiKey = process.env.VIDU_API_KEY;
  if (!apiKey) {
    throw new Error("VIDU_API_KEY is not set in the environment");
  }

  const {
    prompt,
    durationSeconds,
    aspectRatio,
    style,
    referenceImageUrl,
  } = options;

  const endpoint =
    process.env.VIDU_API_URL?.trim() || DEFAULT_VIDU_ENDPOINT;

  const payload: Record<string, unknown> = {
    prompt,
    duration: durationSeconds, // Replace with the exact Vidu field when known.
    aspect_ratio: aspectRatio,
  };

  const trimmedStyle = style?.trim();
  if (trimmedStyle) {
    payload.style = trimmedStyle;
  }

  if (referenceImageUrl) {
    // Adjust this field name once Vidu's official contract is confirmed.
    payload.reference_image_url = referenceImageUrl;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch {
    responseBody = undefined;
  }

  if (!response.ok) {
    console.error(
      `[Vidu] Request failed with status ${response.status} ${response.statusText}`,
    );
    return {
      videoUrl: "",
      status: "failed",
      rawResponse: responseBody,
    };
  }

  const parsed = (responseBody ?? {}) as Record<string, unknown>;

  const videoUrl = extractString(parsed, [
    "video_url",
    "videoUrl",
    "output_url",
    "outputUrl",
  ]);

  const previewImageUrl = extractString(parsed, [
    "preview_image_url",
    "previewImageUrl",
    "thumbnail_url",
    "thumbnail",
  ]);

  // Preserve any async job handle so callers can poll when status === "queued".
  const jobId = extractString(parsed, ["job_id", "jobId", "id"]);

  let status: ViduVideoStatus = "queued";
  const rawStatus = extractString(parsed, ["status"]);

  if (rawStatus) {
    // Map Vidu-specific status labels into the simplified XMCP contract.
    const normalized = rawStatus.toLowerCase();
    if (normalized.startsWith("complete")) {
      status = "completed";
    } else if (normalized.startsWith("fail") || normalized === "error") {
      status = "failed";
    }
  } else if (videoUrl) {
    status = "completed";
  }

  return {
    videoUrl,
    status,
    previewImageUrl,
    jobId,
    rawResponse: parsed,
  };
}

function extractString(
  source: Record<string, unknown>,
  keys: string[],
): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return "";
}

