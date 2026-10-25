// Every published change must maintain at least one current module playbook.
export function assertSkillUpdate(changedPaths, updatedPaths = changedPaths) {
  if (!changedPaths.length) return;
  if (
    !updatedPaths.some((path) =>
      /^skills\/salesdrone-[a-z0-9-]+\/SKILL\.md$/.test(path),
    )
  )
    throw new Error(
      'Update the affected module SKILL.md before publishing this change. Skill metadata or catalog-only edits do not satisfy the release policy.',
    );
}
