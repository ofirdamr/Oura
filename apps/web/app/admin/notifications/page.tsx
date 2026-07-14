"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";

type Tab = "all" | "system" | "guests" | "urgent";

const NOTIFICATIONS = [
  {
    id: "storage",
    category: "urgent" as const,
    icon: "warning",
    iconBg: "bg-error/10",
    iconColor: "text-error",
    borderColor: "border-s-error",
    title: "ניצול נפח אחסון גבוה",
    time: "לפני 5 דקות",
    timeColor: "text-error",
    body: "חבילת האחסון של Photo Santos הגיעה ל-95% ניצול. יש לשדרג כדי להמשיך להפיק אירועים.",
    primaryAction: "שדרג עכשיו",
    secondaryAction: "בטל",
    unread: true,
  },
  {
    id: "ai-done",
    category: "system" as const,
    icon: "auto_awesome",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    borderColor: "",
    title: "עיבוד ה-AI הסתיים",
    time: "לפני 2 שעות",
    timeColor: "text-on-surface-variant",
    body: 'התמונות מהאירוע "חתונה של נועה וגיא" עובדו בהצלחה. כל הפנים שויכו לגלריות אישיות ממותגות Santos.',
    primaryAction: "צפה בפרטים",
    secondaryAction: "סמן כנקרא",
    unread: false,
  },
  {
    id: "misid",
    category: "guests" as const,
    icon: "person",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    borderColor: "border-s-primary",
    title: "דיווח חדש על זיהוי שגוי",
    time: "לפני 4 שעות",
    timeColor: "text-primary",
    body: 'אורח דיווח על תמונה שאינה שלו בגלריה האישית ב"בר מצווה של עידו". נדרש טיפול מנהל סטודיו.',
    primaryAction: "טפל בדיווח",
    secondaryAction: "התעלם",
    unread: true,
  },
  {
    id: "downloads",
    category: "system" as const,
    icon: "download",
    iconBg: "bg-surface-container-high",
    iconColor: "text-on-surface-variant",
    borderColor: "",
    title: "פעילות הורדה חריגה",
    time: "לפני יום 1",
    timeColor: "text-on-surface-variant",
    body: 'זוהו הורדות מרובות מאותה כתובת IP באירוע "השקת מוצר טסלה". מומלץ לבדוק הגדרות פרטיות.',
    primaryAction: "בדוק אבטחה",
    secondaryAction: "סמן כנקרא",
    unread: false,
  },
];

const TABS: { id: Tab; label: string; urgent?: boolean }[] = [
  { id: "all", label: "הכל" },
  { id: "system", label: "מערכת" },
  { id: "guests", label: "אורחים" },
  { id: "urgent", label: "דחוף", urgent: true },
];

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = NOTIFICATIONS.filter((n) => {
    if (dismissed.has(n.id)) return false;
    if (activeTab === "all") return true;
    return n.category === activeTab;
  });

  return (
    <AdminShell active="הגדרות">
      {/* Header */}
      <div className="flex flex-col md:flex-row-reverse justify-between items-start md:items-center gap-4 mb-8">
        <div className="text-start">
          <h1 className="text-3xl font-bold text-on-surface mb-1">מרכז התראות</h1>
          <p className="text-sm text-on-surface-variant">
            נהל את כל העדכונים מהמערכת וממרכז הפקת Photo Santos במקום אחד.
          </p>
        </div>
        <button
          onClick={() =>
            setDismissed(new Set(NOTIFICATIONS.map((n) => n.id)))
          }
          className="flex items-center gap-2 text-primary hover:bg-primary/10 px-4 py-2 rounded-full transition-all border border-primary/20 text-sm font-medium"
        >
          <span className="material-symbols-outlined text-base">done_all</span>
          סמן הכל כנקרא
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-surface-container p-1.5 rounded-2xl flex flex-row-reverse mb-8 border border-outline-variant/30 gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === tab.id
                ? "bg-surface shadow text-primary border border-outline-variant/30"
                : "text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            {tab.label}
            {tab.urgent && (
              <span className="w-2 h-2 bg-error rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Notification cards */}
      {visible.length > 0 ? (
        <div className="space-y-4 max-w-4xl">
          {visible.map((notif) => (
            <div
              key={notif.id}
              className={`group bg-surface-container rounded-xl border border-outline-variant/20 p-5 flex flex-row-reverse gap-4 hover:shadow-md transition-all ${
                notif.borderColor ? `border-s-4 ${notif.borderColor}` : ""
              }`}
            >
              {/* Unread dot */}
              <div className="shrink-0 mt-2">
                <span
                  className={`w-2 h-2 rounded-full block ${
                    notif.unread ? "bg-primary" : "bg-transparent"
                  }`}
                />
              </div>

              {/* Icon */}
              <div
                className={`w-12 h-12 rounded-full ${notif.iconBg} ${notif.iconColor} flex items-center justify-center shrink-0`}
              >
                <span className="material-symbols-outlined">{notif.icon}</span>
              </div>

              {/* Content */}
              <div className="flex-1 text-start min-w-0">
                <div className="flex flex-row-reverse justify-between items-start mb-1">
                  <h3 className="text-base font-bold text-on-surface">
                    {notif.title}
                  </h3>
                  <span className={`text-xs font-medium shrink-0 ms-3 ${notif.timeColor}`}>
                    {notif.time}
                  </span>
                </div>
                <p className="text-sm text-on-surface-variant mb-4 leading-relaxed">
                  {notif.body}
                </p>
                {/* Actions — visible on hover */}
                <div className="flex flex-row-reverse gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="bg-primary text-on-primary px-4 py-2 rounded-lg text-xs font-bold hover:brightness-110 transition-all">
                    {notif.primaryAction}
                  </button>
                  <button
                    onClick={() =>
                      setDismissed((prev) => new Set([...prev, notif.id]))
                    }
                    className="text-on-surface-variant hover:text-on-surface px-4 py-2 rounded-lg text-xs font-medium"
                  >
                    {notif.secondaryAction}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-24 text-center max-w-sm mx-auto">
          <div className="w-24 h-24 mb-6 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-5xl">
              notifications_off
            </span>
          </div>
          <h3 className="text-xl font-bold text-on-surface mb-2">
            הכל שקט כאן
          </h3>
          <p className="text-sm text-on-surface-variant">
            אין לך התראות חדשות בסטודיו Photo Santos כרגע.
          </p>
        </div>
      )}
    </AdminShell>
  );
}
