import { Lead, Task, dateOnly, stages } from './types';
const contacts = [
  ['Ananya Rao', 'Northstar Studios', 'Bengaluru', 'Website', 'Qualified'],
  ['Rohan Mehta', 'Fieldwork Collective', 'Mumbai', 'Referral', 'Working'],
  ['Priya Nair', 'Cedar & Co.', 'Kochi', 'Exhibition', 'Meeting booked'],
  ['Arjun Shah', 'Orbit Works', 'Pune', 'Direct enquiry', 'New'],
  ['Kavya Iyer', 'Morrow Spaces', 'Chennai', 'Website', 'Working'],
  ['Vikram Desai', 'Fern Industries', 'Ahmedabad', 'Referral', 'Nurture'],
  ['Neha Kapoor', 'Common Ground', 'Delhi', 'Website', 'New'],
  ['Aditya Sen', 'Studio Horizon', 'Kolkata', 'Exhibition', 'Qualified'],
  ['Ishita Joshi', 'Canvas Partners', 'Hyderabad', 'Direct enquiry', 'New'],
  ['Dev Malhotra', 'Openfield Labs', 'Gurugram', 'Referral', 'Working'],
  [
    'Meera Pillai',
    'June Interiors',
    'Thiruvananthapuram',
    'Website',
    'Nurture',
  ],
  ['Siddharth Jain', 'Summit Systems', 'Jaipur', 'Exhibition', 'New'],
];
export function demoData() {
  const leads = contacts.map(
    ([name, company, location, source, stage], i) =>
      ({
        id: 'demo-' + i,
        name,
        company,
        location,
        source,
        stage,
        phone: `+1 202 555 ${String(100 + i).padStart(4, '0')}`,
        email: name.toLowerCase().replace(' ', '.') + '@example.com',
        enquiryDate: dateOnly(),
        zone: 'South',
        comments:
          'Synthetic sample enquiry. This is a fictional contact for exploring SalesDrone.',
        assignedToUid: 'demo',
        version: 1,
        createdAt: new Date(Date.now() - i * 3600000).toISOString(),
        doNotContact: false,
        needsReview: false,
        archived: false,
        lastCallOutcome: i % 3 ? 'Connected' : null,
        countryCode: '+1',
        legacyStatus: '',
        serial: String(i + 1),
        tags: [],
      }) as Lead,
  );
  const tasks = [
    ['Send the product overview', 0, -2],
    ['Follow up on the proposal', 1, 1],
    ['Confirm the discovery meeting', 2, 3],
    ['Make an introductory call', 3, 5],
    ['Share the revised estimate', 4, 25],
  ].map(
    ([title, index, offset], i) =>
      ({
        id: 'task-' + i,
        title,
        leadId: leads[Number(index)].id,
        dueAt: new Date(Date.now() + Number(offset) * 3600000).toISOString(),
        state: 'Pending',
        version: 1,
        timezone: 'Asia/Kolkata',
        kind: 'outreach',
      }) as Task,
  );
  return {
    leads,
    tasks,
    activities: leads.slice(0, 4).map((l, i) => ({
      id: 'activity-' + i,
      leadId: l.id,
      type: 'call',
      outcome: i % 2 ? 'Connected' : 'No answer',
      notes:
        i % 2
          ? 'Shared an overview. Follow up with more details.'
          : 'Try again later in the day.',
      createdAt: new Date(Date.now() - i * 3600000).toISOString(),
      revision: 1,
    })),
    notifications: [
      {
        id: 'demo-assignment',
        kind: 'lead_assigned',
        leadId: leads[0].id,
        taskId: null,
        title: 'A lead was assigned to you',
        body: 'Open the lead to review the details and plan your next step.',
        createdAt: new Date().toISOString(),
        readAt: null,
      },
    ],
    members: [],
    devices: [],
    invitations: [],
  };
}
export function demoSummary(leads: Lead[], tasks: Task[], activities: any[]) {
  return {
    total: leads.length,
    newLeads: leads.filter((l) => l.stage === stages[0]).length,
    due: tasks.filter(
      (t) => t.state === 'Pending' && t.dueAt <= new Date().toISOString(),
    ).length,
    calls: activities.filter((a) => a.type === 'call').length,
    connected: activities.filter((a) => a.outcome === 'Connected').length,
    period: 'Sample activity',
  };
}
