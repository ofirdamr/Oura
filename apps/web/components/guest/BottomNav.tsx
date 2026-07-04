const NAV_ITEMS = [
  { key: "home", label: "בית", icon: "home" },
  { key: "gallery", label: "גלריה", icon: "grid_view" },
  { key: "share", label: "שיתוף", icon: "share" },
  { key: "profile", label: "פרופיל", icon: "person" },
] as const;

type NavKey = (typeof NAV_ITEMS)[number]["key"];

export function BottomNav({ active }: { active: NavKey }) {
  return (
    <nav className="glass-panel fixed bottom-0 start-0 end-0 z-50 mx-auto flex max-w-lg items-center justify-around rounded-t-3xl border-t border-white/10 px-4 py-3">
      {NAV_ITEMS.map((item) => {
        const isActive = item.key === active;
        return (
          <a
            key={item.key}
            href="#"
            className={`flex flex-col items-center transition-colors ${
              isActive ? "text-primary" : "text-on-surface-variant"
            }`}
          >
            <span
              className="material-symbols-outlined"
              style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {item.icon}
            </span>
            <span
              className={`mt-1 text-[11px] ${isActive ? "font-bold" : "font-medium"}`}
            >
              {item.label}
            </span>
          </a>
        );
      })}
    </nav>
  );
}
