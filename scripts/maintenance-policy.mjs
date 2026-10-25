export function authorizeMaintenance(record, { version, baseCommit }) {
  if (
    !record ||
    record.version !== version ||
    record.baseCommit !== baseCommit ||
    record.authorizedByUser !== true ||
    !/^\d{4}-\d{2}-\d{2}$/.test(record.date) ||
    typeof record.instruction !== 'string' ||
    record.instruction.trim().length < 15 ||
    typeof record.reason !== 'string' ||
    record.reason.trim().length < 15
  )
    throw Error(
      'Same-version maintenance requires an explicit user instruction and exact base commit.',
    );
  return true;
}
