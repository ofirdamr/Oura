import { AdminShell } from "@/components/admin/AdminShell";

const RECENT_EVENTS = [
  {
    icon: "celebration",
    title: "חתונה, משפחת לוי",
    meta: "14.05.2024 · 842 תמונות",
    status: "באוויר",
    statusColor: "text-success",
    dotColor: "bg-success",
  },
  {
    icon: "business_center",
    title: "כנס טכנולוגיה 2024",
    meta: "12.05.2024 · 1,200 תמונות",
    status: "עיבוד AI",
    statusColor: "text-primary",
    dotColor: "bg-primary animate-pulse",
  },
  {
    icon: "family_restroom",
    title: "צילומי משפחה, גולדשטיין",
    meta: "10.05.2024 · 45 תמונות",
    status: "טיוטה",
    statusColor: "text-on-surface-variant/60",
    dotColor: "",
  },
];

export default function AdminDashboardPage() {
  return (
    <AdminShell active="לוח בקרה">
      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex flex-col rounded-3xl border border-primary/10 bg-surface-container p-6 shadow-[0_0_20px_rgba(255,138,117,0.08)]">
          <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant/60">
            סה&quot;כ תמונות באחסון
          </span>
          <div className="mt-2 flex items-end gap-3">
            <span className="text-4xl font-bold text-primary">14,208</span>
            <span className="mb-1 flex items-center text-xs font-bold text-success">
              +12%
            </span>
          </div>
        </div>
        <div className="flex flex-col rounded-3xl border border-primary/10 bg-surface-container p-6">
          <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant/60">
            אירועים פעילים
          </span>
          <div className="mt-2 flex items-end gap-3">
            <span className="text-4xl font-bold text-on-surface">24</span>
            <span className="mb-1 text-sm font-medium text-on-surface-variant/40">
              / 50 זמינים
            </span>
          </div>
        </div>
        <div className="flex flex-col rounded-3xl border border-primary/10 bg-surface-container p-6">
          <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant/60">
            ביקורי אורחים השבוע
          </span>
          <div className="mt-2 flex items-end gap-3">
            <span className="text-4xl font-bold text-tertiary">3,842</span>
            <span className="material-symbols-outlined mb-1 text-xl text-tertiary">
              trending_up
            </span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          <div className="flex flex-row-reverse items-center justify-between">
            <h2 className="text-xl font-bold">אירועים אחרונים</h2>
            <button className="text-sm font-bold text-primary hover:underline">
              צפה בכל האירועים
            </button>
          </div>
          <div className="space-y-3">
            {RECENT_EVENTS.map((event) => (
              <div
                key={event.title}
                className="flex cursor-pointer flex-row-reverse items-center justify-between rounded-2xl border border-primary/10 bg-surface-container p-4 hover:bg-surface-container-high"
              >
                <div className="flex flex-row-reverse items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-highest">
                    <span className="material-symbols-outlined text-on-surface-variant/40">
                      {event.icon}
                    </span>
                  </div>
                  <div className="text-end">
                    <h4 className="font-bold text-on-surface">
                      {event.title}
                    </h4>
                    <p className="mt-0.5 text-xs text-on-surface-variant/60">
                      {event.meta}
                    </p>
                  </div>
                </div>
                <div className="flex flex-row-reverse items-center gap-6">
                  <div className="hidden flex-col items-end md:flex">
                    <span className="text-[10px] font-bold uppercase text-on-surface-variant/60">
                      סטטוס
                    </span>
                    <span
                      className={`flex items-center gap-1 text-xs font-bold ${event.statusColor}`}
                    >
                      {event.dotColor && (
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${event.dotColor}`}
                        />
                      )}
                      {event.status}
                    </span>
                  </div>
                  <button className="p-2 text-on-surface-variant transition-colors hover:text-primary">
                    <span className="material-symbols-outlined">
                      more_vert
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl border border-primary/20 bg-surface-container p-6">
            <div className="mb-6 flex flex-row-reverse items-center gap-3">
              <span className="material-symbols-outlined text-primary">
                psychology
              </span>
              <h3 className="text-lg font-bold">עיבוד AI פעיל</h3>
            </div>
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex flex-row-reverse justify-between text-xs font-bold">
                  <span>זיהוי פנים: כנס טכנולוגיה</span>
                  <span className="text-primary">82%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
                  <div className="h-full rounded-full bg-primary" style={{ width: "82%" }} />
                </div>
              </div>
              <div>
                <div className="mb-2 flex flex-row-reverse justify-between text-xs font-bold">
                  <span>מיון אוטומטי: משפחת לוי</span>
                  <span className="text-tertiary">בשלבי סיום</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
                  <div className="h-full rounded-full bg-tertiary" style={{ width: "95%" }} />
                </div>
              </div>
            </div>
            <p className="mt-6 text-center text-[10px] italic text-on-surface-variant/40">
              המערכת מעבדת כרגע 2,400 תמונות ברקע
            </p>
          </div>
          <div className="space-y-4 rounded-3xl border border-primary/10 bg-primary/5 p-6">
            <h3 className="flex flex-row-reverse items-center gap-2 font-bold text-primary">
              <span className="material-symbols-outlined text-sm">stars</span>
              טיפ מקצועי
            </h3>
            <p className="text-end text-sm leading-relaxed text-on-surface-variant">
              שדרג את הגלריה שלך עם תכונת ה&quot;Highlights&quot; החדשה.
              אלגוריתם ה-AI שלנו יבחר עבורך את 20 התמונות הטובות ביותר
              מהאירוע באופן אוטומטי.
            </p>
            <button className="w-full rounded-xl bg-primary/10 py-2.5 text-xs font-bold text-primary transition-all hover:bg-primary/20">
              נסה עכשיו
            </button>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
