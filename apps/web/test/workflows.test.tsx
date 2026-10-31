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
