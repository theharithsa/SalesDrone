export function validateSkillTree(tree, skillNames) {
  if (
    tree.schemaVersion !== 1 ||
    !Array.isArray(tree.nodes) ||
    tree.nodes.length !== skillNames.length
  )
    throw Error('Incomplete skill tree');
  const ids = new Set(tree.nodes.map((n) => n.id));
  if (ids.size !== skillNames.length || skillNames.some((n) => !ids.has(n)))
    throw Error('Duplicate or missing skill route');
  for (const n of tree.nodes)
    if (
      n.path !== `skills/${n.id}/SKILL.md` ||
      !n.matchTerms?.length ||
      n.related.some((id) => !ids.has(id))
    )
      throw Error('Invalid skill route');
  if (!ids.has(tree.readinessSkill)) throw Error('Missing readiness root');
}
export function routeSkills(prompt, tree) {
  const text = prompt.toLowerCase();
  return tree.nodes
    .map((n) => ({
      id: n.id,
      path: n.path,
      score: n.matchTerms.reduce(
        (score, t) =>
          score + (text.includes(t.toLowerCase()) ? t.split(' ').length : 0),
        0,
      ),
    }))
    .filter((n) => n.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
