import type { NavigationItemModel, NavigationKey } from "../../types/ui";

interface NavigationItemProps {
  active: boolean;
  item: NavigationItemModel;
  onSelect: (key: NavigationKey) => void;
}

export function NavigationItem({ active, item, onSelect }: NavigationItemProps) {
  const Icon = item.icon;

  return (
    <button
      className={active ? "nav-item is-active" : "nav-item"}
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={() => onSelect(item.key)}
    >
      <Icon size={16} aria-hidden="true" />
      <span>{item.label}</span>
    </button>
  );
}
