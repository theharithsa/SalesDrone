import sanitizeHtml from 'sanitize-html';
import { convert } from 'html-to-text';

export const MAX_EMAIL_HTML = 48_000;
const MAX_RECEIVED_HTML = 160_000;
const MAX_TEXT = 16_000;

// Preserve email semantics and narrowly bounded inline typography. Resource
// loading, page navigation, forms and application styling are deliberately excluded.
const htmlOptions = {
  allowedTags: ['div','span','p','br','hr','strong','b','em','i','u','s','strike','del',
    'h1','h2','h3','h4','h5','h6','blockquote','pre','code','ul','ol','li','a',
    'table','caption','colgroup','col','thead','tbody','tfoot','tr','th','td','sub','sup'],
  allowedAttributes: {
    '*': ['style','dir','lang'],
    a: ['href','target','rel'],
    th: ['colspan','rowspan','scope'],
    td: ['colspan','rowspan'],
  },
  allowedStyles: {
    '*': {
      'color': [/^#[a-f0-9]{3}(?:[a-f0-9]{3})?$/i, /^(?:black|white|red|blue|green|gray|grey|navy)$/i],
      'background-color': [/^#[a-f0-9]{3}(?:[a-f0-9]{3})?$/i, /^(?:transparent|white|black)$/i],
      'text-align': [/^(left|center|right|start|end)$/],
      'font-size': [/^(?:[89]|[1-3]\d|4[0-8])px$/],
      'font-weight': [/^(?:normal|bold|[1-9]00)$/],
      'font-style': [/^(?:normal|italic)$/],
      'text-decoration': [/^(?:underline|line-through|none)$/],
      'vertical-align': [/^(?:top|middle|bottom|baseline)$/],
    },
  },
  allowedSchemes: ['https','http','mailto'],
  allowProtocolRelative: false,
  nonTextTags: ['script','style','textarea','option','svg','math','iframe','object','template','title'],
  nestingLimit: 25,
  transformTags: {
    a(tagName, attrs) {
      const href = attrs.href?.trim();
      if (!href || !/^(?:https?:\/\/|mailto:)/i.test(href)) return { tagName: 'span', attribs: {} };
      return { tagName, attribs: { href, target: '_blank', rel: 'noopener noreferrer' } };
    },
    img() {
      return { tagName: 'span', text: '[Image blocked]', attribs: {} };
    },
    th: limitTableSpan,
    td: limitTableSpan,
  },
};

function limitTableSpan(tagName, attrs) {
  for (const key of ['rowspan','colspan']) {
    if (attrs[key] && !/^(?:[1-9]|1\d|20)$/.test(attrs[key])) delete attrs[key];
  }
  return { tagName, attribs: attrs };
}

export function prepareEmailHtml(value) {
  if (typeof value !== 'string' || !value.trim()) return { text: '', clipped: false };
  const cleaned = sanitizeHtml(value.slice(0, MAX_RECEIVED_HTML), htmlOptions).trim();
  const text = convert(cleaned, { wordwrap: false, selectors: [
    { selector: 'a', options: { hideLinkHrefIfSameAsText: true } },
  ] }).trim();
  const clipped = value.length > MAX_RECEIVED_HTML || cleaned.length > MAX_EMAIL_HTML || text.length > MAX_TEXT;
  return {
    ...(cleaned && value.length <= MAX_RECEIVED_HTML && cleaned.length <= MAX_EMAIL_HTML ? { html: cleaned } : {}),
    text: text.slice(0, MAX_TEXT),
    clipped,
  };
}

// The version is pinned on queue creation so retries preserve provider payloads.
export function renderRichCorrespondenceV2(body, html) {
  return {
    text: body,
    html: '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<meta name="color-scheme" content="light dark"></head><body style="margin:0;font-family:Open Sans,Arial,sans-serif">' +
      '<div style="max-width:680px;margin:auto;padding:24px;line-height:1.6;overflow-wrap:anywhere">' +
      html + '<div style="border-top:1px solid #b9c3d0;margin-top:24px;padding-top:12px;font-size:13px">' +
      '<img alt="" width="18" height="18" style="vertical-align:middle;margin-right:7px;border:0" src="https://salesdrone.in/brand/salesdrone-mark.png">SalesDrone' +
      '</div></div></body></html>',
  };
}
