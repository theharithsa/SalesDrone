import { z } from 'zod';
export const WORKSPACE_SETTINGS_PATH =
  'workspaces/avinyatech/settings/workspace';
export const WorkspaceSettingsPatch = z
  .object({
    expectedVersion: z.number().int().positive(),
    exportsEnabled: z.boolean(),
    assignedOnly: z.boolean(),
  })
  .strict();
export async function readWorkspaceSettings(store) {
  const record = await store.get(WORKSPACE_SETTINGS_PATH);
  return {
    version: record?.version || 1,
    exportsEnabled: record?.exportsEnabled !== false,
    assignedOnly: record?.assignedOnly !== false,
  };
}
