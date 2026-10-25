import protobuf from 'protobufjs';
const response = protobuf
  .parse(
    'syntax="proto3";message Partial{int64 rejected=1;string error=2;}message Result{Partial partial=1;}',
  )
  .root.lookupType('Result');
export function otlpReceipt(signal, status, bytes) {
  let rejected = 0,
    error = false;
  if (status === 200 && bytes.length) {
    try {
      const p = response.decode(bytes).partial;
      rejected = Number(p?.rejected || 0);
      error = !!p?.error;
    } catch {
      rejected = -1;
      error = true;
    }
  }
  return { signal, status, rejected, error };
}
export function assertDeploymentReceipts(receipts) {
  for (const signal of ['traces', 'logs', 'metrics']) {
    const values = receipts.signals?.filter((r) => r.signal === signal);
    if (
      !values?.length ||
      values.some((r) => r.status !== 200 || r.rejected !== 0 || r.error)
    )
      throw Error('Dynatrace did not fully accept ' + signal);
  }
  if (
    receipts.bizEventStatus !== 202 ||
    ![200, 201].includes(receipts.deploymentMarkerStatus) ||
    !receipts.markerResults?.length ||
    receipts.markerResults.some((r) => r.status !== 'OK')
  )
    throw Error('Dynatrace did not fully accept deployment events');
}
