import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import TeamPage from "../src/features/TeamPage";
import WorkspaceNavigation from "../src/components/WorkspaceNavigation";
import MobileLeadFilters from "../src/components/MobileLeadFilters";
import { defaultFieldOptions } from "../src/lib/field-options";
const member = {
  id: "sdr",
  name: "Synthetic SDR",
  role: "SDR",
  active: true,
  assigned: 4,
  comments: 2,
  calls: 1,
  connected: 1,
  leadsWorked: 2,
  stageChanges: 1,
  pending: 2,
  overdue: 1,
  completed: 1,
  lastActivityAt: "2026-11-03T10:00:00Z",
  stages: [{ label: "Custom stage", value: 4 }],
};
const snapshot = {
  generatedAt: "2026-11-03T12:00:00Z",
  since: "2026-10-05T00:00:00Z",
  days: 30,
  timezone: "UTC",
  members: [member],
  unassigned: 1,
  unlistedAssigned: 0,
  trend: [{ date: "2026-11-03", comments: 2, calls: 1 }],
};
describe("Admin Team", () => {
  it("opens member comments, keeps linked leads and changes the reporting period", async () => {
    const user = userEvent.setup(),
      onLeads = vi.fn(),
      request = vi.fn(async (p: string) =>
        p.startsWith("/team/members")
          ? {
              items: [
                {
                  id: "a",
                  type: "note",
                  notes: "Literal <script> text",
                  createdAt: "2026-11-03T10:00:00Z",
                  revision: 2,
                  lead: { id: "lead-a", name: "Synthetic lead" },
                },
              ],
              nextCursor: null,
            }
          : snapshot,
      );
    render(<TeamPage request={request} onLeads={onLeads} />);
    await screen.findByText("People & progress");
    await user.click(
      screen.getByRole("button", { name: "Synthetic SDR SDR · Active member" }),
    );
    await screen.findByText("Literal <script> text");
    expect(
      screen.getByRole("link", { name: "Synthetic lead" }),
    ).toHaveAttribute("href", "/leads/lead-a");
    await user.click(
      screen.getByRole("button", { name: /View assigned leads/ }),
    );
    expect(onLeads).toHaveBeenCalledWith("sdr");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Team activity period" }),
      "7",
    );
    await waitFor(() => expect(request).toHaveBeenCalledWith("/team?days=7"));
  });
  it("hides Team and management links from unauthorized members; grouped navigation remains keyboard operable", async () => {
    const user = userEvent.setup(),
      onNavigate = vi.fn();
    render(
      <WorkspaceNavigation
        page="today"
        onNavigate={onNavigate}
        admin={false}
        imports={false}
        can={() => false}
        taskCount={0}
        unread={false}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Team" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Import enquiries" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tasks" }));
    expect(onNavigate).toHaveBeenCalledWith("tasks");
    await user.click(screen.getByRole("button", { name: "Workspace" }));
    expect(screen.getByRole("button", { name: "Workspace" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
  it("mobile assignee filters retain Cancel, Apply and Reset semantics", async () => {
    const user = userEvent.setup(),
      onApply = vi.fn();
    render(
      <MobileLeadFilters
        config={defaultFieldOptions}
        sources={[]}
        assignees={[{ id: "sdr", name: "Synthetic SDR", active: true }]}
        applied={{
          searchField: "name",
          stage: "",
          source: "",
          filters: [],
          assignee: "",
        }}
        onApply={onApply}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Filter leads" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Filter assigned to" }),
      "sdr",
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onApply).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Filter leads" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Filter assigned to" }),
      "sdr",
    );
    await user.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(onApply.mock.calls[0][0].assignee).toBe("sdr");
    await user.click(screen.getByRole("button", { name: "Filter leads" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Filter assigned to" }),
      "__unassigned__",
    );
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(
      screen.getByRole("combobox", { name: "Filter assigned to" }),
    ).toHaveValue("");
  });
});
