# Operational reference

Use the current source and [shared contract](../../SHARED.md) when applying these module-specific recipes. Release dates, prior approvals and screenshot versions are historical evidence in [CHANGELOG](../../../CHANGELOG.md) and [release plans](../../../releases/); they never authorize a new deployment.

Settings audit snapshots are requested immediately before each first tracked write, before memory-adapter mutation and before buffered Firestore flush. Keep snapshot read failures transactional and observe the final net write. Do not move audit/outbox writes outside the transaction or depend on OTel enabled state. Real emulator tests verify the adapter boundary.

## Lead-data reset

Store adapters expose scan(collection,{after,limit}) by document ID and return {id,data}, including records missing an id field. It is an internal bounded cleanup primitive, not a client API. guardLeadData wraps the observable store in index and createApp; reset uses maintenanceStore to bypass only its own lock. Preserve transaction read-before-write buffering and raw document IDs. Cleanup leases/cursors/tombstones are durable; do not delete/reset locks to fix a blocked job.

## Collaborative imports

Reviewed imports add dataset-scoped importBaselines and padded chunk IDs. Deploy import history/chunk/baseline/name indexes and wait for READY. Transactions validate all rows before domain writes and bound comment/write budgets. Lead reset deletes baselines as well as jobs/chunks. Preserve legacy chunk handling. Emulator tests cover concurrent executors and baseline deletion.

