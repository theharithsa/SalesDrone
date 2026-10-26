export const attachmentBucket = 'sales-drone-avinya.firebasestorage.app';
export function storageDeployment(raw, deploymentOutcome = 'unknown') {
  const name = String(raw?.name || raw?.storage_url || '')
    .replace(/^gs:\/\//, '')
    .replace(/\/$/, '');
  return {
    bucket: attachmentBucket,
    state: name === attachmentBucket ? 'verified' : 'unverified',
    deploymentOutcome,
    ...(raw
      ? {
          location: raw.location,
          publicAccessPrevention:
            raw.public_access_prevention ||
            raw.publicAccessPrevention ||
            raw.iam_configuration?.public_access_prevention ||
            raw.iamConfiguration?.publicAccessPrevention,
        }
      : {}),
  };
}
