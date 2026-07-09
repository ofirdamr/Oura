"use client";

// Guest bottom navigation. SOLID (not translucent): a business app's bottom bar
// must read as a fixed, opaque surface with a hard top border — when the page
// scrolls under it, no content or page-background must bleed through (that
// looked unprofessional as a glass panel). Safe-area padding covers the iOS
// home-indicator strip so nothing peeks below it either.

const NAV_ITEMS = [
  { key: "home", label: "בית", icon: "home" },
  { key: "gallery", label: "גלריה", icon: "grid_view" },
  { key: "share", label: "שיתוף", icon: "share" },
  { key: "profile", label: "פרופיל", icon: "person" },
] as const;

type NavKey = (typeof NAV_ITEMS)[number]["key"];

export function BottomNav({
  active,
  onShare,
}: {
  active: NavKey;
  onShare?: () => void;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-surface-container shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.6)]">
      <div className="mx-auto flex max-w-lg items-center justify-around px-4 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-3">
        {NAV_ITEMS.map((item) => {
          const isActive = item.key === active;
          const isShare = item.key === "share" && onShare;
          const cls = `flex flex-col items-center transition-colors ${
            isActive ? "text-primary" : "text-on-surface-variant"
          }`;
          const inner = (
            <>
              <span
                className="material-symbols-outlined"
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {item.icon}
              </span>
              <span className={`mt-1 text-[11px] ${isActive ? "font-bold" : "font-medium"}`}>
                {item.label}
              </span>
            </>
          );
          return isShare ? (
            <button key={item.key} type="button" onClick={onShare} className={cls}>
              {inner}
            </button>
          ) : (
            <a key={item.key} href="#" className={cls}>
              {inner}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
