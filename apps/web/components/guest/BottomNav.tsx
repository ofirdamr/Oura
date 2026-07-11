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
  onProfile,
  onHome,
}: {
  active: NavKey;
  onShare?: () => void;
  onProfile?: () => void;
  onHome?: () => void;
}) {
  // Every item is WIRED — no dead href="#". Where a screen doesn't have its own
  // destination yet, it does the sensible in-context action (home/gallery jump
  // to the top of the current gallery). share/profile are provided by the host.
  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const handlers: Record<NavKey, () => void> = {
    home: onHome ?? scrollTop,
    gallery: scrollTop,
    share: onShare ?? scrollTop,
    profile: onProfile ?? scrollTop,
  };
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-surface-container shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.6)]">
      <div className="mx-auto flex max-w-lg items-center justify-around px-4 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-3">
        {NAV_ITEMS.map((item) => {
          const isActive = item.key === active;
          return (
            <button
              key={item.key}
              type="button"
              onClick={handlers[item.key]}
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
              <span className={`mt-1 text-[11px] ${isActive ? "font-bold" : "font-medium"}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
