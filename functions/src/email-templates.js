export const EMAIL_FROM = 'SalesDrone <notifications@salesdrone.in>';
export const TEMPLATE_VERSION = 2;
export const templateInfo = {
  invitation: ['Workspace', 'You’re invited to SalesDrone', 'A workspace admin invited you to SalesDrone. Sign in with the Google account that received this invitation.', 'Accept invitation'],
  access_ready: ['Workspace', 'Your SalesDrone access is ready', 'A workspace admin approved your access. Sign in to get started.', 'Open SalesDrone'],
  lead_assigned: ['Lead update', 'A lead was assigned to you', 'Open SalesDrone to review the assigned lead and choose your next step.', 'View lead'],
  lead_converted: ['Lead update', 'A lead converted', 'A lead moved into a stage your workspace uses for conversions.', 'View lead'],
  lead_failed: ['Lead update', 'A lead reached a failed stage', 'A lead moved into a stage your workspace uses for failed outcomes.', 'View lead'],
  task_assigned: ['Task update', 'A task was assigned to you', 'A teammate assigned you a shared lead task.', 'View task'],
  task_completed: ['Task update', 'A teammate completed your task', 'The shared task is marked complete in SalesDrone.', 'View task'],
  task_rescheduled: ['Task update', 'A teammate rescheduled your task', 'Open the task to see the current deadline and the reason for the change.', 'View task'],
  task_reopened: ['Task update', 'A teammate reopened your task', 'The shared task is back on your list.', 'View task'],
  daily: ['Daily briefing', 'Today in SalesDrone', 'Your lead tasks that need attention today.', 'Open my tasks'],
  weekly: ['Weekly recap', 'Your week in SalesDrone', 'A recap of your completed lead work and what’s coming up.', 'Review my week'],
  test: ['Delivery test', 'SalesDrone email check', 'This message checks delivery from SalesDrone with synthetic data.', 'Open SalesDrone'],
};
const escape = value => String(value).replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
// Resolve the Astryx Neutral roles to inline sRGB values for mail clients.
// SalesDrone uses Open Sans and its brand blue in its public Astryx theme.
const theme = {
  canvas: '#f4f4f5', surface: '#ffffff', text: '#18181b', muted: '#52525b', border: '#e4e4e7',
  accent: '#0756a4', info: '#eff6ff', infoBorder: '#c7ddf7',
  darkCanvas: '#15171b', darkSurface: '#1e2127', darkText: '#f1f2f4', darkMuted: '#c0c4cd',
  darkBorder: '#3b414c', darkInfo: '#263a51', darkAccent: '#b4d5ff',
};
const fontFamily = 'Open Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
const fontPath = '/fonts/open-sans/open-sans-latin.woff2';
const markPath = '/brand/salesdrone-mark.png';
const section = body => '<tr><td class="pad" style="padding:0 24px 16px">' + body + '</td></tr>';
const dateLabel = date => new Intl.DateTimeFormat('en-IN', {
  timeZone: 'UTC', day: 'numeric', month: 'short',
}).format(new Date(date + 'T00:00:00Z'));

export function renderEmail({ template, origin, preprod = false, preview = false, leadId, taskId, facts, insight }) {
  const [category, title, intro, action] = templateInfo[template];
  const settings = new URL('/settings?section=email-preferences', origin).href;
  // The sandboxed srcdoc preview can load only the current site's public assets.
  const font = preview ? fontPath : new URL(fontPath, origin).href;
  const mark = preview ? markPath : new URL(markPath, origin).href;
  let href = new URL('/', origin);
  if (['daily', 'weekly'].includes(template)) href = new URL('/tasks', origin);
  if (template === 'weekly' && facts) {
    href.searchParams.set('status', 'Completed');
    href.searchParams.set('from', facts.from);
    href.searchParams.set('until', facts.until);
    href.searchParams.set('tz', facts.timezone);
  }
  if (leadId && template.startsWith('lead_')) href = new URL('/leads/' + encodeURIComponent(leadId), origin);
  if (taskId && template.startsWith('task_')) {
    href = new URL('/tasks', origin);
    href.searchParams.set('task', taskId);
  }
  const subject = (preprod ? '[Pre-prod] ' : '') + title;
  const content = facts && ['daily', 'weekly'].includes(template) ? digestCopy(template, facts) : null;
  const period = template === 'weekly' && facts
    ? dateLabel(facts.from) + ' – ' + dateLabel(new Date(Date.parse(facts.until + 'T00:00:00Z') - 86_400_000).toISOString().slice(0, 10))
    : template === 'daily' && facts ? dateLabel(facts.date) : '';
  const heading = template === 'weekly' ? 'Weekly insight' : 'Today’s priority';
  const allInsights = content?.insights || {};
  const takeaway = allInsights[insight] || Object.values(allInsights)[0];
  const supporting = (content?.details || []).filter(value => value !== takeaway && !takeaway?.startsWith(value));
  const text = [
    'SalesDrone', title, intro, period,
    ...(content?.stats || []).map(([count, label]) => label + ': ' + count),
    ...(takeaway ? [heading, takeaway] : []), ...supporting,
    action + ': ' + href.href,
    'Manage email preferences: ' + settings,
  ].filter(Boolean).join('\n\n');
  const statCells = (content?.stats || []).map(([count, label]) =>
    '<td class="metric" width="' + Math.floor(100 / content.stats.length) + '%" valign="top" style="padding:12px 6px;text-align:center">' +
    '<strong style="display:block;font-size:24px;line-height:32px;font-weight:600">' + count + '</strong>' +
    '<span class="muted" style="font-size:12px;line-height:16px;color:' + theme.muted + '">' + escape(label) + '</span></td>').join('');
  const actionStyle = 'display:inline-block;padding:12px 16px;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;line-height:20px';
  const actionLabel = preview
    ? '<span class="action-label" style="' + actionStyle + '">' + escape(action) + '</span>'
    : '<a class="action-label" href="' + escape(href.href) + '" style="' + actionStyle + '">' + escape(action) + '</a>';
  const cta = '<table role="presentation" cellspacing="0" cellpadding="0"><tr><td class="action" bgcolor="' + theme.accent + '" style="border-radius:10px">' +
    actionLabel + '</td></tr></table>';
  const masthead = '<tr><td class="pad masthead" style="padding:16px 24px;border-bottom:1px solid ' + theme.border + '">' +
    '<table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
    '<td width="32" height="32" valign="middle" bgcolor="' + theme.info + '" style="border-radius:6px">' +
    '<img src="' + escape(mark) + '" alt="" width="32" height="32" style="display:block;border:0" referrerpolicy="no-referrer"></td>' +
    '<td valign="middle" style="padding-left:12px;font-size:17px;line-height:24px;font-weight:600">SalesDrone</td>' +
    '</tr></table></td></tr>';
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><meta name="referrer" content="no-referrer">' +
    '<title>' + escape(subject) + '</title><style>' +
    '@font-face{font-family:Open Sans;src:url("' + escape(font) + '") format("woff2");font-weight:300 800;font-style:normal;font-display:swap}' +
    '@media(max-width:420px){.gutter{padding:12px 8px!important}.pad{padding-left:16px!important;padding-right:16px!important}}' +
    '@media(prefers-color-scheme:dark){.outer{background:' + theme.darkCanvas + '!important}.paper{background:' + theme.darkSurface +
    '!important;color:' + theme.darkText + '!important}.muted{color:' + theme.darkMuted + '!important}.paper,.masthead,.footer,.stats,.insight{border-color:' + theme.darkBorder +
    '!important}.stats{background:' + theme.darkCanvas + '!important}.insight{background:' + theme.darkInfo + '!important}.footer a{color:' + theme.darkAccent +
    '!important}.action{background:' + theme.darkAccent + '!important}.action-label{color:' + theme.darkCanvas + '!important}}' +
    '</style><!--[if mso]><style>body,table,td,h1,h2,p,a,span{font-family:Segoe UI,Arial,sans-serif!important}</style><![endif]-->' +
    '</head><body style="margin:0;background:' + theme.canvas + ';font-family:' + fontFamily + '">' +
    '<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">' + escape(intro) + '</div>' +
    '<table class="outer" role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="' + theme.canvas + '"><tr>' +
    '<td class="gutter" align="center" style="padding:24px 12px">' +
    '<!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->' +
    '<table class="paper" role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="' + theme.surface + '" style="max-width:600px;border:1px solid ' +
    theme.border + ';border-radius:12px;color:' + theme.text + ';font:16px/24px ' + fontFamily + '">' + masthead +
    '<tr><td class="pad" style="padding:20px 24px 16px"><p class="muted" style="margin:0 0 4px;color:' + theme.muted + ';font-size:12px;font-weight:600;line-height:20px">' + escape(category) +
    (period ? ' · ' + escape(period) : '') + '</p><h1 style="margin:0 0 8px;font-size:24px;line-height:32px;font-weight:600">' + escape(title) +
    '</h1><p class="muted" style="margin:0;color:' + theme.muted + '">' + escape(intro) + '</p></td></tr>' +
    (statCells ? section('<table class="stats" role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="' + theme.canvas +
    '" style="border:1px solid ' + theme.border + ';border-radius:10px"><tr>' + statCells + '</tr></table>') : '') +
    (takeaway ? section('<table class="insight" role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="' + theme.info +
    '" style="border:1px solid ' + theme.infoBorder + ';border-radius:10px">' +
    '<tr><td style="padding:12px 16px"><h2 style="font-size:17px;line-height:24px;font-weight:600;margin:0 0 4px">' +
    heading + '</h2><p style="margin:0;font-size:14px;line-height:20px">' + escape(takeaway) + '</p>' +
    supporting.map(value => '<p class="muted" style="margin:4px 0 0;color:' + theme.muted + ';font-size:14px;line-height:20px">' + escape(value) + '</p>').join('') +
    '</td></tr></table>') : '') +
    section(cta) +
    '<tr><td class="pad footer muted" style="border-top:1px solid ' + theme.border + ';padding:12px 24px;font-size:12px;line-height:20px;color:' + theme.muted + '">' +
    (preview ? 'Synthetic template preview' : '<a href="' + escape(settings) + '" style="color:' + theme.accent + '">Manage email preferences</a>') +
    '</td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>';
  return { subject, html, text };
}

export function templatePreview(template, origin) {
  return renderEmail({ template, origin, preview: true, facts: sampleDigest[template] });
}

export function digestCopy(type, facts) {
  const formatDeadline = value => new Intl.DateTimeFormat('en-IN', {
    timeZone: facts.timezone, weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(new Date(value));
  if (type === 'daily') {
    const next = facts.nextDeadline ? 'Next deadline: ' + formatDeadline(facts.nextDeadline) + '.' : null;
    const oldest = facts.oldestOverdueHours === null ? null :
      facts.oldestOverdueHours < 1 ? 'The oldest overdue task is less than an hour late.' :
      facts.oldestOverdueHours < 24 ? 'The oldest overdue task is ' + facts.oldestOverdueHours + ' hours late.' :
      'The oldest overdue task is ' + Math.floor(facts.oldestOverdueHours / 24) + ' days late.';
    return {
      stats: [[facts.dueToday, 'Due today'], [facts.overdue, 'Overdue']],
      insights: {
        priority: facts.overdue ? 'Start with overdue tasks, then check what’s due today.' :
          'Start with the next deadline and work through today’s tasks in due-time order.',
        ...(oldest ? { backlog: oldest + ' Review your oldest open work first.' } : {}),
        ...(next ? { deadline: next + ' Plan a block for today’s follow-ups.' } : {}),
      },
      details: [next, oldest].filter(Boolean),
    };
  }
  const delta = facts.completed - facts.priorWeek;
  const comparison = delta === 0
    ? 'You completed the same number of tasks as the prior week.'
    : 'You completed ' + Math.abs(delta) + (delta > 0 ? ' more' : ' fewer') + ' than the prior week.';
  const onTime = facts.onTime === null ? null :
    facts.onTime + ' of ' + facts.completed + ' were completed by the recorded deadline.';
  const upcoming = facts.nextDeadline ? 'Next deadline: ' + formatDeadline(facts.nextDeadline) + '.' : null;
  return {
    stats: [[facts.completed, 'Completed'], [facts.leads, 'Leads covered'], [facts.upcoming, 'Due in 7 days']],
    insights: {
      progress: comparison,
      ...(onTime ? { timing: onTime } : {}),
      ...(upcoming ? { upcoming: upcoming + ' Make time for your next round of follow-ups.' } : {}),
    },
    details: [comparison, onTime, upcoming].filter(Boolean),
  };
}

export const sampleDigest = {
  daily: { date: '2026-11-25', timezone: 'Asia/Kolkata', dueToday: 4, overdue: 2,
    nextDeadline: '2026-11-25T06:30:00.000Z', oldestOverdueHours: 49 },
  weekly: { from: '2026-11-16', until: '2026-11-23', timezone: 'Asia/Kolkata', completed: 7, leads: 5,
    priorWeek: 4, onTime: 6, upcoming: 3, nextDeadline: '2026-11-25T08:30:00.000Z' },
};
