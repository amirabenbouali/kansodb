import { Braces, FileCode2, History, PanelLeftClose, PanelLeftOpen, Settings, Table2, TerminalSquare } from "lucide-react";
import { DatabaseSelector } from "../navigation/DatabaseSelector";
import { NavigationItem } from "../navigation/NavigationItem";
import type { NavigationItemModel, NavigationKey } from "../../types/ui";

const navigationItems: NavigationItemModel[] = [
  { key: "tables", label: "Tables", icon: Table2 },
  { key: "console", label: "Console", icon: TerminalSquare },
  { key: "scripts", label: "Scripts", icon: FileCode2 },
  { key: "engine", label: "Engine", icon: Braces },
  { key: "history", label: "History", icon: History },
  { key: "settings", label: "Settings", icon: Settings }
];

interface SidebarProps {
  activeNavigation: NavigationKey;
  collapsed: boolean;
  databaseName: string;
  onNavigate: (key: NavigationKey) => void;
  onToggleSidebar: () => void;
  version: string;
}

export function Sidebar({ activeNavigation, collapsed, databaseName, onNavigate, onToggleSidebar, version }: SidebarProps) {
  return (
    <aside className={collapsed ? "sidebar is-collapsed" : "sidebar"}>
      <header className="brand">
        <div>
          <h1 className="brand-title">KANSO DB</h1>
          <span className="brand-version">{version}</span>
        </div>
        <button className="sidebar-toggle" type="button" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={onToggleSidebar}>
          {collapsed ? <PanelLeftOpen size={16} aria-hidden="true" /> : <PanelLeftClose size={16} aria-hidden="true" />}
        </button>
      </header>

      <div className="sidebar-content">
        <section aria-label="Database">
          <p className="eyebrow">Database</p>
          <DatabaseSelector databaseName={databaseName} />
        </section>

        <nav className="nav-list" aria-label="Primary">
          {navigationItems.map((item) => (
            <NavigationItem
              active={activeNavigation === item.key}
              item={item}
              key={item.key}
              onSelect={onNavigate}
            />
          ))}
        </nav>

        <section className="manifesto-card" aria-label="Product concept">
          <strong>Inside the Database.</strong>
          <p>
            Every query.
            <br />
            Every step.
            <br />
            Nothing hidden.
          </p>
          <span>Made with clarity for curious minds.</span>
        </section>
      </div>
    </aside>
  );
}
