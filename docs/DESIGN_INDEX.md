# DESIGN_INDEX — Stitch screens ⇆ wired routes ⇆ navigation

**Purpose:** the single economical lookup for "which Stitch screen is which, where
it lives in code, and how you reach it." Built to stop wiring/auditing *by
association*. Source of truth for a screen's look is always its
`design/screens/<folder>/screen.png` (+ `code.html`), never the folder name — a
name/content mismatch has happened before (see `CLAUDE.md`).

> **Every screen has TWO Stitch sources — `*_desktop` and `*_mobile` — with
> materially different layouts, not one responsive collapse.** Fidelity means
> matching each at its own breakpoint. A route that only narrows the desktop tree
> is NOT matched on mobile. The status column below reflects desktop unless noted;
> mobile fidelity is a separate, still-open check for every 🔵/🟠 route.

Status legend:
- ✅ **wired + verified faithful this session**
- 🔵 **wired** (exists as a real route; visual fidelity per prior sessions, not re-diffed here)
- 🟠 **wired but static/stub** (UI only, no real backend/persistence, or an orphan with no inbound link)
- ⚪ **not wired — correctly deferred** (Phase 2/3 per `PRD.md` §4)
- 🔴 **not wired — Phase-1 gap** (belongs in the current MVP but has no route)
- ➕ **wired, no source in the 42-screen export** (designed fresh or from a later export)

---

## 1. Screen index (42 Stitch screens → routes)

Mobile folders are the responsive variant of the same screen and share the route.

### Photographer Admin
| # | Screen | Stitch folder(s) | Wired route | Status | Phase |
|---|--------|------------------|-------------|--------|-------|
| 1 | Dashboard | `dashboard_desktop_1/2/3`, `dashboard_mobile_1/2/3` | `/admin` | 🔵 | 1 |
| 2 | Event List | `event_list_desktop_1/2/3`, `event_list_mobile_1/2/3` | `/admin/events` | 🔵 | 1 |
| 3 | Branding Settings | `branding_settings_desktop_1/2/3`, `branding_settings_mobile_1/2/3` | `/admin/branding` | 🔵 | 1 |
| 4 | AI Optimization | `ai_optimization_desktop_1/2`, `ai_optimization_mobile` | `/admin/ai-optimization` | 🟠 UI only, no pipeline | 3 |
| 5 | Statistics & Analytics | `statistics_desktop_1/2/3`, `statistics_mobile_1/2` | — | ⚪ | 2 |
| 6 | Messaging Center | `messaging_center_desktop/mobile` | — | ⚪ | 2 |
| 7 | Create New Event | `create_event_desktop` | `/admin/create-event` | 🔵 | 1 |
| 8 | Barcode/QR Management | `barcode_management_desktop/mobile` | `/admin/qr-management` | ✅ desktop · 🟠 mobile (shared nav fixed, page content still desktop-collapsed) | 1 |
| 9 | Notification Center | `notification_center_desktop/mobile` | — | ⚪ | 2 |
| 10 | Reports Management | `reports_management_desktop/mobile` | — | ⚪ | 2 |
| 11 | Event Book Designer | `event_book_designer_desktop` | — | ⚪ | 2/3 |
| 12 | Studio Profile | `studio_profile_desktop` | — | ⚪ | 2 |

### Guest Experience
| # | Screen | Stitch folder(s) | Wired route | Status | Phase |
|---|--------|------------------|-------------|--------|-------|
| 22 | Landing Page | `guest_landing_page_desktop_1/2`, `guest_landing_page_mobile` | — (`/` just redirects to `/gallery-entry`) | 🔴 gap | 1 |
| 23 | Gallery Entry | `gallery_entry_desktop/mobile` | `/gallery-entry` | 🔵 | 1 |
| 24 | Festive Gallery | `festive_gallery_desktop_1/2/3`, `festive_gallery_mobile_1/2` | `/festive-gallery` | 🟠 orphan, no inbound link | 1 |
| 25 | Minimal Gallery | `minimal_gallery_desktop/mobile` | `/minimal-gallery` | 🟠 orphan, no inbound link | 1 |
| 26 | Personal Gallery | `personal_gallery_desktop_1/2`, `personal_gallery_mobile` | `/gallery` | 🔵 | 1 |
| 27 | Photo Editor | `photo_editor_desktop/mobile` | `/photo-editor` | 🟠 static, no persistence | 1 |
| 28 | Premium Prints | `premium_prints_desktop/mobile` | — | ⚪ | 2 |
| 29 | 3D Gift Box Reveal | `gift_box_reveal_desktop/mobile` | `/gift-reveal` | 🔵 | 1 |
| 30 | Checkout | `checkout_desktop/mobile` | — | ⚪ **payment** | 2 |
| 31 | Order Confirmation | `order_confirmation_desktop/mobile` | — | ⚪ | 2 |

### Marketing
| # | Screen | Stitch folder(s) | Wired route | Status | Phase |
|---|--------|------------------|-------------|--------|-------|
| 42 | Digital Brochure | `digital_brochure` | — | ⚪ | 3 |

### ➕ Wired routes with NO source in the 42-screen export
| Route | Origin | Notes |
|-------|--------|-------|
| `/consent` | designed fresh | biometric-consent gate; `CLAUDE.md` flagged it missing from the export |
| `/selfie` | later Stitch export | brought in during Stage 2 face-matching |
| `/join` | orphan | early code-entry screen, superseded by `/gallery-entry`; no inbound link |
| `/login` `/signup` `/forgot-password` `/reset-password` | auth screens | not part of the 42-screen product export |

---

## 2. Navigation / linking map (what button goes where)

Derived from actual `href` / `router.push` / `redirect` in `apps/web/app`, not memory.

### Guest flow
```
/  ──redirect──▶  /gallery-entry
/gallery-entry  ──enter or scan code──▶  /consent
/consent  ──accept──▶ /selfie      ──decline/skip──▶ /gallery      ──no token──▶ /gallery-entry
/selfie   ──complete/skip──▶ /gift-reveal   ──skip to gallery──▶ /gallery   ──error/no consent──▶ /consent
/gift-reveal  ──"view gallery" button──▶  /gallery
/gallery  ──(guards)──▶ /consent  or  /gallery-entry
```

### Photographer flow
```
/login   ──success──▶ /admin        links ▶ /forgot-password, /signup
/signup  ──success──▶ /admin        link  ▶ /login
/forgot-password ─▶ /login
/reset-password  ──success──▶ /admin   link ▶ /forgot-password

/admin (dashboard) ─▶ /admin/events, /admin/create-event
AdminShell sidebar:  לוח בקרה▶/admin   אירועים פעילים▶/admin/events
                     ⚠ DEAD (href:null): ארכיון אירועים · לקוחות VIP · ניתוח נתונים
                     header buttons ▶ /admin/create-event, /admin/branding

/admin/events ─▶ /admin/create-event, /admin/events/[event_id]
/admin/events/[event_id] ─▶ /admin/events            ⚠ does NOT link to QR management
/admin/create-event ──submit──▶ /admin/branding?event_id=…     link ▶ /admin
/admin/branding ──submit──▶ /admin/qr-management?event_id=…     links ▶ /admin, /admin/create-event
/admin/qr-management ─▶ /admin/events/[event_id], /admin/branding?event_id=…
```

**Key navigation gaps (real, in code today):**
- **QR management is a dead-end reachable only by re-running create→brand.** Nothing
  in the sidebar links to it, and the event-detail page (`/admin/events/[event_id]`)
  has no "view QR" link — so a photographer cannot re-open an existing event's QR
  without going through branding again.
- **Three dead sidebar links** (`ארכיון אירועים`, `לקוחות VIP`, `ניתוח נתונים`) render
  as non-navigating items — they map to Phase-2 screens (Statistics etc.) that aren't
  built yet.
- **Guest Landing Page (Stitch #22/#32) is not wired** — `/` redirects straight to
  `/gallery-entry`, so the designed landing screen never renders. Phase-1 gap.

---

## 3. QR-management finding (the one you flagged)

The wired `/admin/qr-management/page.tsx` **is a faithful port** of
`barcode_management_desktop/screen.png`: same success header (`האירוע נוצר בהצלחה!`),
QR-right / controls-left two-column layout, print dropdown, `הצגה על מסך מלא`,
`הורדה כקובץ PNG`, digital-share grid (WhatsApp green + Email/Telegram/Instagram),
direct-link box, `ID:` pill, and the `מעבר לניהול האירוע` / `עריכת פרטי הגלריה` footer.
The QR itself is a real scannable code generated client-side.

**Mobile, however, does NOT match.** `barcode_management_mobile/screen.png` is a
distinct layout — event-title header (`חתונה של נועה ועידן`) instead of the success
header, the QR inside a phone mockup, colored app icons instead of text share
buttons, a `הדפסת קוד` / `הורדה כתמונה` button pair, and a bottom tab bar
(`הגדרות · גלריה · ברקוד · בית`). The wired page only collapses the desktop grid to
one column, so on a phone it reproduces none of that — the more likely reason it
"looks totally different" than desktop drift.

**Update:** `AdminShell`'s mobile nav is now fixed (bottom tab bar replacing the
hamburger-only drawer, live as of the `AdminShell.tsx` fix below) — every admin
screen now gets a correctly-highlighted primary nav on mobile. QR-management's
own page content (event-title header, phone-mockup QR, share icons) still
collapses the desktop grid rather than matching `barcode_management_mobile`'s
distinct layout — that page-content gap is still open, tracked separately from
the shared-nav fix.

If it also looks wrong **on desktop / the live site**, the likely cause is the
**documented deploy gap** (the Worker froze on an old build once before — see
`SUMMARY.md` 2026-07-06 and `MISTAKES.md`), i.e. the good code above was never
what shipped. This needs a live re-verify (deployed chunk hash vs. local build)
before assuming a code bug. One real code deviation vs. Stitch: the Stitch screen
uses a centered **top nav** (`גלריה · אירועים · הגדרות`); the wired page uses the
`AdminShell` sidebar instead.

## 4. Payment / commerce (why it should NOT exist yet)

There is **no payment/checkout/prints page anywhere on this branch** — no route, no
component, no Stripe reference. That is correct: `PRD.md` §4 puts **Checkout, Premium
Prints, and Order Confirmation in Phase 2** ("Stripe Billing + Checkout, Premium
Prints → Checkout → Order Confirmation, print-on-demand + commission ledger"). The
current milestone is finishing the Phase-1 MVP. Building the payment flow now would
jump ahead of the PRD; it should be driven by the Phase-2 kickoff, not by a passing
mention. Open Phase-2 questions that gate it: final ILS pricing, print-fulfillment
partner, and whether Stripe Connect is needed (`PRD.md` §8).

## 5. AdminShell mobile nav — fixed (2026-07-10)

`AdminShell` (shared by every `/admin/*` screen) had no mobile bottom-tab nav —
only a hamburger drawer. Checked 9 mobile Stitch admin screens
(`dashboard_mobile_1/2/3`, `barcode_management_mobile`, `ai_optimization_mobile`,
`statistics_mobile_2`, `messaging_center_mobile`, `event_list_mobile_2/3`);
5 of them show a persistent bottom tab bar as their primary nav. But the export
disagreed with itself: tab labels differed screen to screen (dashboard:
`פרופיל·שיתוף·בית·גלריה`; QR: `הגדרות·גלריה·ברקוד·בית`; AI-optimization:
`הגדרות·גלריה·AI·ראשי`), and on 2 of 5 screens the highlighted "active" tab
didn't match the actual current page (dashboard highlighted גלריה, not itself;
AI-optimization highlighted ראשי, not AI) — an inconsistency in the source, not
a deliberate per-screen design (same category as the known folder-name/content
mismatches).

**Resolution (founder-directed: derive the logic since Stitch's own export
doesn't have one):** built the bar from the codebase's own existing
active-section grouping, already used by every `<AdminShell active=...>` call
site — בית (dashboard) · אירועים (events/create-event/qr-management/
event-detail) · central **+** (create-event, matching Stitch's own recurring
floating-action-button pattern) · הגדרות (branding/ai-optimization). Every
screen's tab now highlights correctly by construction, since it's driven by
the same `active` prop the page already passes. Live in `AdminShell.tsx`.
