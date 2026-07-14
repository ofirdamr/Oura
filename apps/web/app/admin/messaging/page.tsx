"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";

const STATS = [
  { icon: "send", label: "הודעות שנשלחו", value: "1,248", color: "text-primary", bg: "bg-primary/10" },
  { icon: "visibility", label: "אחוז פתיחה", value: "94.2%", color: "text-green-400", bg: "bg-green-400/10" },
  { icon: "touch_app", label: "הקלקות לגלריה", value: "856", color: "text-primary", bg: "bg-primary/10" },
];

const DELIVERY_RULES = [
  {
    id: "immediate",
    icon: "auto_awesome",
    title: "מיד לאחר עיבוד AI",
    desc: "ההודעה תשלח ברגע שהמערכת זיהתה פנים",
  },
  {
    id: "scheduled",
    icon: "schedule",
    title: "תזמון מושהה",
    desc: "שלח את ההודעות כמה שעות לאחר סיום האירוע",
  },
  {
    id: "manual",
    icon: "touch_app",
    title: "בתזמון ידני",
    desc: "המתן לאישור סופי שלי לכל הודעה",
  },
];

export default function MessagingPage() {
  const [activeTab, setActiveTab] = useState<"sms" | "push">("sms");
  const [deliveryRule, setDeliveryRule] = useState("immediate");

  return (
    <AdminShell active="הגדרות">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row-reverse justify-between items-start md:items-center gap-4 mb-8">
        <div className="text-start">
          <h1 className="text-3xl font-bold text-on-surface mb-1">
            ניהול הודעות ותקשורת
          </h1>
          <p className="text-on-surface-variant text-sm">
            הגדר תבניות הודעה אוטומטיות ותזמוני שליחה ללקוחות שלך.
          </p>
        </div>
        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-surface-container-high rounded-xl border border-outline-variant/30">
          <button
            onClick={() => setActiveTab("sms")}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === "sms"
                ? "bg-primary text-on-primary shadow"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            הודעות SMS
          </button>
          <button
            onClick={() => setActiveTab("push")}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === "push"
                ? "bg-primary text-on-primary shadow"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            התראות Push
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {STATS.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-outline-variant/30 bg-surface-container p-5 flex flex-row-reverse items-center gap-4"
          >
            <div
              className={`w-12 h-12 rounded-full ${stat.bg} flex items-center justify-center ${stat.color} shrink-0`}
            >
              <span className="material-symbols-outlined">{stat.icon}</span>
            </div>
            <div className="text-start">
              <p className="text-xs text-on-surface-variant mb-1">{stat.label}</p>
              <p
                className="text-2xl font-bold text-on-surface"
                style={{ unicodeBidi: "isolate" }}
              >
                {stat.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Main workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Editor + Delivery Rules */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Template Editor */}
          <section className="rounded-2xl border border-outline-variant/30 bg-surface-container p-6">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold text-on-surface">
                עורך תבנית הודעה
              </h2>
              <span className="bg-green-400/10 text-green-400 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                פעיל
              </span>
            </div>
            <div className="mb-4">
              <label className="block text-start text-sm font-medium text-on-surface-variant mb-2">
                תוכן ההודעה
              </label>
              <textarea
                className="w-full h-44 bg-surface-container-high border border-outline-variant/30 rounded-xl p-4 text-start font-sans text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
                defaultValue={`שלום {שם_אורח}!\nאיזה כיף שהייתם איתנו ב{שם_אירוע}. התמונות המדהימות שלך כבר כאן!\n\nלצפייה בגלריה המלאה:\n{קישור_לגלריה}`}
              />
            </div>
            {/* Dynamic placeholders */}
            <div className="flex flex-row-reverse flex-wrap gap-2">
              <span className="text-xs text-on-surface-variant self-center me-1">
                הוסף שדה דינמי:
              </span>
              {["{שם_אורח}", "{שם_אירוע}", "{קישור_לגלריה}", "{תאריך_אירוע}"].map(
                (ph) => (
                  <button
                    key={ph}
                    className="px-3 py-1.5 bg-surface-container-high border border-outline-variant/30 rounded-lg text-xs font-medium text-on-surface hover:border-primary transition-colors"
                  >
                    {ph}
                  </button>
                )
              )}
            </div>
          </section>

          {/* Delivery Rules */}
          <section className="rounded-2xl border border-outline-variant/30 bg-surface-container p-6">
            <h2 className="text-lg font-bold text-on-surface text-start mb-5">
              כללי שליחה ותזמון
            </h2>
            <div className="space-y-3">
              {DELIVERY_RULES.map((rule) => (
                <label
                  key={rule.id}
                  className="flex flex-row-reverse items-center justify-between p-4 bg-surface-container-high rounded-xl border border-outline-variant/20 cursor-pointer hover:border-primary/40 transition-colors group"
                >
                  <div className="flex flex-row-reverse items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/20 shrink-0">
                      <span className="material-symbols-outlined">{rule.icon}</span>
                    </div>
                    <div className="text-start">
                      <p className="text-sm font-medium text-on-surface">
                        {rule.title}
                      </p>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        {rule.desc}
                      </p>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="delivery-rule"
                    value={rule.id}
                    checked={deliveryRule === rule.id}
                    onChange={() => setDeliveryRule(rule.id)}
                    className="w-4 h-4 text-primary border-outline-variant focus:ring-primary"
                  />
                </label>
              ))}
            </div>
          </section>

          {/* Send button */}
          <div className="flex justify-start">
            <button className="bg-primary text-on-primary px-8 py-3 rounded-xl font-bold text-sm hover:brightness-110 transition-all active:scale-95 shadow-lg shadow-primary/20">
              שלח הודעות לאירוע הנוכחי
            </button>
          </div>
        </div>

        {/* Phone Preview */}
        <div className="lg:col-span-4 flex flex-col items-center gap-4">
          <p className="text-sm font-medium text-on-surface-variant">
            תצוגה מקדימה בזמן אמת
          </p>
          <div className="relative w-[260px] h-[520px] bg-black rounded-[2.5rem] border-[7px] border-surface-container-high shadow-2xl overflow-hidden">
            {/* Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5 bg-surface-container-high rounded-b-2xl z-10" />
            {/* Content */}
            <div className="w-full h-full bg-gradient-to-br from-surface-container to-black flex flex-col">
              {/* Status bar */}
              <div className="flex justify-between px-5 pt-7 text-[10px] text-white/70 font-bold" dir="ltr">
                <span>9:41</span>
                <div className="flex gap-1">
                  <span className="material-symbols-outlined text-xs">signal_cellular_alt</span>
                  <span className="material-symbols-outlined text-xs">wifi</span>
                  <span className="material-symbols-outlined text-xs">battery_full</span>
                </div>
              </div>
              {/* Notification bubble */}
              <div className="mt-6 mx-3">
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/20">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-white/60 font-bold">
                      {activeTab === "sms" ? "הודעות (SMS)" : "התראות"}
                    </span>
                    <span className="text-[10px] text-white/60">עכשיו</span>
                  </div>
                  <p className="text-white text-[11px] leading-relaxed text-start">
                    שלום נועה! איזה כיף שהיית איתנו בחתונה של גל ורון. התמונות
                    שלך כבר מחכות!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
