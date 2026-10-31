/** Synthetic adapter for real research components; no API transport or inference. */
const at = "2026-10-31T10:00:00.000Z";
const report = {
  id: "synthetic-report",
  status: "Completed",
  version: 1,
  createdAt: at,
  updatedAt: at,
  scanned: 96,
  findings: 3,
  archiveReviewConfigured: true,
};
const chat = {
  id: "synthetic-chat",
  status: "Active",
  version: 1,
  createdAt: at,
  updatedAt: at,
};
let history = [report],
  chats = [chat];
const findings = [
  {
    id: "synthetic-contact",
    kind: "SharedContact",
    comparison: "Different named enquiries share this contact",
    field: "phone",
    value: "+91 55500 12345",
    count: 2,
    leadIds: ["fictional-one", "fictional-two"],
    leads: [
      {
        id: "fictional-one",
        name: "Alex Morgan",
        company: "Fictional North Supplies",
      },
      {
        id: "fictional-two",
        name: "Jordan Lee",
        company: "Fictional Partner Enquiry",
      },
    ],
  },
  {
    id: "synthetic-review",
    kind: "Review",
    count: 1,
    issues: ["missing_contact", "needs_review"],
    leads: [
      {
        id: "fictional-three",
        name: "Taylor Brooks",
        company: "Fictional Trading",
      },
    ],
  },
  {
    id: "synthetic-archive",
    kind: "Review",
    count: 1,
    issues: ["archive_review"],
    leads: [
      {
        id: "fictional-four",
        name: "Casey Rivera",
        company: "Fictional Materials",
      },
    ],
  },
];
let messages = [
  {
    id: "synthetic-question",
    jobId: chat.id,
    status: "Completed",
    createdAt: at,
    question: "What patterns are reported in failed lead notes?",
    answer: {
      state: "Partial",
      text: "Reported themes in retrieved notes. These are sampled observations, not proven causes or whole-cohort prevalence.",
      coverage: { scanned: 96, asOf: at, timezone: "Asia/Kolkata" },
      themes: [
        {
          label: "Pricing questions remained unresolved",
          evidence: [
            {
              sourceId: "synthetic-source",
              quote: "The buyer requested revised pricing before deciding.",
            },
          ],
        },
      ],
      sources: [
        {
          id: "synthetic-source",
          leadId: "fictional-five",
          name: "Avery Chen",
          text: "The buyer requested revised pricing before deciding.",
        },
      ],
    },
  },
];
export function researchFixture(path: string, method: string, body: any) {
  const key = path.split("?")[0];
  if (key === "/lead-hygiene/scans")
    return method === "POST" ? report : { items: history, nextCursor: null };
  if (key === "/lead-hygiene/scans/" + report.id + "/findings")
    return { items: findings, nextCursor: null };
  if (key === "/lead-hygiene/scans/" + report.id) {
    if (method === "DELETE") {
      history = [];
      return { ok: true };
    }
    return report;
  }
  if (key === "/lead-hygiene/scans/" + report.id + "/summary")
    return {
      ...report,
      version: 2,
      summaryStatus: "Completed",
      summary: {
        themes: [
          {
            label: "Review shared contacts before taking action",
            evidence: [
              {
                sourceId: "synthetic-contact",
                quote: "Two fictional enquiries share one phone number.",
              },
            ],
          },
        ],
      },
    };
  if (key === "/lead-assistant/index")
    return {
      enabled: true,
      canManage:true,
      status: "Queued",
      pending: 0,
      failed: 0,
      note: "Synthetic preview: no provider calls. Current sources are checked before answers.",
    };
  if (key === "/lead-assistant/conversations") {
    if(method==='POST'){messages=[];return chat;}
    return {items:chats,nextCursor:null};
  }
  if(key.startsWith('/lead-assistant/requests/')&&key.endsWith('/leads'))return {items:[
    {id:'fictional-one',name:'Alex Morgan',company:'Fictional North Supplies',stage:'Quoted',detail:'3 Nov 2026'},
    {id:'fictional-two',name:'Jordan Lee',company:'Fictional Partner Enquiry',stage:'Interested',detail:'5 Nov 2026'},
    {id:'fictional-three',name:'Taylor Brooks',company:'Fictional Trading',stage:'Samples sent',detail:'6 Nov 2026'}
  ],nextCursor:null};
  if (key === "/lead-assistant/conversations/" + chat.id + "/messages")
    return { items: messages, nextCursor: null, conversation: chat };
  if (key === "/lead-assistant/conversations/" + chat.id + "/questions") {
    messages = [
      ...messages,
      {
        id: "synthetic-followup-"+messages.length,
        jobId: chat.id,
        status: "Completed",
        createdAt: at,
        question: body.question,
        answer: {
          ...( /call|next week/i.test(body.question)?{state:'Grounded',count:3,hasResults:true,coverage:{cohort:'Your recorded pending outreach reminders',timezone:'Asia/Kolkata',window:{startDate:'2026-11-02',endDate:'2026-11-09'}}}:{}),
          state: "Partial",
          text: /call|next week/i.test(body.question)?"3 matching leads with recorded pending outreach reminders.":"Synthetic preview only. Live questions use scoped analytics and retrieved evidence.",
        },
      } as any,
    ];
    return { id: "synthetic-followup", status: "Completed" };
  }
  if (
    key === "/lead-assistant/conversations/" + chat.id &&
    method === "DELETE"
  ) {
    chats = [];
    messages = [];
    return { ok: true };
  }
  throw Error("Unsupported synthetic research operation");
}
