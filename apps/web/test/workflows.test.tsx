import DashboardPage from '../src/features/DashboardPage';
import LeadScore from '../src/components/LeadScore';
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LeadBlade from "../src/components/LeadBlade";
import LeadFilters from "../src/components/LeadFilters";
import MobileLeadFilters from "../src/components/MobileLeadFilters";
import LeadBatchEditor from "../src/features/LeadBatchEditor";
import ImportPage from "../src/features/ImportPage";
import { defaultFieldOptions as config } from "../src/lib/field-options";
import type { Lead } from "../src/lib/types";
const lead = {
  id: "synthetic-a",
  name: "Synthetic contact",
  company: "Example",
  phone: "12025550100",
  email: "",
  stage: "New",
  version: 3,
  source: "Website",
  enquiryDate: "2026-10-30",
  location: "",
  zone: "",
  comments: "",
  assignedToUid: null,
  createdAt: "2026-10-30",
  doNotContact: false,
  needsReview: false,
} satisfies Lead;
describe('lead score evidence values', () => {
  it('omits points for unknown factors and shows unknown component totals', async () => {
    const request = vi.fn().mockResolvedValue({status:'Ready',score:null,fit:0,intent:0,penalty:0,knownFactors:0,totalFactors:1,factors:[{id:'unknown',label:'Synthetic unknown factor',state:'unknown',points:0}]});
    const {container} = render(<LeadScore leadId="synthetic" version={1} request={request} canRefresh={false} timezone="UTC" />);
    await screen.findByText('Synthetic unknown factor');
    expect(screen.getByText('Not recorded')).toBeInTheDocument();
    expect(container.querySelector('.score-factor-heading')?.textContent).toBe('Synthetic unknown factor');
    expect(container.querySelector('.score-factor-heading b')).toBeNull();
    expect([...container.querySelectorAll('.score-components b')].map(e=>e.textContent)).toEqual(['—','—','—']);
  });
  it('retains reported zero and positive points without negative-zero risk', async () => {
    const request = vi.fn().mockResolvedValue({status:'Ready',score:0,fit:0,intent:0,penalty:0,factors:[{id:'known-zero',label:'Synthetic zero factor',state:'not_met',points:0},{id:'known-positive',label:'Synthetic positive factor',state:'present',points:4}]});
    const {container} = render(<LeadScore leadId="synthetic" version={1} request={request} canRefresh={false} timezone="UTC" />);
    await screen.findByText('Synthetic zero factor');
    expect([...container.querySelectorAll('.score-factor-heading b')].map(e=>e.textContent)).toEqual(['0','+4']);
    expect([...container.querySelectorAll('.score-components b')].map(e=>e.textContent)).toEqual(['0','0','0']);
  });
});
describe("lead inspector", () => {
  it("supports expand, Escape and focus restoration on close", async () => {
    const user = userEvent.setup(),
      close = vi.fn(),
      expand = vi.fn();
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const { unmount } = render(
      <LeadBlade
        onClose={close}
        onExpand={expand}
        toolbar={<span>Actions</span>}
        identity={<h2>Synthetic</h2>}
        workflow={<span>New</span>}
      >
        <p>History</p>
      </LeadBlade>,
    );
    expect(
      screen.getByRole("complementary", { name: "Lead details" }),
    ).toHaveFocus();
    await user.click(
      screen.getByRole("button", { name: "Open full lead page" }),
    );
    expect(expand).toHaveBeenCalledOnce();
    await user.keyboard("{Escape}");
    expect(close).toHaveBeenCalledOnce();
    unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });
  it("does not close a full-page lead on Escape", async () => {
    const close = vi.fn();
    render(
      <LeadBlade
        fullPage
        onClose={close}
        onExpand={vi.fn()}
        toolbar={null}
        identity={null}
        workflow={null}
      >
        History
      </LeadBlade>,
    );
    await userEvent.keyboard("{Escape}");
    expect(close).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Open full lead page" }),
    ).not.toBeInTheDocument();
  });
});
describe("lead filters", () => {
  it("keeps desktop draft changes private until Apply", async () => {
    const user = userEvent.setup(),
      apply = vi.fn();
    render(<LeadFilters applied={[]} onApply={apply} />);
    await user.click(screen.getByRole("button", { name: /Filter any column/ }));
    await user.click(screen.getByRole("button", { name: /Add condition/ }));
    await user.type(screen.getByLabelText("Filter 1 value"), "Example");
    expect(apply).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /Apply/ }));
    expect(apply).toHaveBeenCalledWith([
      { field: "source", op: "contains", value: "Example" },
    ]);
  });
  it("cancels mobile drafts, restores focus and applies Reset only on confirmation", async () => {
    const user = userEvent.setup(),
      apply = vi.fn(),
      applied = { searchField: "name", stage: "New", source: "", filters: [] };
    render(
      <MobileLeadFilters
        config={config}
        sources={["Website"]}
        applied={applied}
        onApply={apply}
      />,
    );
    const trigger = screen.getByRole("button", {
      name: "Filter leads, 1 active",
    });
    await user.click(trigger);
    await user.selectOptions(screen.getByLabelText("Filter stage"), "Won");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(apply).not.toHaveBeenCalled();
    await waitFor(() => expect(trigger).toHaveFocus());
    await user.click(trigger);
    expect(screen.getByLabelText("Filter stage")).toHaveValue("New");
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(apply).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(apply).toHaveBeenCalledWith({ ...applied, stage: "" });
  });
});
describe("batch editor", () => {
  it("requires reviewed changes and invalidates review when the edit changes", async () => {
    const user = userEvent.setup();
    const request = vi.fn(async () => ({
      count: 1,
      changedCount: 1,
      items: [
        {
          id: lead.id,
          name: lead.name,
          changed: true,
          before: { stage: "New" },
          after: { stage: "Won" },
        },
      ],
    }));
    render(
      <LeadBatchEditor
        leads={[lead]}
        config={config}
        scores={{}}
        selectedId={null}
        onSelect={vi.fn()}
        request={request}
        onDone={vi.fn()}
        canEdit
        canAssign={false}
      />,
    );
    await user.click(screen.getByLabelText("Select loaded leads"));
    await user.click(screen.getByRole("button", { name: "Batch edit" }));
    const dialog = screen.getByRole("dialog");
    const apply = within(dialog).getByRole("button", {
      name: "Apply reviewed changes",
    });
    expect(apply).toBeDisabled();
    await user.selectOptions(
      within(dialog).getByLabelText("New Sales stage"),
      "Won",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Preview changes" }),
    );
    await waitFor(() => expect(apply).toBeEnabled());
    expect(request).toHaveBeenCalledWith("/leads/batch/preview", "POST", {
      items: [{ id: lead.id, expectedVersion: 3 }],
      changes: { stage: "Won" },
    });
    await user.selectOptions(
      within(dialog).getByLabelText("New Sales stage"),
      "Working",
    );
    expect(apply).toBeDisabled();
  });
});
describe("import mapping", () => {
  it("maps CSV columns and requires validation before committing", async () => {
    const user = userEvent.setup(),
      request = vi.fn(async (path: string) =>
        path === "/imports/preview"
          ? {
              id: "synthetic-job",
              formatVersion: 3,
              status: "Preview",
              total: 1,
              offset: 0,
              reviewOffset: 0,
              filename: "synthetic.csv",
              items: [],
            }
          : { items: [], nextCursor: null },
      );
    render(<ImportPage demo={false} request={request} onImported={vi.fn()} />);
    const file = new File(
      [
        "Customer name,Phone number,Email\nSynthetic,12025550100,synthetic@example.test",
      ],
      "synthetic.csv",
      { type: "text/csv" },
    );
    Object.defineProperty(file, "text", {
      value: async () =>
        "Customer name,Phone number,Email\nSynthetic,12025550100,synthetic@example.test",
    });
    await user.upload(screen.getByLabelText("Choose a workbook"), file);
    expect(
      await screen.findByRole("heading", { name: "Match your columns" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Customer name")).toHaveValue("0");
    await user.selectOptions(
      screen.getByLabelText("When records already exist"),
      "update",
    );
    await user.click(screen.getByRole("button", { name: /Validate records/ }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        "/imports/preview",
        "POST",
        expect.objectContaining({ duplicateMode: "update" }),
        expect.any(String),
      ),
    );
    expect(request.mock.calls.some(([path]) => path.includes("/commit"))).toBe(
      false,
    );
  });
  it("prevents workbook input for read-only collaborators", () => {
    render(
      <ImportPage
        demo={false}
        canWrite={false}
        request={vi.fn(async () => ({ items: [] }))}
        onImported={vi.fn()}
      />,
    );
    expect(
      screen.queryByLabelText("Choose a workbook"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Import history/ }),
    ).toBeInTheDocument();
  });
});

describe('Exact match filters',()=>{
 it('offers Exact match for source/stage/custom dropdowns and preserves the entered text',async()=>{
  const user=userEvent.setup(),apply=vi.fn();render(<LeadFilters applied={[]} onApply={apply}/>);
  await user.click(screen.getByRole('button',{name:/Filter any column/}));await user.click(screen.getByRole('button',{name:/Add condition/}));
  await user.selectOptions(screen.getByLabelText('Filter 1 comparison'),'exact');await user.type(screen.getByLabelText('Filter 1 value'),'Website');await user.click(screen.getByRole('button',{name:'Apply filters'}));
  expect(apply).toHaveBeenCalledWith([{field:'source',op:'exact',value:'Website'}]);
 });
 it('applies Exact match in the mobile dialog without changing Equals',async()=>{
  const user=userEvent.setup(),apply=vi.fn();render(<MobileLeadFilters config={config} sources={['Website']} applied={{searchField:'name',stage:'',source:'',filters:[]}} onApply={apply}/>);
  await user.click(screen.getByRole('button',{name:'Filter leads'}));await user.click(screen.getByRole('button',{name:/Add condition/}));await user.selectOptions(screen.getByLabelText('Filter 1 comparison'),'exact');await user.type(screen.getByLabelText('Filter 1 value'),'Website');await user.click(screen.getByRole('button',{name:'Apply filters'}));expect(apply).toHaveBeenCalledWith(expect.objectContaining({filters:[{field:'source',op:'exact',value:'Website'}]}));
 });
});

describe('workbook field discovery',()=>{
 async function upload(user:ReturnType<typeof userEvent.setup>,csv:string){
  const file=new File([csv],'fields.csv',{type:'text/csv'});Object.defineProperty(file,'text',{value:async()=>csv});await user.upload(screen.getByLabelText('Choose a workbook'),file);
 }
 it('creates reviewed Admin text fields and imports literal values with comments',async()=>{
  const user=userEvent.setup();let current:typeof config={...config,customFields:[]};
  const request=vi.fn(async(path:string,method?:string,body?:any)=>{
   if(path==='/field-options'){if(method==='PATCH')current={...current,customFields:body.customFields,version:current.version+1};return current;}
   if(path==='/imports/preview')return{id:'new-fields',formatVersion:3,status:'Preview',filename:'fields.csv',total:1,offset:0,reviewOffset:0,items:[]};
   return{items:[],nextCursor:null};
  });
  render(<ImportPage demo={false} canManageFields config={current} request={request} onImported={vi.fn()}/>);
  await upload(user,'Customer name,Phone number,Product,Notes\nSynthetic,12025550100,0012,Original note');
  expect(await screen.findByText('Additional workbook fields')).toBeInTheDocument();
  await user.click(screen.getByRole('button',{name:/Create \/ reuse 1 fields/}));
  await waitFor(()=>expect(request.mock.calls.some(([p])=>p==='/imports/preview')).toBe(true));
  const field=current.customFields[0];expect(field.type).toBe('text');expect(field.label).toBe('Product');
  const input=request.mock.calls.find(([p])=>p==='/imports/preview')![2];expect(input.rows[0][field.id]).toBe('0012');expect(input.rows[0].importComments[0].notes).toBe('Original note');
 });
 it('blocks schema creation for non-admin importers and allows explicit exclusion',async()=>{
  const user=userEvent.setup(),request=vi.fn(async(_path:string)=>({items:[],nextCursor:null}));render(<ImportPage demo={false} request={request} onImported={vi.fn()}/>);
  await upload(user,'Customer name,Phone number,Product\nSynthetic,12025550100,0012');
  expect(await screen.findByRole('button',{name:/Create \/ reuse 1 fields/})).toBeDisabled();
  expect(screen.getByLabelText('New field name for column 3')).toBeDisabled();
  const section=screen.getByText('Additional workbook fields').closest('fieldset')!;await user.click(within(section).getByRole('checkbox'));
  expect(screen.getByRole('button',{name:/Validate records/})).toBeEnabled();expect(request.mock.calls.some(([p])=>p==='/field-options')).toBe(false);
 });
});


describe('personal dashboard categories',()=>{
 it('falls back from a hidden stage, saves the demo choice and drills through the selected field without AI calls',async()=>{
  localStorage.removeItem('salesdrone.demo.dashboard-field');
  const user=userEvent.setup(),request=vi.fn(async()=>({})),onCategory=vi.fn();
  render(<DashboardPage demo config={{...config,labels:{...config.labels,zone:'Delivery region'},customFields:[{id:'cf_campaign',label:'Campaign',type:'text',options:[],required:false,deleted:false}],hiddenFields:['stage']}} request={request} firstName="Explorer" timezone="UTC" sample={{leads:[{...lead,legacyStatus:'Quoted',source:'Website',zone:'North',customFields:{cf_campaign:'Spring'}}],tasks:[],activities:[]}} refreshKey={0} stageOrder={config.values.stage} onStage={vi.fn()} onCategory={onCategory} onTasks={vi.fn()} onLead={async()=>{}} onTask={async()=>{}}/>);
  const picker=await screen.findByLabelText('Dashboard visualization field');
  await waitFor(()=>expect(picker).toBeEnabled());
  expect(screen.getByRole('option',{name:'Sales stage'})).toBeInTheDocument();
  expect(screen.getByText('Currently using Enquiry status')).toBeInTheDocument();
  await user.selectOptions(picker,'stage');
  expect(await screen.findByRole('heading',{name:'Leads by Sales stage'})).toBeInTheDocument();
  expect(localStorage.getItem('salesdrone.demo.dashboard-field')).toBe('stage');
  await user.selectOptions(picker,'source');
  await waitFor(()=>expect(screen.getByText('Currently using Enquiry source')).toBeInTheDocument());
  expect(localStorage.getItem('salesdrone.demo.dashboard-field')).toBe('source');
  await user.click(screen.getByRole('button',{name:/Website: 1 leads/}));expect(onCategory).toHaveBeenCalledWith('source','Website',false);
  expect(screen.getByRole('heading',{name:'Leads by Enquiry source'})).toBeInTheDocument();
  await user.selectOptions(picker,'zone');
  expect(await screen.findByRole('heading',{name:'Leads by Delivery region'})).toBeInTheDocument();
  await user.click(screen.getByRole('button',{name:/North: 1 leads/}));expect(onCategory).toHaveBeenLastCalledWith('zone','North',false);
  await user.selectOptions(picker,'cf_campaign');
  expect(await screen.findByRole('heading',{name:'Leads by Campaign'})).toBeInTheDocument();
  await user.click(screen.getByRole('button',{name:/Spring: 1 leads/}));expect(onCategory).toHaveBeenLastCalledWith('cf_campaign','Spring',false);
  expect(localStorage.getItem('salesdrone.demo.dashboard-field')).toBe('cf_campaign');
  expect(request).not.toHaveBeenCalled();localStorage.removeItem('salesdrone.demo.dashboard-field');
 });
});

describe('import status destination',()=>{
 it('defaults to Enquiry status when Sales stage is hidden and lets the importer choose another available field',async()=>{
  const user=userEvent.setup(), request=vi.fn(async(path:string)=>path==='/imports/preview'?{id:'status-preview',formatVersion:3,status:'Preview',filename:'statuses.csv',total:1,offset:0,reviewOffset:0,items:[]}:{items:[],nextCursor:null});
  render(<ImportPage demo={false} config={{...config,hiddenFields:['stage']}} request={request} onImported={vi.fn()}/>);
  const csv='Customer name,Phone number,Status\nSynthetic,12025550100,Sent details on WA';const file=new File([csv],'status.csv',{type:'text/csv'});Object.defineProperty(file,'text',{value:async()=>csv});await user.upload(screen.getByLabelText('Choose a workbook'),file);
  const picker=await screen.findByLabelText('Status mapping field');expect(picker).toHaveValue('legacyStatus');expect(within(picker).queryByRole('option',{name:'Sales stage'})).not.toBeInTheDocument();
  expect(screen.getByLabelText('Map status Sent details on WA')).toHaveValue('Sent details on WA');
  await user.selectOptions(picker,'source');expect(screen.getByLabelText('Map status Sent details on WA')).toHaveValue('');
  await user.selectOptions(screen.getByLabelText('Map status Sent details on WA'),'Website');await user.click(screen.getByRole('button',{name:/Validate records/}));
  await waitFor(()=>expect(request).toHaveBeenCalledWith('/imports/preview','POST',expect.objectContaining({statusField:'source',statusMap:{'Sent details on WA':'Website'}}),expect.any(String)));
 });
});


describe('mapped status destinations',()=>{
 async function upload(user:ReturnType<typeof userEvent.setup>,csv:string){
  const file=new File([csv],'mapped.csv',{type:'text/csv'});Object.defineProperty(file,'text',{value:async()=>csv});await user.upload(screen.getByLabelText('Choose a workbook'),file);
 }
 it('lists already-mapped categories and requires explicit resolution and exclusion before preview',async()=>{
  const user=userEvent.setup(),request=vi.fn(async(path:string,_method?:string,_body?:any)=>path==='/imports/preview'?{id:'mapped-preview',formatVersion:3,status:'Preview',filename:'mapped.csv',total:1,offset:0,reviewOffset:0,items:[]}:{items:[],nextCursor:null});
  render(<ImportPage demo={false} config={{...config,labels:{...config.labels,zone:'Zone'},values:{...config.values,zone:['North','South']}}} request={request} onImported={vi.fn()}/>);
  await upload(user,'Customer name,Phone number,Status,Zone,Source\nSynthetic,12025550100,Sent details on WA,South,Website');
  const picker=await screen.findByLabelText('Status mapping field');
  expect(within(picker).getByRole('option',{name:'Zone'})).toBeEnabled();expect(within(picker).getByRole('option',{name:'Enquiry source'})).toBeEnabled();
  await user.selectOptions(picker,'zone');expect(screen.getByRole('button',{name:/Validate records/})).toBeDisabled();
  await user.click(screen.getByRole('button',{name:'Review existing column'}));expect(screen.getByLabelText('Workbook column for Zone')).toHaveFocus();
  await user.selectOptions(screen.getByLabelText('Workbook column for Zone'),'-1');
  expect(screen.getByRole('button',{name:/Create \/ reuse 1 fields/})).toBeDisabled();
  expect(request.mock.calls.some(([p])=>p==='/imports/preview')).toBe(false);
  await user.click(screen.getByLabelText('Import column 4: Zone as a field'));
  await user.selectOptions(screen.getByLabelText('Map status Sent details on WA'),'North');
  await user.click(screen.getByRole('button',{name:/Validate records/}));
  await waitFor(()=>expect(request).toHaveBeenCalledWith('/imports/preview','POST',expect.objectContaining({statusField:'zone',statusMap:{'Sent details on WA':'North'},rows:[expect.objectContaining({source:'Website',legacyStatus:'Sent details on WA'})]}),expect.any(String)));
  expect(request.mock.calls.find(([p])=>p==='/imports/preview')![2].rows[0]).not.toHaveProperty('zone');
  expect(request.mock.calls.some(([p])=>p==='/field-options')).toBe(false);
 });
 it('protects a custom status destination from automatic field reuse and preserves its original column under a reviewed new name',async()=>{
  const user=userEvent.setup();let current:typeof config={...config,customFields:[{id:'cf_region',label:'Delivery region',type:'text',options:[],required:false,deleted:false}]};
  const request=vi.fn(async(path:string,method?:string,body?:any)=>{if(path==='/field-options'){if(method==='PATCH')current={...current,customFields:body.customFields,version:current.version+1};return current;}return path==='/imports/preview'?{id:'custom-preview',formatVersion:3,status:'Preview',filename:'mapped.csv',total:1,offset:0,reviewOffset:0,items:[]}:{items:[],nextCursor:null};});
  render(<ImportPage demo={false} canManageFields config={current} request={request} onImported={vi.fn()}/>);
  await upload(user,'Customer name,Phone number,Status,Delivery region\nSynthetic,12025550100,Sent details on WA,Original region');
  await user.selectOptions(await screen.findByLabelText('Status mapping field'),'cf_region');
  await user.selectOptions(screen.getByLabelText('Workbook column for Delivery region'),'-1');
  expect(screen.getByText(/An additional field would reuse Delivery region/)).toBeInTheDocument();
  expect(screen.getByRole('button',{name:/Create \/ reuse 1 fields/})).toBeDisabled();
  await user.click(screen.getByRole('button',{name:'Review additional field'}));expect(screen.getByLabelText('New field name for column 4')).toHaveFocus();
  await user.clear(screen.getByLabelText('New field name for column 4'));await user.type(screen.getByLabelText('New field name for column 4'),'Previous region');
  await user.click(screen.getByRole('button',{name:/Create \/ reuse 1 fields/}));
  await waitFor(()=>expect(request.mock.calls.some(([p])=>p==='/imports/preview')).toBe(true));
  const preserved=current.customFields.find(f=>f.label==='Previous region')!;
  expect(request.mock.calls.find(([p])=>p==='/imports/preview')![2]).toMatchObject({statusField:'cf_region',rows:[{[preserved.id]:'Original region',legacyStatus:'Sent details on WA'}]});
  expect(request.mock.calls.find(([p])=>p==='/imports/preview')![2].rows[0]).not.toHaveProperty('cf_region');
 });
});

it('rejects destination reuse from fresh field configuration before any schema or preview write',async()=>{
 const user=userEvent.setup();
 const initial:typeof config={...config,customFields:[{id:'cf_region',label:'Delivery region',type:'text',options:[],required:false,deleted:false}]};
 const current={...initial,version:2,customFields:[{...initial.customFields[0],label:'Legacy region'}]};
 const request=vi.fn(async(path:string,_method?:string)=>path==='/field-options'?current:{items:[],nextCursor:null});
 render(<ImportPage demo={false} canManageFields config={initial} request={request} onImported={vi.fn()}/>);
 const csv='Customer name,Phone number,Status,Legacy region,Product\nSynthetic,12025550100,Quoted,Original region,0012';
 const file=new File([csv],'fresh.csv',{type:'text/csv'});Object.defineProperty(file,'text',{value:async()=>csv});await user.upload(screen.getByLabelText('Choose a workbook'),file);
 await user.selectOptions(await screen.findByLabelText('Status mapping field'),'cf_region');
 await user.click(screen.getByRole('button',{name:/Create \/ reuse 2 fields/}));
 expect(await screen.findByRole('alert')).toHaveTextContent('An additional field would reuse the status destination');
 expect(request.mock.calls).not.toContainEqual(['/field-options','PATCH',expect.anything()]);
 expect(request.mock.calls.some(([p,m])=>p==='/field-options'&&m==='PATCH')).toBe(false);
 expect(request.mock.calls.some(([p])=>p==='/imports/preview')).toBe(false);
});

describe('archive restore policy and confirmation',()=>{
 it('readers can view retained leads without a restore action',async()=>{
  const {default:Archives}=await import('../src/features/ArchivedLeadsSettings');
  const request=vi.fn().mockResolvedValue({items:[{...lead,archived:true}],nextCursor:null});
  render(<Archives request={request}/>);await screen.findByText(lead.name);expect(screen.queryByRole('button',{name:'Restore lead'})).not.toBeInTheDocument();
 });
 it('cancellation does not write; confirmation sends the current version and removes only the restored card',async()=>{
  const {default:Archives}=await import('../src/features/ArchivedLeadsSettings');
  const request=vi.fn().mockImplementation(async(path:string)=>path.startsWith('/archived-leads')?{items:[{...lead,archived:true}],nextCursor:null}:{...lead,archived:false});
  const refreshed=vi.fn();const user=userEvent.setup();
  render(<Archives request={request} canRestore onRestored={refreshed}/>);
  await user.click(await screen.findByRole('button',{name:'Restore lead'}));await user.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Cancel'}));expect(request).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button',{name:'Restore lead'}));await user.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Confirm restore'}));
  await screen.findByText('No archived leads');expect(request).toHaveBeenCalledWith('/leads/'+lead.id+'/restore','POST',{expectedVersion:lead.version});expect(refreshed).toHaveBeenCalledTimes(1);
 });
});
