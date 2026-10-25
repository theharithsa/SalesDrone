import { z } from 'zod';
import { path } from './policy.js';
export const AI_SETTINGS_PATH = path('settings', 'ai');
export const DEFAULT_AI_INSTRUCTIONS =
  'Give a concise, practical sales briefing. Prioritize overdue follow-ups, useful next steps, outreach gaps and missing qualification context. Use a calm, clear tone and 2–4 actionable insights grounded in the available data.';
export const AISettingsPatch = z
  .object({
    expectedVersion: z.number().int().positive(),
    instructions: z.string().trim().max(4000),
    insightMode: z.enum(['manual', 'automatic']).optional(),
  })
  .strict();
export async function readAISettings(store) {
  const record = await store.get(AI_SETTINGS_PATH);
  return {
    version: record?.version || 1,
    instructions: record?.instructions || '',
    insightMode: record?.insightMode === 'automatic' ? 'automatic' : 'manual',
    defaultInstructions: DEFAULT_AI_INSTRUCTIONS,
    usingDefault: !record?.instructions,
  };
}
