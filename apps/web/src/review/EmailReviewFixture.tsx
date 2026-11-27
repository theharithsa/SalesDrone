import EmailBetaPage, { type EmailThread } from '../features/EmailBetaPage';
import type { ApiClient } from '../lib/api';

const date = '2026-11-27T11:30:00Z';
const lead = { id: 'demo-1', name: 'Ananya Rao' };
const threads: EmailThread[] = [
  {
    id: 'quote', subject: 'Oak finishes for the reception desk', lead,
    correspondent: 'ananya@example.test', preview: 'Could you send both finishes on Friday?',
    updatedAt: date, latestMessageId: 'reply', version: 1, unread: true, canSend: true,
  },
  {
    id: 'delivery', subject: 'Delivery and installation schedule', lead: null,
    correspondent: 'operations@example.test', preview: 'Monday also works for our install team.',
    updatedAt: date, latestMessageId: 'reply', version: 1, unread: false, canSend: true,
  },
];

const request: ApiClient = async (path, method = 'GET') => {
  if (method === 'POST') return { threadId: 'quote' };
  if (method === 'PATCH') return { ok: true };
  if (path.startsWith('/leads?')) return { items: [lead] };
  if (path.startsWith('/email/threads?')) return { items: threads, nextCursor: null };

  const thread = threads.find(item => path === '/email/threads/' + item.id);
  if (!thread) throw new Error('Conversation unavailable');
  return {
    ...thread,
    nextCursor: null,
    messages: [
      {
        id: 'reply', direction: 'inbound', body: thread.preview, createdAt: date,
        html: '<p>' + thread.preview + '</p><table><tr><th>Finish</th><th>Availability</th></tr>' +
          '<tr><td>Oak</td><td>Friday</td></tr></table>',
        state: 'Received', attachments: false, truncated: false,
      },
      {
        id: 'outgoing', direction: 'outbound', body: 'Here are the two finishes we discussed.',
        createdAt: '2026-11-26T10:00:00Z', state: 'Delivered', attachments: false, truncated: false,
      },
    ],
  };
};

export default function EmailReviewFixture() {
  return <main>
    <EmailBetaPage request={request} admin target={{ threadId: 'quote' }}
      onConsumeTarget={() => {}} onOpenLead={() => {}} timezone="Asia/Kolkata" />
  </main>;
}
