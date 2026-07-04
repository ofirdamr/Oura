import type { ReactNode } from "react";

const NAV_ITEMS = [
  { label: "לוח בקרה", icon: "dashboard", href: "/admin" },
  { label: "אירועים", icon: "photo_camera", href: "#" },
  { label: "ארכיון", icon: "inventory_2", href: "#" },
  { label: "ניהול לקוחות", icon: "groups", href: "#" },
  { label: "סטטיסטיקה", icon: "analytics", href: "#" },
  { label: "הגדרות", icon: "settings", href: "/admin/branding" },
];

export function AdminShell({
  active,
  children,
}: {
  active: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <header className="fixed z-50 flex h-16 w-full flex-row-reverse items-center justify-between border-b border-outline-variant bg-surface-container/90 px-6 backdrop-blur-md md:px-20">
        <div className="flex flex-row-reverse items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-surface-container-highest">
              <span className="font-display text-lg font-bold text-primary">
                O
              </span>
            </div>
            <span className="font-display text-xl font-bold tracking-tight text-primary md:text-2xl">
              Oura
            </span>
          </div>
          <nav className="hidden flex-row-reverse gap-8 text-sm font-medium lg:flex">
            <a
              className="border-b-2 border-primary pb-1 text-primary"
              href="/admin"
            >
              ראשי
            </a>
            <a
              className="text-on-surface-variant/80 transition-colors hover:text-primary"
              href="#"
            >
              אירועים
            </a>
            <a
              className="text-on-surface-variant/80 transition-colors hover:text-primary"
              href="/admin/branding"
            >
              הגדרות
            </a>
          </nav>
        </div>
        <div className="flex flex-row-reverse items-center gap-6">
          <button className="rounded-full bg-primary px-6 py-2 text-sm font-bold text-on-primary shadow-lg shadow-primary/10 transition-all hover:brightness-110 active:scale-95">
            העלאת תמונות
          </button>
          <div className="flex flex-row-reverse items-center gap-4">
            <span className="material-symbols-outlined cursor-pointer text-on-surface-variant transition-colors hover:text-primary">
              notifications
            </span>
            <div className="flex items-center gap-3 border-e border-outline-variant pe-4">
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-outline-variant bg-surface-container-highest">
                <span className="material-symbols-outlined text-primary">
                  person
                </span>
              </div>
              <div className="hidden flex-col items-end md:flex">
                <span className="text-sm font-bold leading-none">
                  יוסי דוסנטוס
                </span>
                <span className="text-[10px] font-medium text-on-surface-variant/60">
                  צלם מורשה
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <aside className="fixed top-0 z-40 hidden h-screen w-64 flex-col border-s border-outline-variant bg-surface-container pb-6 pt-20 md:end-0 md:flex">
        <div className="mb-8 flex flex-col gap-2 px-4">
          <div className="flex flex-col items-center rounded-2xl border border-outline-variant/10 bg-surface-container-high p-6 text-center">
            <div className="mb-4 h-20 w-20 rounded-full border-2 border-primary/30 bg-black p-1" />
            <span className="mb-1 text-lg font-bold text-on-surface">
              Photo Santos
            </span>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
              שותף מורשה
            </span>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className={
                item.label === active
                  ? "flex flex-row-reverse items-center gap-4 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-primary transition-all"
                  : "flex flex-row-reverse items-center gap-4 rounded-xl px-4 py-3 text-on-surface-variant transition-all hover:bg-surface-container-highest"
              }
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span
                className={
                  item.label === active
                    ? "text-sm font-bold"
                    : "text-sm font-medium"
                }
              >
                {item.label}
              </span>
            </a>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3 px-4">
          <a
            href="/admin/create-event"
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-on-primary shadow-lg shadow-primary/20 transition-all hover:brightness-110"
          >
            <span className="material-symbols-outlined font-bold">add</span>
            <span className="text-sm font-bold">אירוע חדש</span>
          </a>
          <hr className="mb-2 border-outline-variant opacity-30" />
          <a
            href="#"
            className="flex flex-row-reverse items-center gap-4 px-4 py-2 text-error transition-colors hover:opacity-80"
          >
            <span className="material-symbols-outlined">logout</span>
            <span className="text-sm font-bold">התנתקות</span>
          </a>
        </div>
      </aside>

      <main className="custom-scrollbar h-screen overflow-y-auto bg-surface pt-16 md:pe-64">
        <div className="mx-auto max-w-[1400px] space-y-8 p-6 md:p-20">
          {children}
        </div>
      </main>
    </div>
  );
}
