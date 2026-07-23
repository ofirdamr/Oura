"use client";

import React, { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { API_BASE_URL } from "@/lib/api";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

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

const FORMAT_LABEL: Record<string, string> = {
  magnet: "מגנט",
  print_10x15: 'הדפסה 10×15',
  block: "בלוק",
  photo_book: "ספר תמונות",
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  Awaiting_High_Res_Asset: { label: "ממתין לקובץ מקורי", color: "text-amber-400" },
  Ready_For_Photographer_Print: { label: "מוכן להדפסה", color: "text-emerald-400" },
  Dispatched_To_Wholesaler: { label: "נשלח לספק", color: "text-blue-400" },
  Completed: { label: "הושלם", color: "text-zinc-400" },
};

const FORMAT_GROUPS = ["magnet", "print_10x15", "block", "photo_book"] as const;

type StatusFilter = "all" | "Awaiting_High_Res_Asset" | "Ready_For_Photographer_Print" | "Completed";

function exportCsv(rows: Order[]) {
  const headers = ["מספר הזמנה", "אורח", "טלפון", "פורמט", "כמות", "סטטוס", "תאריך"];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    headers.join(","),
    ...rows.map((o) =>
      [
        o.id,
        o.guest_name ?? "אורח",
        o.guest_phone ?? "",
        FORMAT_LABEL[o.format] ?? o.format,
        String(o.quantity),
        STATUS_LABEL[o.order_status]?.label ?? o.order_status,
        new Date(o.created_at).toLocaleDateString("he-IL"),
      ]
        .map(escape)
        .join(",")
    ),
  ];
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `print-queue-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PrintQueuePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>("");

  async function getToken() {
    const sb = createSupabaseBrowserClient();
    const { data: { session } } = await sb.auth.getSession();
    return session?.access_token ?? null;
  }

  async function fetchEvents() {
    const sb = createSupabaseBrowserClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { data } = await sb
      .from("events")
      .select("id, name")
      .eq("photographer_id", user.id)
      .order("created_at", { ascending: false });
    const evList: { id: string; name: string }[] = (data ?? []) as { id: string; name: string }[];
    setEvents(evList);
    if (evList.length > 0 && !selectedEvent) {
      setSelectedEvent(evList[0].id);
    }
  }

  async function fetchOrders(token: string, eventId: string) {
    setLoading(true);
    const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
    const res = await fetch(
      `${API_BASE_URL}/admin/events/${eventId}/orders${params}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();
    setOrders(data.orders ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (!selectedEvent) return;
    getToken().then((token) => {
      if (token) fetchOrders(token, selectedEvent);
    });
  }, [selectedEvent, statusFilter]);

  async function markPrinted(orderId: string) {
    const token = await getToken();
    if (!token) return;
    setMarkingId(orderId);
    const res = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/mark-printed`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setOrders((prev: Order[]) =>
        prev.map((o: Order) =>
          o.id === orderId
            ? { ...o, order_status: "Completed" as const, marked_printed_at: new Date().toISOString() }
            : o
        )
      );
    }
    setMarkingId(null);
  }

  async function downloadTier1() {
    const token = await getToken();
    if (!token || !selectedEvent) return;
    const readyOrders = orders.filter((o: Order) => o.order_status === "Ready_For_Photographer_Print");
    if (readyOrders.length === 0) return;
    const orderIds = readyOrders.map((o: Order) => o.id).join(",");
    const res = await fetch(`${API_BASE_URL}/admin/events/${selectedEvent}/tier1-download?orders=${orderIds}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.files && Array.isArray(data.files)) {
        // Open each file in a new tab for download
        data.files.forEach((file: { url: string; key: string }) => {
          window.open(file.url, '_blank');
        });
      }
    }
  }

  const pendingCount = orders.filter(
    (o: Order) => o.order_status === "Awaiting_High_Res_Asset"
  ).length;
  const readyCount = orders.filter(
    (o: Order) => o.order_status === "Ready_For_Photographer_Print"
  ).length;

  const filteredOrders =
    statusFilter === "all"
      ? orders
      : orders.filter((o: Order) => o.order_status === statusFilter);

  const ordersByFormat = FORMAT_GROUPS.map((fmt) => ({
    format: fmt,
    label: FORMAT_LABEL[fmt],
    orders: filteredOrders.filter((o: Order) => o.format === fmt),
  })).filter((g) => g.orders.length > 0);

  return (
    <AdminShell active="תור הדפסות">
      <div className="mx-auto max-w-5xl px-4 py-8" dir="rtl">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-on-surface">
              תור הדפסות
            </h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              הזמנות הדפסה מאורחים — ממוינות לפי פורמט
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Tier-1 batch download */}
            {readyCount > 0 && (
              <button
                onClick={downloadTier1}
                className="flex items-center gap-2 rounded-xl border border-primary bg-primary px-3 py-2 text-sm text-on-primary hover:bg-primary/90 transition-colors"
              >
                <span className="material-symbols-outlined text-base">cloud_download</span>
                הורד קבצים מקוריים ({readyCount})
              </button>
            )}

            {/* CSV export */}
            {filteredOrders.length > 0 && (
              <button
                onClick={() => exportCsv(filteredOrders)}
                className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container px-3 py-2 text-sm text-on-surface hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined text-base">download</span>
                ייצוא CSV
              </button>
            )}

          {/* Event selector */}
          {events.length > 1 && (
            <select
              value={selectedEvent}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedEvent(e.target.value)}
              className="rounded-xl border border-outline-variant bg-surface-container px-3 py-2 text-sm text-on-surface focus:outline-none"
            >
              {events.map((ev: { id: string; name: string }) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </select>
          )}
          </div>
        </div>

        {/* Alert: pending high-res */}
        {pendingCount > 0 && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
            <span className="material-symbols-outlined text-amber-400">warning</span>
            <div>
              <p className="text-sm font-medium text-amber-300">
                {pendingCount} הזמנה{pendingCount !== 1 ? "ות" : ""} ממתינות לקובץ מקורי
              </p>
              <p className="mt-0.5 text-xs text-amber-400/80">
                כשתסנכרן את הקבצים המקוריים, ההזמנות יעברו אוטומטית למצב "מוכן להדפסה".
              </p>
            </div>
          </div>
        )}

        {/* Stat chips */}
        <div className="mb-6 flex flex-wrap gap-3">
          {[
            { key: "all", label: `הכל (${orders.length})` },
            { key: "Awaiting_High_Res_Asset", label: `ממתין לקובץ (${pendingCount})` },
            { key: "Ready_For_Photographer_Print", label: `מוכן להדפסה (${readyCount})` },
            { key: "Completed", label: `הושלם (${orders.filter((o: Order) => o.order_status === "Completed").length})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key as StatusFilter)}
              className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                statusFilter === key
                  ? "bg-primary text-on-primary"
                  : "border border-outline-variant text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Orders grouped by format */}
        {loading ? (
          <div className="py-20 text-center text-on-surface-variant">טוען הזמנות...</div>
        ) : ordersByFormat.length === 0 ? (
          <div className="rounded-2xl border border-outline-variant bg-surface-container py-16 text-center text-on-surface-variant">
            <span className="material-symbols-outlined mb-2 block text-4xl">print</span>
            אין הזמנות בסטטוס זה
          </div>
        ) : (
          <div className="space-y-8">
            {ordersByFormat.map(({ format, label, orders: groupOrders }) => (
              <section key={format}>
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="font-medium text-on-surface">{label}</h2>
                  <span className="rounded-full bg-surface-container px-2 py-0.5 text-xs text-on-surface-variant">
                    {groupOrders.length}
                  </span>
                </div>
                <div className="overflow-hidden rounded-2xl border border-outline-variant">
                  <table className="w-full text-sm">
                    <thead className="border-b border-outline-variant bg-surface-container/60 text-xs text-on-surface-variant">
                      <tr>
                        <th className="px-4 py-3 text-end">אורח</th>
                        <th className="px-4 py-3 text-end">כמות</th>
                        <th className="px-4 py-3 text-end">סטטוס</th>
                        <th className="px-4 py-3 text-end">תאריך</th>
                        <th className="px-4 py-3 text-end">פעולה</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                      {groupOrders.map((order: Order) => {
                        const st = STATUS_LABEL[order.order_status];
                        return (
                          <tr key={order.id} className="bg-surface hover:bg-surface-container/40 transition-colors">
                            <td className="px-4 py-3 text-end">
                              <div className="font-medium">{order.guest_name ?? "אורח"}</div>
                              {order.guest_phone && (
                                <div className="text-xs text-on-surface-variant" dir="ltr">
                                  {order.guest_phone}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-end text-on-surface-variant">
                              ×{order.quantity}
                            </td>
                            <td className={`px-4 py-3 text-end font-medium ${st.color}`}>
                              {st.label}
                            </td>
                            <td className="px-4 py-3 text-end text-xs text-on-surface-variant">
                              {new Date(order.created_at).toLocaleDateString("he-IL")}
                            </td>
                            <td className="px-4 py-3 text-end">
                              <div className="flex items-center justify-end gap-2">
                                {order.guest_phone && (
                                  <a
                                    href={`https://wa.me/${order.guest_phone.replace(/\D/g, "")}?text=${encodeURIComponent(`שלום ${order.guest_name ?? "אורח"}, ההדפסה שלך מוכנה!`)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>chat</span>
                                    WhatsApp
                                  </a>
                                )}
                                {order.order_status === "Ready_For_Photographer_Print" && (
                                  <button
                                    onClick={() => markPrinted(order.id)}
                                    disabled={markingId === order.id}
                                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-on-primary disabled:opacity-50"
                                  >
                                    {markingId === order.id ? "..." : "סמן כהודפס"}
                                  </button>
                                )}
                                {order.order_status === "Completed" && (
                                  <span className="text-xs text-on-surface-variant">
                                    {order.marked_printed_at
                                      ? new Date(order.marked_printed_at).toLocaleDateString("he-IL")
                                      : "הושלם"}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
