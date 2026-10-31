// Cloud Run reserves /_ah/* and some paths ending in z. Keep operational health
// outside those provider paths; this is not a new business API.
export const HEALTH_PATH = '/ingress-health';
