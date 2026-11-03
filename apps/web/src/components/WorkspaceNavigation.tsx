import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  UsersRound,
  ListTodo,
  Bell,
  Upload,
  ShieldCheck,
  Sparkles,
  Users,
  ChevronDown,
} from "lucide-react";
export const navigationGroups = [
  {
    id: "workspace",
    label: "Workspace",
    items: [
      { id: "today", label: "Today", icon: LayoutDashboard },
      { id: "leads", label: "Leads", icon: UsersRound },
      { id: "tasks", label: "Tasks", icon: ListTodo },
      { id: "notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    items: [
      { id: "team", label: "Team", icon: Users, access: "admin" },
      {
        id: "hygiene",
        label: "Lead Hygiene",
        icon: ShieldCheck,
        access: "hygiene:read",
      },
      {
        id: "assistant",
        label: "Lead Assistant",
        icon: Sparkles,
        access: "assistant:query",
      },
    ],
  },
  {
    id: "manage",
    label: "Manage",
    items: [
      {
        id: "imports",
        label: "Import enquiries",
        icon: Upload,
        access: "imports",
      },
    ],
  },
] as const;
export type NavigationPage =
  (typeof navigationGroups)[number]["items"][number]["id"];
export const navigationPages: readonly string[] = navigationGroups.flatMap(
  (g) => g.items.map((i) => i.id),
);
export function availableNavigation(
  admin: boolean,
  imports: boolean,
  can: (cap: string) => boolean,
) {
  return navigationGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => {
        if (!("access" in i)) return true;
        if (i.access === "admin") return admin;
        if (i.access === "imports") return imports;
        return can(String(i.access));
      }),
    }))
    .filter((g) => g.items.length);
}
export default function WorkspaceNavigation({
  page,
  onNavigate,
  admin,
  imports,
  can,
  taskCount,
  unread,
}: {
  page: string;
  onNavigate: (id: string) => void;
  admin: boolean;
  imports: boolean;
  can: (cap: string) => boolean;
  taskCount: number;
  unread: boolean;
}) {
  const [closed, setClosed] = useState<string[]>([]);
  useEffect(() => {
    setClosed((c) =>
      c.filter(
        (id) =>
          !navigationGroups
            .find((g) => g.id === id)
            ?.items.some((i) => i.id === page),
      ),
    );
  }, [page]);
  return (
    <div className="navigation-scroll">
      {availableNavigation(admin, imports, can).map((group) => {
        const collapsed = closed.includes(group.id);
        return (
          <section
            className={"navigation-group " + (collapsed ? "is-collapsed" : "")}
            key={group.id}
          >
            <button
              className="navigation-group-toggle"
              aria-expanded={!collapsed}
              aria-controls={"navigation-" + group.id}
              onClick={() =>
                setClosed((c) =>
                  c.includes(group.id)
                    ? c.filter((id) => id !== group.id)
                    : [...c, group.id],
                )
              }
            >
              {group.label}
              <ChevronDown size={14} />
            </button>
            <nav id={"navigation-" + group.id} aria-label={group.label}>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  className={"nav-item " + (page === item.id ? "active" : "")}
                  aria-current={page === item.id ? "page" : undefined}
                  aria-label={item.label}
                  title={item.label}
                  onClick={() => onNavigate(item.id)}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                  {item.id === "tasks" && taskCount > 0 ? (
                    <small>{taskCount}</small>
                  ) : null}
                  {item.id === "notifications" && unread ? (
                    <i className="notification-dot" />
                  ) : null}
                </button>
              ))}
            </nav>
          </section>
        );
      })}
    </div>
  );
}
