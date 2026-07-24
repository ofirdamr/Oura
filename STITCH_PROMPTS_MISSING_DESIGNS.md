# Stitch Prompts — Missing Designs (freehanded pages to redesign)

These code pages were built **without a Stitch design source** (freehanded by a
previous Claude session — a violation of the "never design visuals directly"
rule). Each prompt below is ready to paste into the **existing Oura project in
Stitch** so the design stays consistent with the other 42 screens. Run each,
export the `screen.png` into `design/screens/oura_final_production_<name>_<desktop|mobile>/`,
then the code gets re-wired 1:1 to the real design and the freehanded version is deleted.

**Oura design language (include in every prompt):** dark near-black background,
coral/salmon primary accent `#FF8A75`, "Platinum Edition" premium feel, Hebrew-first
RTL layout, Rubik font, rounded 2xl cards, Material Symbols outlined icons, subtle
borders and soft shadows.

---

## 1. Login — `oura_final_production_login_mobile` + `_desktop`

> Design a **login screen** for Oura, a premium event-photography SaaS, in Hebrew (RTL).
> Dark near-black background, coral accent #FF8A75, Rubik font, "Platinum Edition" premium feel.
> Centered card with the Oura logo at top, a Hebrew heading "התחברות", email field (אימייל),
> password field (סיסמה), a primary coral "התחבר" button, a "שכחת סיסמה?" text link,
> and a secondary "אין לך חשבון? הרשמה" link at the bottom. One viewport tall, card
> vertically centered, mobile-first but also a desktop variant. Rounded 2xl inputs and card.

## 2. Signup — `oura_final_production_signup_mobile` + `_desktop`

> Design a **signup / registration screen** for Oura (Hebrew, RTL). Same dark premium
> style, coral #FF8A75, Rubik. Centered card: Oura logo, heading "הרשמה לסטודיו",
> studio-name field (שם הסטודיו), email (אימייל), password (סיסמה), confirm-password
> (אימות סיסמה), primary coral "צור חשבון" button, and "כבר יש לך חשבון? התחברות" link.
> Mobile + desktop variants.

## 3. Forgot Password — `oura_final_production_forgot_password_mobile` + `_desktop`

> Design a **forgot-password screen** for Oura (Hebrew, RTL). Dark premium, coral #FF8A75,
> Rubik. Centered card: heading "שחזור סיסמה", short explanatory line, single email field
> (אימייל), primary coral "שלח קישור לאיפוס" button, and a "חזרה להתחברות" back link.
> Mobile + desktop.

## 4. Reset Password — `oura_final_production_reset_password_mobile` + `_desktop`

> Design a **reset-password screen** for Oura (Hebrew, RTL). Dark premium, coral #FF8A75,
> Rubik. Centered card: heading "בחירת סיסמה חדשה", new-password field (סיסמה חדשה),
> confirm field (אימות סיסמה), primary coral "עדכן סיסמה" button. Mobile + desktop.

## 5. Consent (biometric) — `oura_final_production_consent_mobile` + `_desktop`

> Design a **biometric-consent gate** for Oura guests (Hebrew, RTL). Dark premium, coral
> #FF8A75, Rubik. Full-screen mobile-first. A friendly face/scan illustration or icon at
> top, heading "זיהוי הפנים שלך", a clear explanation that the guest's selfie is used only
> to find their photos and is handled per privacy law (Israeli Amendment 13 tone — trust,
> not scary), a prominent primary coral "אני מאשר/ת" button and a secondary "לא תודה,
> המשך ללא זיהוי" option. Emphasize privacy and consent. Mobile + desktop.

## 6. Selfie capture — `oura_final_production_selfie_mobile` + `_desktop`

> Design a **selfie-capture screen** for Oura guests (Hebrew, RTL). Dark premium, coral
> #FF8A75, Rubik. Full-screen camera viewport with a centered circular face-guide overlay,
> heading "צלם/י סלפי", short hint "מרכז/י את הפנים במסגרת", a large circular coral capture
> button at the bottom, and a small "החלף מצלמה" toggle. Mobile-first (this is a phone flow);
> include a desktop fallback variant.

## 7. Join / event entry — `oura_final_production_join_mobile` + `_desktop`

> Design a **guest join screen** for Oura where a guest enters an event code (Hebrew, RTL).
> Dark premium, coral #FF8A75, Rubik. Centered card: Oura logo, heading "הצטרפות לאירוע",
> a short line, a single large event-code input (קוד אירוע), and a primary coral "המשך"
> button. Mobile + desktop.

## 8. Checkout — `oura_final_production_checkout_mobile` + `_desktop`

> (Its previous design was removed as mismatched — this replaces it.)
> Design a **checkout / payment screen** for Oura print orders (Hebrew, RTL). Dark premium,
> coral #FF8A75, Rubik. Order-summary card (item thumbnails, quantities, prices in ₪),
> shipping-details fields (שם מלא, כתובת, טלפון), a total row, and a primary coral
> "לתשלום מאובטח" button. Mobile + desktop.

## 9. Print Queue (admin) — `oura_final_production_print_queue_mobile` + `_desktop`

> Design a **print-queue admin screen** for Oura photographers (Hebrew, RTL). Dark premium,
> coral #FF8A75, Rubik, inside the admin shell layout. A table/list of print orders each
> showing guest name, product (הדפסה/מגנט/אלבום), quantity, status chip (ממתין/מוכן/נשלח),
> and an action button per row. Header with title "תור הדפסות" and status filters.
> Desktop table + mobile stacked-card variants.

## 10. Event Detail (admin) — `oura_final_production_event_detail_mobile` + `_desktop`

> Design an **event-detail admin screen** for Oura (Hebrew, RTL) — the page a photographer
> sees when opening one event from the list. Dark premium, coral #FF8A75, Rubik, admin shell.
> Header with event name + date + status, stat row (תמונות, אורחים, צפיות), a photo grid
> preview, and action buttons (מיתוג, QR, דוחות). Desktop + mobile variants.

---

**After each design is exported to `design/screens/`:** re-implement the matching
code page 1:1 to the real Stitch screen, then delete the freehanded version.
