export const EMAIL_FROM = 'SalesDrone <notifications@salesdrone.in>';
export const TEMPLATE_VERSION = 1;
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
const section = body => '<tr><td class="pad" style="padding:0 28px 18px">' + body + '</td></tr>';
const dateLabel = date => new Intl.DateTimeFormat('en-IN', {
  timeZone: 'UTC', day: 'numeric', month: 'short',
}).format(new Date(date + 'T00:00:00Z'));

export function renderEmail({ template, origin, preprod = false, preview = false, leadId, taskId, facts, insight }) {
  const [category, title, intro, action] = templateInfo[template];
  const settings = new URL('/settings?section=email-preferences', origin).href;
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
    '<td width="' + Math.floor(100 / content.stats.length) + '%" valign="top" style="padding:14px 8px;text-align:center;color:#19354e">' +
    '<strong style="display:block;font-size:23px;line-height:1.2">' + count + '</strong>' +
    '<span style="font-size:13px;line-height:1.35">' + escape(label) + '</span></td>').join('');
  const cta = '<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:2px"><tr><td bgcolor="#0756a4" style="border-radius:7px">' +
      '<a class="cta" href="' + escape(href.href) + '" style="display:inline-block;padding:13px 19px;color:#fff;text-decoration:none;font-weight:bold">' +
      escape(action) + '</a></td></tr></table>';
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">' +
    '<title>' + escape(subject) + '</title><style>' +
    '@media(max-width:420px){.pad{padding-left:17px!important;padding-right:17px!important}.email-title{font-size:27px!important}}' +
    '@media(prefers-color-scheme:dark){.outer{background:#101d2b!important}.paper{background:#17283c!important;color:#eef5fc!important}' +
    '.paper h1,.paper h2,.paper p,.paper strong,.paper span{color:#eef5fc!important}.muted{color:#c4d9ee!important}.stats,.insight{background:#243c54!important}.footer a{color:#b5d8fe!important}}' +
    '</style></head><body style="margin:0;color:#14283e;background:#edf2f7;font:16px/1.55 Arial,Helvetica,sans-serif">' +
    '<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">' + escape(intro) + '</div>' +
    '<table class="outer" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#edf2f7"><tr><td align="center" style="padding:20px 10px">' +
    '<!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->' +
    '<table class="paper" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #d5e0eb;border-radius:12px">' +
    '<tr><td class="pad" bgcolor="#093867" style="padding:14px 28px;color:#fff;font-size:17px;font-weight:bold;border-radius:11px 11px 0 0">SalesDrone</td></tr>' +
    '<tr><td class="pad" style="padding:25px 28px 14px"><p style="margin:0 0 7px;color:#0756a4;font-size:13px;font-weight:bold;letter-spacing:.6px">' + escape(category) +
    (period ? ' · ' + escape(period) : '') + '</p><h1 class="email-title" style="margin:0 0 10px;font-size:33px;line-height:1.15">' + escape(title) +
    '</h1><p class="muted" style="margin:0;color:#40556d">' + escape(intro) + '</p></td></tr>' +
    (statCells ? section('<table class="stats" role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#eff5fb" style="border-radius:8px"><tr>' + statCells + '</tr></table>') : '') +
    (takeaway ? section('<table class="insight" role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#edf5ff" style="border-left:3px solid #437db5;border-radius:6px">' +
    '<tr><td style="padding:12px 15px"><h2 style="font-size:16px;line-height:1.4;margin:0 0 4px">' +
    heading + '</h2><p style="margin:0">' + escape(takeaway) + '</p>' +
    supporting.map(value => '<p class="muted" style="margin:5px 0 0;color:#40556d;font-size:14px">' + escape(value) + '</p>').join('') +
    '</td></tr></table>') : '') +
    section(preview ? '<span style="display:inline-block;padding:13px 19px;background:#0756a4;color:#fff;border-radius:7px;font-weight:bold">' + escape(action) + '</span>' : cta) +
    '<tr><td class="pad footer" style="border-top:1px solid #d5e0eb;padding:13px 28px;font-size:13px;color:#40556d">' +
    (preview ? 'Synthetic template preview' : '<a href="' + escape(settings) + '" style="color:#0756a4">Manage email preferences</a>') +
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
