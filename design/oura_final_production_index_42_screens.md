# Oura — Final Production Inventory (42 Screens)

Definitive list of the 42 unique Stitch screens, all with "Photo Santos" branding,
Aperture O logo, and high-contrast Hebrew/RTL UI.

> **HOW TO FIND A DESIGN (read this before ever saying "there is no design").**
> Every screen is a folder on disk at
> `design/screens/oura_final_production_<name>_<desktop|mobile>[_N]/screen.png`.
> The paths below are the **source of truth** — open the `screen.png`.
> The old `{{DATA:SCREEN:SCREEN_###}}` tokens were Stitch export IDs, **not file
> paths**, and they resolve to nothing on disk — that broken mapping is what made
> past sessions wrongly conclude a screen "had no design" and freehand it.
> **Never conclude a design is missing from this index alone — run
> `ls design/screens/` first.** And per CLAUDE.md, trust the `screen.png`
> *content*, not the folder name (some folders are misnamed, see Photo Editor).

## 1. Photographer Admin (Desktop)
1. **Dashboard** — `oura_final_production_dashboard_desktop_1|2|3` (3 variants)
2. **Event List** — `oura_final_production_event_list_desktop_1|2|3`
3. **Branding Settings** — `oura_final_production_branding_settings_desktop_1|2|3`
4. **AI Optimization** — `oura_final_production_ai_optimization_desktop_1|2`
5. **Statistics & Analytics** — `oura_final_production_statistics_desktop_1|2|3`
6. **Messaging Center** — `oura_final_production_messaging_center_desktop`
7. **Create New Event** — `oura_final_production_create_event_desktop`
8. **Barcode/QR Management** — `oura_final_production_barcode_management_desktop`
9. **Notification Center** — `oura_final_production_notification_center_desktop`
10. **Reports Management** — `oura_final_production_reports_management_desktop`
11. **Event Book Designer** — `oura_final_production_event_book_designer_desktop`
12. **Studio Profile** — `oura_final_production_studio_profile_desktop`

## 2. Photographer Admin (Mobile)
13. **Dashboard** — `oura_final_production_dashboard_mobile_1|2|3`
14. **Event List** — `oura_final_production_event_list_mobile_1|2|3`
15. **Branding Settings** — `oura_final_production_branding_settings_mobile_1|2|3`
16. **AI Optimization** — `oura_final_production_ai_optimization_mobile`
17. **Statistics** — `oura_final_production_statistics_mobile_1|2`
18. **Messaging Center** — `oura_final_production_messaging_center_mobile`
19. **Barcode/QR Management** — `oura_final_production_barcode_management_mobile`
20. **Notification Center** — `oura_final_production_notification_center_mobile`
21. **Reports Management** — `oura_final_production_reports_management_mobile`

## 3. Guest Experience (Desktop)
22. **Landing Page** — `oura_final_production_guest_landing_page_desktop_1|2`
23. **Gallery Entry** — `oura_final_production_gallery_entry_desktop`
24. **Festive Gallery** — `oura_final_production_festive_gallery_desktop_1|2|3`
25. **Minimal Gallery** — `oura_final_production_minimal_gallery_desktop`
26. **Personal Gallery** — `oura_final_production_personal_gallery_desktop_1|2`
27. **Photo Editor** — `oura_final_production_photo_editor_desktop`
    ⚠️ *Content note:* this `screen.png` shows the **branded gallery** — photos with
    the photographer's studio name ("PHOTO SANTOS") baked onto each corner, **no
    "powered by Oura" line** — not a slider/adjust tool. Match the content, not the name.
28. **Premium Prints** — `oura_final_production_premium_prints_desktop`
29. **3D Gift Box Reveal** — `oura_final_production_gift_box_reveal_desktop`
30. **Checkout** — `oura_final_production_checkout_desktop`
31. **Order Confirmation** — `oura_final_production_order_confirmation_desktop`

## 4. Guest Experience (Mobile)
32. **Landing Page** — `oura_final_production_guest_landing_page_mobile`
33. **Gallery Entry** — `oura_final_production_gallery_entry_mobile`
34. **Festive Gallery** — `oura_final_production_festive_gallery_mobile_1|2`
35. **Minimal Gallery** — `oura_final_production_minimal_gallery_mobile`
36. **Personal Gallery** — `oura_final_production_personal_gallery_mobile`
37. **Photo Editor** — `oura_final_production_photo_editor_mobile` (same branded-gallery content as #27)
38. **Premium Prints** — `oura_final_production_premium_prints_mobile`
39. **3D Gift Box Reveal** — `oura_final_production_gift_box_reveal_mobile`
40. **Checkout** — `oura_final_production_checkout_mobile`
41. **Order Confirmation** — `oura_final_production_order_confirmation_mobile`

## 5. Marketing
42. **Digital Brochure** — `oura_final_production_digital_brochure`

---
*Every folder above exists under `design/screens/`. All were prefixed
`Oura_Final_Production_` in the original ZIP export.*
