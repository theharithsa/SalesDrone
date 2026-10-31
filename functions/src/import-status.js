import { AppError } from './contracts.js';
import { dashboardFields } from './dashboard-grouping.js';

export function importStatusTarget(field, config) {
  if (field === undefined || field === 'none') return null;
  const target = dashboardFields(config).find(f => f.field === field);
  if (!target) throw new AppError(400, 'STATUS_FIELD', 'Choose an available status mapping field');
  return target;
}
/** New clients choose a target explicitly; omitted fields retain legacy stage mapping. */
export function applyImportStatus(row, input, config) {
  const field = input.statusField;
  if (field === undefined) return { row, legacyStageMapping: true };
  if(row.legacyStatus!==undefined && typeof row.legacyStatus!=='string')throw new AppError(400,'CELL','Status cells must contain literal text');
  const target = importStatusTarget(field, config);
  const original = String(row.legacyStatus || '').trim();
  if (!target || !original) return { row, legacyStageMapping: false };
  const mapped = Object.hasOwn(input.statusMap, original) ? input.statusMap[original] : undefined;
  const definition = config.customFields.find(f => f.id === field);
  const freeText = field === 'legacyStatus' || definition?.type === 'text' || !target.order?.length;
  const value = mapped || (freeText || target.order.includes(original) ? original : '');
  if (!value || (!freeText && !target.order.includes(value)))
    throw new AppError(400, 'STATUS_MAP', 'Choose a configured value for every status or keep the original Enquiry status text');
  if (field !== 'legacyStatus' && String(row[field] || '').trim())
    throw new AppError(400, 'STATUS_COLUMN', 'The status target already has a mapped column. Unmap that column or choose another target');
  return { row: { ...row, [field]: value }, legacyStageMapping: false };
}
