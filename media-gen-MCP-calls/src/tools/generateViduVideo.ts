import { z } from "zod";
import { type ToolMetadata, type InferSchema } from "xmcp";
import {
  createViduVideo,
  type ViduVideoResult,
} from "../lib/viduClient";

const MIN_DURATION_SECONDS = 1;
const MAX_DURATION_SECONDS = 8;
const DEFAULT_DURATION_SECONDS = 4;
const DEFAULT_ASPECT_RATIO = "16:9";
const ASPECT_RATIO_PATTERN = /^\d+:\d+$/;

export const schema = {
  prompt: z
    .string()
    .min(1, "Prompt is required")
    .describe("Full text description for Vidu to base the video on"),
  durationSeconds: z
    .number()
    .optional()
    .describe("Desired duration (seconds). Defaults to 4 and clamps between 1-8."),
  aspectRatio: z
    .string()
    .regex(ASPECT_RATIO_PATTERN, "Aspect ratio must look like 16:9")
    .optional()
    .describe('Aspect ratio such as \"16:9\", \"9:16\", or \"1:1\".'),
  style: z
    .string()
    .min(1, "Style cannot be empty when provided")
    .optional()
    .describe('Optional style hints like \"anime\" or \"cinematic\".'),
  referenceImageUrl: z
    .string()
    .url("referenceImageUrl must be a valid URL")
    .optional()
    .describe(
      "Optional URL of a reference image to guide the video (image-to-video).",
    ),
};

export type GenerateViduVideoInput = InferSchema<typeof schema>;
export type GenerateViduVideoOutput = ViduVideoResult;

export const metadata: ToolMetadata = {
  name: "generateViduVideo",
  description: "Generate a short video by calling the Vidu video generation API",
  annotations: {
    title: "Generate a Vidu video",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
  },
};

export default async function generateViduVideo(
  input: GenerateViduVideoInput,
): Promise<GenerateViduVideoOutput> {
  const prompt = cleanPromptForVidu(input.prompt);
  if (!prompt) {
    throw new Error("Prompt cannot be empty");
  }

  const durationSeconds = clampDuration(input.durationSeconds);
  const aspectRatio = input.aspectRatio ?? DEFAULT_ASPECT_RATIO;
  const style = input.style?.trim() || undefined;
  const referenceImageUrl = input.referenceImageUrl?.trim() || undefined;

  // The Vidu client encapsulates the REST call, so polling vs. direct URL
  // strategies can be updated there without changing the tool contract.
  return createViduVideo({
    prompt,
    durationSeconds,
    aspectRatio,
    style,
    referenceImageUrl,
  });
}

function cleanPromptForVidu(raw: string): string {
  return raw
    // Replace Unicode line/paragraph separators with spaces
    .replace(/[\u2028\u2029]/g, " ")
    // Replace normal newlines with spaces
    .replace(/\r?\n/g, " ")
    // Collapse multiple whitespace characters
    .replace(/\s+/g, " ")
    .trim();
}

function clampDuration(value?: number): number {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    return DEFAULT_DURATION_SECONDS;
  }

  return Math.min(MAX_DURATION_SECONDS, Math.max(MIN_DURATION_SECONDS, value));
}


