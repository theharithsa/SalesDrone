import { AppError, STAGES, ImportComment, parse } from './contracts.js';
import { normalizeLead } from './leads.js';
import { DISCUSSION_FIELDS } from './discussions.js';
import { z } from 'zod';
export const IMPORT_CHUNK_SIZE = 11;
export const HEADER_MAP = {
  'Sl No': 'serial',
  'Enq Source': 'source',
  Name: 'name',
  'Customer Name': 'name',
  'Contact No.': 'phone',
  'Company Name': 'company',
  'Location, City': 'location',
  Sector: 'zone',
  'Zone / Sector': 'zone',
  'Enq Date': 'enquiryDate',
  Status: 'legacyStatus',
  'Initial discussion': 'initialDiscussion',
  '1st follow up': 'followUp1',
  '2nd follow up': 'followUp2',
  '3rd follow up': 'followUp3',
  '4th follow up': 'followUp4',
  Comments: 'comments',
};
export function importDate(raw, order) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (/^\d{5}(?:\.\d+)?$/.test(s))
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86400000)
      .toISOString()
      .slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!m)
    throw new AppError(
      400,
      'DATE',
      'Use an ISO date or select a date order for day/month/year dates',
    );
  const [, a, b, y] = m;
  const mo = order === 'DMY' ? b : a,
    day = order === 'DMY' ? a : b;
  return `${y}-${mo.padStart(2, '0')}-${day.padStart(2, '0')}`;
}
export function previewRows(input, allowedStages = STAGES, {stageHidden = false} = {}) {
  return input.rows.map((row, index) => {
    try {
      const r = { ...row };
      const comments = parse(
        z.array(ImportComment).max(40),
        r.importComments === undefined ? [] : r.importComments,
      );
      if (new Set(comments.map((c) => c.sourceIndex)).size !== comments.length)
        throw new AppError(
          400,
          'COMMENT_COLUMN',
          'Select each comment column once',
        );
      comments.sort((a, b) => a.sourceIndex - b.sourceIndex);
      delete r.importComments;
      // Compatibility for existing import clients: historical discussion fields
      // become activities too, rather than copied lead columns.
      for (const [index, [field, label]] of DISCUSSION_FIELDS.entries()) {
        if (r[field] !== undefined && typeof r[field] !== 'string')
          throw new AppError(
            400,
            'CELL',
            'Discussion cells must contain literal text',
          );
        const notes = String(r[field] || '').trim();
        if (notes)
          comments.push({
            sourceColumn: label,
            sourceIndex: 40 + index,
            notes,
          });
        delete r[field];
      }
      if (comments.length > 40)
        throw new AppError(
          400,
          'COMMENT_LIMIT',
          'Use at most 40 comment columns per row',
        );
      for (const comment of comments)
        if (comment.notes.length > 4000)
          throw new AppError(
            400,
            'CELL',
            'Comment cell exceeds 4,000 characters',
          );
      const nonemptyComments = comments.filter((c) => c.notes);

      if (
        !Object.hasOwn(r, 'name') ||
        (!Object.hasOwn(r, 'phone') && !Object.hasOwn(r, 'email'))
      )
        throw new AppError(
          400,
          'MAPPING',
          'Map the Name and Contact No. (or Email) columns before importing',
        );
      if (Object.keys(r).length > 20)
        throw new AppError(400, 'COLUMNS', 'A row has too many mapped columns');
      for (const [_k, v] of Object.entries(r)) {
        if (
          typeof v !== 'string' &&
          typeof v !== 'boolean' &&
          !Array.isArray(v)
        )
          throw new AppError(
            400,
            'CELL',
            'Only literal text values are accepted',
          );
        if (typeof v === 'string' && v.length > 4000)
          throw new AppError(400, 'CELL', 'Cell exceeds 4,000 characters');
      }
      const original = String(r.legacyStatus || '').trim();
      if (
        original && !r.stage && !stageHidden &&
        !allowedStages.includes(original) &&
        !input.statusMap[original]
      )
        throw new AppError(
          400,
          'STATUS',
          `Map the status “${original}” before importing`,
        );
      if (
        !stageHidden && input.statusMap[original] &&
        !allowedStages.includes(input.statusMap[original])
      )
        throw new AppError(
          400,
          'STATUS',
          'Choose an active sales stage for this status',
        );
      if(r.stage && !allowedStages.includes(r.stage))throw new AppError(400,'STATUS','Choose an active sales stage');
      r.stage =
        r.stage || (!stageHidden && input.statusMap[original]) ||
        (!stageHidden && allowedStages.includes(original) ? original : 'New');
      const warnings = [];
      try {
        r.enquiryDate = importDate(r.enquiryDate, input.dateOrder);
      } catch {
        r.originalEnquiryDate = String(r.enquiryDate || '');
        r.enquiryDate = '';
        warnings.push('Enquiry date needs review');
      }
      if (!String(r.name || '').trim()) warnings.push('Name is missing');
      if (!r.enquiryDate) warnings.push('Enquiry date is missing');
      const phone = String(r.phone || '').trim(),
        digits = phone.replace(/[^0-9]/g, '');
      if (
        phone &&
        (!/^\+?[0-9\s().-]+$/.test(phone) ||
          digits.length < 7 ||
          digits.length > 15)
      ) {
        r.originalPhone = phone;
        r.phone = '';
        warnings.push('Contact number needs review');
      }
      if (!r.phone && !r.email)
        warnings.push('Valid contact details are missing');
      if (warnings.length) r.needsReview = true;
      const normalized = normalizeLead(r);
      if (
        Buffer.byteLength(
          JSON.stringify({ row: normalized, comments: nonemptyComments }),
          'utf8',
        ) > 24000
      )
        throw new AppError(
          400,
          'ROW_SIZE',
          'Combined lead details and comments must fit within 24 KB per row',
        );
      return {
        index,
        row: normalized,
        comments: nonemptyComments,
        error: null,
        warnings,
      };
    } catch (e) {
      return { index, row: null, error: e.message };
    }
  });
}
