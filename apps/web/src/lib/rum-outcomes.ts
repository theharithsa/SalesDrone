export const RUM_OUTCOMES = { success:'success', failure:'failure', network:'network_error', cancelled:'cancelled' } as const;
export function rumOutcome(value: string) {
  if(value==='response_ok') return RUM_OUTCOMES.success;
  if(value==='response_error'||value==='error') return RUM_OUTCOMES.failure;
  return Object.values(RUM_OUTCOMES).includes(value as typeof RUM_OUTCOMES[keyof typeof RUM_OUTCOMES]) ? value : 'other';
}
export function httpStatusClass(status?: number) {
  return status && status>=100&&status<600 ? Math.floor(status/100)+'xx' : 'network';
}
