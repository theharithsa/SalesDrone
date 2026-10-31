import { lstat, readFile, realpath } from "node:fs/promises";
import { resolve } from "node:path";
export function checkEntrypoint(text, name) {
  const lines = text.trimEnd().split("\n");
  if (lines.length > 110 || Buffer.byteLength(text) > 8500)
    throw Error(
      `${name}: SKILL.md exceeds 110 lines or 8500 bytes; move conditional recipes to references/`,
    );
  const heading = lines.find(
    (line) => /^#{1,6} /.test(line) && /\bv\d+\.\d+|\blocal[ -]\d/i.test(line),
  );
  if (heading)
    throw Error(
      `${name}: release-labelled heading belongs in CHANGELOG or references/: ${heading}`,
    );
}
export async function checkDiscovery(root) {
  const discovery = resolve(root, ".agents/skills");
  const entry = await lstat(discovery);
  if (
    entry.isFile() &&
    (await readFile(discovery, "utf8")).trim() === "../skills"
  )
    throw Error(
      "Windows checkout materialized .agents/skills as text. Enable Windows Developer Mode or symlink permission, run git config core.symlinks true in this repository, then git checkout -- .agents/skills. Until repaired, explicitly read skills/<module>/SKILL.md. No files or Git settings were changed.",
    );
  if (
    !entry.isSymbolicLink() ||
    (await realpath(discovery)) !== (await realpath(resolve(root, "skills")))
  )
    throw Error(
      "Project skill discovery must be a symlink to canonical skills/; inspect .agents/skills without overwriting unrelated files.",
    );
}
