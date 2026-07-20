"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { API_BASE_URL } from "@/lib/api";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

// ─── Types ──────────────────────────────────────────────────────────────────

type Order = {
  id: string;
  photo_id: string;
  format: "magnet" | "print_10x15" | "block" | "photo_book";
  fulfillment_type: "AUTOMATED_WHOLESALE" | "SELF_FULFILLMENT";
  order_status:
    | "Awaiting_High_Res_Asset"
    | "Ready_For_Photographer_Print"
    | "Dispatched_To_Wholesaler"
    | "Completed";
  quantity: number;
  price_agorot: number;
  guest_name: string | null;
  guest_phone: string | null;
  notes: string | null;
  marked_printed_at: string | null;
  created_at: string;
  photos: { storage_key: string } | null;
};

type StatusFilter =
  | "all"
  | "Awaiting_High_Res_Asset"
  | "Ready_For_Photographer_Print"
  | "Completed";

// ─── Constants ──────────────────────────────────────────────────────────────

const FORMAT_LABEL: Record<string, string> = {
  magnet: "מגנט",
  print_10x15: "הדפסה 10×15",
  block: "בלוק עץ",
  photo_book: "ספר תמונות",
};

const FORMAT_GROUPS = ["magnet", "print_10x15", "block", "photo_book"] as const;

const WHATSAPP_TEMPLATES: { label: string; body: (name: string) => string }[] =
  [
    {
      label: "תזכורת תשלום",
      body: (name) =>
        `היי ${name}, כאן מהצוות של Oura 📸\nהתמונות שלך מהאירוע מוכנות! נשמח להשלמת התשלום כדי שנוכל לשלוח אותן לדפוס. לינק לתשלום: [לינק]`,
    },
    {
      label: "הזמנה מוכנה",
      body: (name) =>
        `היי ${name}! ההדפסות שלך מוכנות ונשלחו לדפוס 🎉\nנעדכן אותך כשיגיעו. תודה שבחרת ב-Oura!`,
    },
    {
      label: "תודה רבה",
      body: (name) =>
        `היי ${name}, תודה רבה על ההזמנה! 🙏\nנשמח לראותך באירוע הבא. צוות Oura`,
    },
  ];

// ─── Helpers ────────────────────────────────────────────────────────────────

function isPaid(order: Order): boolean {
  return order.price_agorot > 0;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function guestInitial(name: string | null): string {
  if (!name) return "א";
  return name.trim().charAt(0);
}

function downloadCSV(orders: Order[]) {
  const headers = ["שם", "טלפון", "פורמט", "כמות", "מחיר", "סטטוס", "תאריך"];
  const rows = orders.map((o) => [
    o.guest_name ?? "",
    o.guest_phone ?? "",
    FORMAT_LABEL[o.format] ?? o.format,
    String(o.quantity),
    String((o.price_agorot / 100).toFixed(2)),
    o.order_status,
    new Date(o.created_at).toLocaleDateString("he-IL"),
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${v}"`).join(","))
    .join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "print-queue.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── WhatsApp Modal ──────────────────────────────────────────────────────────

function WhatsAppModal({
  order,
  onClose,
}: {
  order: Order | null;
  onClose: () => void;
}) {
  const [templateIdx, setTemplateIdx] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!order) return;
    setMessage(WHATSAPP_TEMPLATES[0].body(order.guest_name ?? "אורח"));
    setTemplateIdx(0);
  }, [order]);

  if (!order) return null;

  function applyTemplate(idx: number) {
    setTemplateIdx(idx);
    setMessage(WHATSAPP_TEMPLATES[idx].body(order!.guest_name ?? "אורח"));
  }

  function send() {
    if (!order?.guest_phone) return;
    const phone = order.guest_phone.replace(/\D/g, "");
    const intl = phone.startsWith("0") ? "972" + phone.slice(1) : phone;
    window.open(
      `https://wa.me/${intl}?text=${encodeURIComponent(message)}`,
      "_blank"
    );
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="glass-card w-full max-w-3xl rounded-2xl border border-white/10 shadow-2xl">
        <div className="p-6">
          {/* Header */}
          <div className="mb-5 flex items-center justify-between">
            <h3 className="font-sans text-lg font-bold text-on-surface">
              הגדרת הודעת וואטסאפ
            </h3>
            <button
              onClick={onClose}
              className="material-symbols-outlined text-on-surface-variant transition-colors hover:text-on-surface"
            >
              close
            </button>
          </div>

          <div className="flex flex-col gap-6 md:flex-row">
            {/* Left: editor */}
            <div className="flex-1 space-y-4">
              {/* Templates */}
              <div className="space-y-2">
                <label className="text-xs text-on-surface-variant">
                  בחירת תבנית:
                </label>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {WHATSAPP_TEMPLATES.map((t, i) => (
                    <button
                      key={i}
                      onClick={() => applyTemplate(i)}
                      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                        templateIdx === i
                          ? "bg-primary text-on-primary"
                          : "border border-white/10 bg-surface-container text-on-surface-variant hover:bg-surface-variant"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Textarea */}
              <div className="space-y-2">
                <label className="text-xs text-on-surface-variant">
                  תוכן ההודעה:
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  className="w-full resize-none rounded-xl border border-white/10 bg-surface-container p-3 text-sm text-on-surface focus:border-primary/50 focus:outline-none focus:ring-0"
                  dir="rtl"
                />
              </div>

              {/* CTA */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={send}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] py-2.5 text-sm font-bold text-white transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-[18px]">chat</span>
                  שלח בוואטסאפ
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-bold text-on-surface-variant transition-all hover:bg-white/5 active:scale-95"
                >
                  ביטול
                </button>
              </div>
            </div>

            {/* Right: chat preview */}
            <div className="flex min-h-[220px] flex-1 items-center justify-center rounded-2xl border border-white/5 bg-black/40 p-4">
              <div className="w-full max-w-[280px] space-y-2">
                <p className="mb-2 text-center text-[10px] text-on-surface-variant">
                  היום, {new Date().getHours()}:{String(new Date().getMinutes()).padStart(2, "0")}
                </p>
                <div className="relative rounded-xl rounded-tr-none border border-[#075E54]/30 bg-[#075E54]/20 p-3 text-sm text-on-surface shadow-lg">
                  <p className="whitespace-pre-wrap" dir="rtl">
                    {message}
                  </p>
                  <div className="mt-1 flex items-center justify-end gap-1">
                    <span className="text-[10px] opacity-60">
                      {new Date().getHours()}:{String(new Date().getMinutes()).padStart(2, "0")}
                    </span>
                    <span className="material-symbols-outlined text-[14px] text-[#34B7F1]">
                      done_all
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Order["order_status"] }) {
  const map: Record<
    Order["order_status"],
    { label: string; cls: string; dot?: boolean }
  > = {
    Awaiting_High_Res_Asset: {
      label: "ממתין",
      cls: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
      dot: true,
    },
    Ready_For_Photographer_Print: {
      label: "מוכן",
      cls: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
      dot: true,
    },
    Dispatched_To_Wholesaler: {
      label: "נשלח לספק",
      cls: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
      dot: true,
    },
    Completed: {
      label: "הושלם",
      cls: "bg-surface-container text-on-surface-variant border border-white/10",
    },
  };
  const { label, cls, dot } = map[status] ?? map.Awaiting_High_Res_Asset;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${cls}`}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            status === "Awaiting_High_Res_Asset"
              ? "animate-pulse bg-amber-400"
              : status === "Ready_For_Photographer_Print"
              ? "bg-emerald-400"
              : "bg-blue-400"
          }`}
        />
      )}
      {status === "Completed" && (
        <span className="material-symbols-outlined text-[13px]">
          check_circle
        </span>
      )}
      {label}
    </span>
  );
}

function PaymentBadge({ paid }: { paid: boolean }) {
  return paid ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-400">
      שולם
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-400">
      ממתין
    </span>
  );
}

// ─── Mobile card ─────────────────────────────────────────────────────────────

function OrderCard({
  order,
  markingId,
  onMark,
  onWhatsApp,
}: {
  order: Order;
  markingId: string | null;
  onMark: (id: string) => void;
  onWhatsApp: (order: Order) => void;
}) {
  const paid = isPaid(order);
  return (
    <div className="glass-card relative overflow-hidden rounded-2xl p-4">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="font-bold text-primary">{order.guest_name ?? "אורח"}</h3>
          <p className="text-xs text-on-surface-variant" dir="ltr">
            {order.guest_phone ?? ""}
          </p>
        </div>
        <PaymentBadge paid={paid} />
      </div>

      {/* Details row */}
      <div className="flex items-center gap-4 border-y border-white/5 py-2.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-tight text-on-surface-variant">
            סוג הדפסה
          </span>
          <span className="text-sm font-medium">
            {FORMAT_LABEL[order.format]}
            {order.quantity > 1 && (
              <span className="ms-1 text-xs text-on-surface-variant">
                ×{order.quantity}
              </span>
            )}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 border-e border-white/10 pe-4">
          <span className="text-[10px] uppercase tracking-tight text-on-surface-variant">
            סטטוס
          </span>
          <StatusBadge status={order.order_status} />
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        <p className="text-[11px] text-on-surface-variant">
          {formatDate(order.created_at)}
        </p>
        <div className="flex gap-2">
          {order.order_status === "Ready_For_Photographer_Print" && (
            <button
              onClick={() => onMark(order.id)}
              disabled={markingId === order.id}
              className="rounded-xl bg-primary/10 p-2 text-primary transition-transform active:scale-90 disabled:opacity-50"
              title="סמן כהודפס"
            >
              <span className="material-symbols-outlined text-[20px]">print</span>
            </button>
          )}
          {!paid && (
            <button
              onClick={() => onWhatsApp(order)}
              className="flex items-center gap-1.5 rounded-xl border border-[#25D366]/30 bg-[#25D366]/10 px-3 py-2 text-xs font-bold text-[#25D366] transition-all active:scale-90"
            >
              <span className="material-symbols-outlined text-[18px]">chat</span>
              תזכורת
            </button>
          )}
          {order.order_status === "Completed" && (
            <span className="rounded-full bg-surface-container px-3 py-1 text-[11px] text-on-surface-variant">
              {order.marked_printed_at
                ? `הודפס ${new Date(order.marked_printed_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}`
                : "הושלם"}
            </span>
          )}
          <button className="rounded-xl bg-white/5 p-2 text-on-surface transition-transform active:scale-90">
            <span className="material-symbols-outlined text-[20px]">
              more_vert
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Desktop table row ───────────────────────────────────────────────────────

function OrderRow({
  order,
  markingId,
  onMark,
  onWhatsApp,
}: {
  order: Order;
  markingId: string | null;
  onMark: (id: string) => void;
  onWhatsApp: (order: Order) => void;
}) {
  const paid = isPaid(order);
  const isReady =
    order.order_status === "Ready_For_Photographer_Print";
  const isPending = order.order_status === "Awaiting_High_Res_Asset";
  const isDone = order.order_status === "Completed";

  return (
    <tr className="border-b border-white/5 transition-colors hover:bg-white/[0.02]">
      {/* Guest */}
      <td className="px-4 py-3 text-end">
        <div className="flex items-center justify-end gap-3">
          <div className="text-end">
            <div className="font-medium text-on-surface">
              {order.guest_name ?? "אורח"}
            </div>
            {order.guest_phone && (
              <div className="text-xs text-on-surface-variant" dir="ltr">
                {order.guest_phone}
              </div>
            )}
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-container-highest text-sm font-bold text-primary">
            {guestInitial(order.guest_name)}
          </div>
        </div>
      </td>
      {/* Qty */}
      <td className="px-4 py-3 text-center text-on-surface-variant">
        {order.quantity}
      </td>
      {/* Status */}
      <td className="px-4 py-3 text-center">
        <StatusBadge status={order.order_status} />
      </td>
      {/* Payment */}
      <td className="px-4 py-3 text-center">
        <PaymentBadge paid={paid} />
      </td>
      {/* Date */}
      <td className="px-4 py-3 text-center text-xs text-on-surface-variant">
        {formatDate(order.created_at)}
      </td>
      {/* Action */}
      <td className="px-4 py-3 text-start">
        <div className="flex items-center justify-start gap-2">
          {isReady && (
            <button
              onClick={() => onMark(order.id)}
              disabled={markingId === order.id}
              className="rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-on-primary transition-all active:scale-95 disabled:opacity-50"
            >
              {markingId === order.id ? "..." : "סמן כהודפס"}
            </button>
          )}
          {isPending && !paid && (
            <button
              onClick={() => onWhatsApp(order)}
              className="flex items-center gap-1.5 rounded-lg border border-[#25D366]/30 bg-[#25D366]/10 px-3 py-1.5 text-xs font-bold text-[#25D366] transition-all hover:brightness-110 active:scale-95"
            >
              <span className="material-symbols-outlined text-[16px]">chat</span>
              תזכורת בוואטסאפ
            </button>
          )}
          {isPending && paid && (
            <button
              disabled
              className="cursor-not-allowed rounded-lg border border-white/10 px-4 py-1.5 text-xs font-bold text-on-surface-variant opacity-40"
            >
              סמן כהודפס
            </button>
          )}
          {isDone && (
            <span className="rounded-full bg-surface-container px-3 py-1 text-xs text-on-surface-variant">
              {order.marked_printed_at
                ? `הודפס ב-${new Date(order.marked_printed_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}`
                : "הושלם"}
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PrintQueuePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [waOrder, setWaOrder] = useState<Order | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  async function getToken() {
    const sb = createSupabaseBrowserClient();
    const {
      data: { session },
    } = await sb.auth.getSession();
    return session?.access_token ?? null;
  }

  async function fetchEvents() {
    const sb = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return;
    const { data } = await sb
      .from("events")
      .select("id, name")
      .eq("photographer_id", user.id)
      .order("created_at", { ascending: false });
    const evList = (data ?? []) as { id: string; name: string }[];
    setEvents(evList);
    if (evList.length > 0 && !selectedEvent) {
      setSelectedEvent(evList[0].id);
    }
  }

  async function fetchOrders(token: string, eventId: string) {
    setLoading(true);
    const params =
      statusFilter !== "all" ? `?status=${statusFilter}` : "";
    const res = await fetch(
      `${API_BASE_URL}/admin/events/${eventId}/orders${params}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = await res.json();
    setOrders(data.orders ?? []);
    setLoading(false);
  }

  async function handleSync() {
    setSyncing(true);
    await new Promise((r) => setTimeout(r, 1500));
    if (selectedEvent) {
      const token = await getToken();
      if (token) await fetchOrders(token, selectedEvent);
    }
    setSyncing(false);
  }

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedEvent) return;
    getToken().then((token) => {
      if (token) fetchOrders(token, selectedEvent);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEvent, statusFilter]);

  async function markPrinted(orderId: string) {
    const token = await getToken();
    if (!token) return;
    setMarkingId(orderId);
    const res = await fetch(
      `${API_BASE_URL}/admin/orders/${orderId}/mark-printed`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (res.ok) {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                order_status: "Completed" as const,
                marked_printed_at: new Date().toISOString(),
              }
            : o
        )
      );
    }
    setMarkingId(null);
  }

  // Derived counts
  const pendingCount = orders.filter(
    (o) => o.order_status === "Awaiting_High_Res_Asset"
  ).length;
  const readyCount = orders.filter(
    (o) => o.order_status === "Ready_For_Photographer_Print"
  ).length;
  const doneCount = orders.filter(
    (o) => o.order_status === "Completed"
  ).length;

  const filteredOrders =
    statusFilter === "all"
      ? orders
      : orders.filter((o) => o.order_status === statusFilter);

  const ordersByFormat = FORMAT_GROUPS.map((fmt) => ({
    format: fmt,
    label: FORMAT_LABEL[fmt],
    orders: filteredOrders.filter((o) => o.format === fmt),
  })).filter((g) => g.orders.length > 0);

  const selectedEventName =
    events.find((e) => e.id === selectedEvent)?.name ?? "אירוע";

  return (
    <>
      {/* Inline styles for glassmorphism (no CDN) */}
      <style>{`
        .glass-card {
          background: rgba(44,47,51,0.4);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.08);
        }
      `}</style>

      <AdminShell active="תור הדפסות">
        <div
          className="mx-auto max-w-5xl px-4 py-8"
          dir="rtl"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {/* ── Header ── */}
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            {/* Title + event selector */}
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-bold text-on-surface">
                תור הדפסות
              </h1>
              <p className="text-sm text-on-surface-variant">
                ניהול הזמנות והדפסות לאירוע הנוכחי
              </p>
              {events.length > 1 && (
                <select
                  value={selectedEvent}
                  onChange={(e) => setSelectedEvent(e.target.value)}
                  className="mt-1 w-fit rounded-xl border border-outline-variant bg-surface-container px-3 py-1.5 text-sm text-on-surface focus:outline-none"
                >
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => downloadCSV(filteredOrders)}
                className="flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-bold text-on-surface/80 transition-all hover:border-primary/50 hover:text-primary active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px]">
                  description
                </span>
                ייצוא לדוח CSV
              </button>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary shadow-lg shadow-primary/10 transition-all active:scale-95 disabled:opacity-70"
              >
                <span
                  className={`material-symbols-outlined text-[18px] ${syncing ? "animate-spin" : ""}`}
                >
                  sync
                </span>
                סנכרן קבצים
              </button>
            </div>
          </div>

          {/* ── Status chips ── */}
          <div className="mb-5 flex flex-wrap gap-2">
            {(
              [
                { key: "all" as StatusFilter, label: "הכל", count: orders.length },
                {
                  key: "Awaiting_High_Res_Asset" as StatusFilter,
                  label: "ממתין לקובץ",
                  count: pendingCount,
                },
                {
                  key: "Ready_For_Photographer_Print" as StatusFilter,
                  label: "מוכן להדפסה",
                  count: readyCount,
                },
                {
                  key: "Completed" as StatusFilter,
                  label: "הושלם",
                  count: doneCount,
                },
              ] as { key: StatusFilter; label: string; count: number }[]
            ).map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  statusFilter === key
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "border border-white/5 bg-surface-container text-on-surface-variant hover:bg-surface-variant"
                }`}
              >
                {label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    statusFilter === key
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container-highest text-on-surface-variant"
                  }`}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>

          {/* ── Warning banner ── */}
          {pendingCount > 0 && !bannerDismissed && (
            <div className="glass-card mb-6 flex items-start gap-4 rounded-xl border-s-4 border-s-primary p-4">
              <div className="rounded-lg bg-primary/20 p-2">
                <span className="material-symbols-outlined text-primary">
                  warning
                </span>
              </div>
              <p className="flex-1 text-sm text-on-surface">
                <strong>{pendingCount} הזמנות ממתינות לקובץ מקורי.</strong>{" "}
                כשתסנכרן את הקבצים המקוריים, ההזמנות יעברו אוטומטית למצב מוכן
                להדפסה.
              </p>
              <button
                onClick={() => setBannerDismissed(true)}
                className="text-on-surface-variant transition-colors hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          )}

          {/* ── Content ── */}
          {loading ? (
            <div className="py-20 text-center text-on-surface-variant">
              טוען הזמנות...
            </div>
          ) : ordersByFormat.length === 0 ? (
            <div className="glass-card rounded-2xl py-16 text-center text-on-surface-variant">
              <span className="material-symbols-outlined mb-2 block text-4xl">
                print
              </span>
              אין הזמנות בסטטוס זה
            </div>
          ) : (
            <div className="space-y-8">
              {ordersByFormat.map(({ format, label, orders: groupOrders }) => {
                const total = groupOrders.reduce(
                  (s, o) => s + o.quantity,
                  0
                );
                return (
                  <section key={format}>
                    {/* Section header */}
                    <div className="mb-3 flex items-center justify-between border-b border-white/5 pb-2">
                      <h2 className="flex items-center gap-2 text-base font-bold text-on-surface">
                        {label}
                        <span className="text-sm font-normal text-on-surface-variant">
                          ({total} יחידות)
                        </span>
                      </h2>
                      <span className="material-symbols-outlined cursor-pointer text-on-surface-variant transition-colors hover:text-primary">
                        filter_list
                      </span>
                    </div>

                    {/* Desktop table */}
                    <div className="glass-card hidden overflow-hidden rounded-xl md:block">
                      <table className="w-full text-sm">
                        <thead className="border-b border-white/5 bg-white/5 text-[11px] uppercase tracking-wider text-on-surface-variant">
                          <tr>
                            <th className="px-4 py-3 text-end">אורח</th>
                            <th className="px-4 py-3 text-center">כמות</th>
                            <th className="px-4 py-3 text-center">סטטוס</th>
                            <th className="px-4 py-3 text-center">
                              סטטוס תשלום
                            </th>
                            <th className="px-4 py-3 text-center">תאריך</th>
                            <th className="px-4 py-3 text-start">פעולה</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupOrders.map((order) => (
                            <OrderRow
                              key={order.id}
                              order={order}
                              markingId={markingId}
                              onMark={markPrinted}
                              onWhatsApp={setWaOrder}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="flex flex-col gap-3 md:hidden">
                      {groupOrders.map((order) => (
                        <OrderCard
                          key={order.id}
                          order={order}
                          markingId={markingId}
                          onMark={markPrinted}
                          onWhatsApp={setWaOrder}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>

        {/* FAB */}
        <button
          onClick={() => window.print()}
          className="fixed bottom-24 start-6 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-container text-on-primary-container shadow-2xl transition-transform active:scale-90"
          title="הדפסה"
        >
          <span className="material-symbols-outlined text-3xl">print</span>
        </button>
      </AdminShell>

      {/* WhatsApp modal */}
      {waOrder && (
        <WhatsAppModal order={waOrder} onClose={() => setWaOrder(null)} />
      )}
    </>
  );
}
