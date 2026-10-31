import { z } from "zod";
import { path, validateTimezone } from "./policy.js";
import { AppError } from "./contracts.js";
import { readFieldOptions } from "./field-options.js";
export const RESEARCH_SETTINGS_PATH = path("settings", "leadResearch");
const stages = z
  .array(z.string().trim().min(1).max(100))
  .max(20)
  .refine((v) => new Set(v).size === v.length, "Remove duplicate stages");
export const ResearchSettingsPatch = z
  .object({
    expectedVersion: z.number().int().positive(),
    convertedStages: stages,
    failedStages: stages,
    archiveReviewStages: stages,
    inactivityDays: z.number().int().min(1).max(3650).nullable(),
    timezone: z.string().min(1).max(100),
    indexingEnabled: z.boolean(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.convertedStages.some((s) => v.failedStages.includes(s)))
      ctx.addIssue({
        code: "custom",
        message: "Converted and failed stages must be separate",
        path: ["failedStages"],
      });
  });
export async function readResearchSettings(store) {
  const value = await store.get(RESEARCH_SETTINGS_PATH);
  return {
    version: value?.version || 1,
    convertedStages: value?.convertedStages || [],
    failedStages: value?.failedStages || [],
    archiveReviewStages: value?.archiveReviewStages || [],
    inactivityDays: value?.inactivityDays ?? null,
    timezone: value?.timezone || "Asia/Kolkata",
    indexingEnabled: value?.indexingEnabled === true,
  };
}
export async function validateResearchSettings(store, input) {
  validateTimezone(input.timezone);
  const fields = await readFieldOptions(store);
  for (const stage of [
    ...input.convertedStages,
    ...input.failedStages,
    ...input.archiveReviewStages,
  ])
    if (!fields.values.stage.includes(stage))
      throw new AppError(
        400,
        "FIELD_OPTION",
        "Choose current configured stages. Retired mappings need review.",
      );
  return input;
}
// The reporting timezone, never the browser/server timezone, defines calendar dates.
export function calendarMonthWindow(at, timezone, offset = 0) {
  validateTimezone(timezone);
  if (
    !Number.isInteger(offset) ||
    offset < -120 ||
    offset > 0 ||
    !Number.isFinite(Date.parse(at))
  )
    throw new AppError(400, "INVALID_QUERY", "Choose a valid reporting month");
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
    })
      .formatToParts(new Date(at))
      .map((p) => [p.type, p.value]),
  );
  const date = new Date(
    Date.UTC(Number(parts.year), Number(parts.month) - 1 + offset, 1),
  );
  const startDate = date.toISOString().slice(0, 10);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return { startDate, endDate: date.toISOString().slice(0, 10), timezone };
}
export function reportingDate(at, timezone) {
  if (!at || !Number.isFinite(Date.parse(at))) return null;
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date(at))
      .map((p) => [p.type, p.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}
