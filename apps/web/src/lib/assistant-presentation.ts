type Answer = {
  text?: string;
  state?: string;
  count?: number;
  groups?: Record<string, number>;
  coverage?: { cohort?: string; window?: unknown; filters?: unknown[]; filterSummary?: string[] };
};

// Presentation only: recognize exact server-produced count sentences, never infer
// stage meanings or replace partial/setup responses. All scope checks stay server-owned.
export function presentAssistantAnswer(parts: (Answer | undefined)[]) {
  const classify = (part: Answer | undefined) => {
    if (!part || part.state !== 'Grounded' || !Number.isSafeInteger(part.count) || part.count! < 0 || Object.keys(part.groups || {}).length) return null;
    const count = part.count!;
    if (part.text === `${count} matching active leads.`) return { kind:'total', count };
    if (part.text === `${count} matching leads currently in configured converted/closed stages. This is current stage status, not a claim about who closed them or when.`) return { kind:'closed', count };
    return null;
  };
  const kinds = parts.map(classify);
  const details = parts.map((part,index) => kinds[index] ? part?.text : undefined);
  const totalIndex=kinds.findIndex(p=>p?.kind==='total'), closedIndex=kinds.findIndex(p=>p?.kind==='closed');
  const unfiltered=(part:Answer|undefined) => !part?.coverage?.window && !part?.coverage?.filters?.length;
  if(parts.length===2 && totalIndex>=0 && closedIndex>=0 && parts.every(unfiltered)
      && !!parts[totalIndex]?.coverage?.cohort && parts[totalIndex]?.coverage?.cohort===parts[closedIndex]?.coverage?.cohort
      && !(parts[totalIndex]?.coverage?.filterSummary?.length)
      && !(parts[closedIndex]?.coverage?.filterSummary || []).some(s=>!s.startsWith('Configured converted stages: '))
      && kinds[closedIndex]!.count<=kinds[totalIndex]!.count) {
    const total=kinds[totalIndex]!.count, closed=kinds[closedIndex]!.count;
    return {text:`You have ${total.toLocaleString()} ${total===1?'lead':'leads'} and ${closed.toLocaleString()} ${closed===1?'is':'are'} closed.`,details};
  }
  return {text:parts.map((part,index)=>{
    const kind=kinds[index];
    if(kind?.kind==='total') return unfiltered(part) && !part?.coverage?.filterSummary?.length ? `You have ${kind.count.toLocaleString()} ${kind.count===1?'lead':'leads'}.` : `I found ${kind.count.toLocaleString()} matching ${kind.count===1?'lead':'leads'}.`;
    if(kind?.kind==='closed') return `${kind.count.toLocaleString()} ${kind.count===1?'lead is':'leads are'} closed.`;
    return part?.text || 'This answer is unavailable. Ask again.';
  }).join('\n\n'),details};
}
