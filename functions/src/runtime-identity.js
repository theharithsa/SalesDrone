export const productionRuntime = Object.freeze({
  project: 'sales-drone-avinya',
  accountId: 'salesdrone-production-runtime',
  email: 'salesdrone-production-runtime@sales-drone-avinya.iam.gserviceaccount.com',
  database: '(default)',
  bucket: 'sales-drone-avinya.firebasestorage.app',
});

export const productionFunctions = Object.freeze([
  'api', 'reminders', 'analyzeNotes', 'leadIntelligence', 'exportTelemetry',
]);
