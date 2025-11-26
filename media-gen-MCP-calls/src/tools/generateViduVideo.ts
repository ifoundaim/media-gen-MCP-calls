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
    .min(1, "Prompt cannot be empty when provided")
    .optional()
    .describe("Full text description for Vidu to base the video on (optional if promptBase64 is provided)."),
  promptBase64: z
    .string()
    .regex(/^[A-Za-z0-9+/=]+$/, "promptBase64 must be base64-encoded")
    .optional()
    .describe(
      "Base64-encoded prompt text. Use this when long prompts might introduce Unicode encoding issues.",
    ),
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
  const rawPrompt = resolvePrompt(input);
  const prompt = cleanPromptForVidu(rawPrompt);
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

function resolvePrompt(input: GenerateViduVideoInput): string {
  if (input.promptBase64) {
    try {
      const decoded = Buffer.from(input.promptBase64, "base64").toString("utf8");
      if (decoded.trim().length === 0) {
        throw new Error("promptBase64 decoded to an empty string");
      }
      return decoded;
    } catch (error) {
      throw new Error(
        `Failed to decode promptBase64. Ensure it is valid base64. ${
          error instanceof Error ? error.message : ""
        }`,
      );
    }
  }

  if (typeof input.prompt === "string" && input.prompt.trim().length > 0) {
    return input.prompt;
  }

  throw new Error("Provide either promptBase64 or prompt.");
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


