# Oura - Design Specifications & Brand Guidelines

## 1. Brand Identity
**Name:** Oura
**Core Concept:** A premium, AI-driven photography platform that captures the "aura" of every moment.
**Visual Style:** Luxury Minimalism, High-Contrast Dark Mode, Sophisticated Earth Tones.

## 2. Color Palette
| Role | Hex Code | Usage |
| :--- | :--- | :--- |
| **Primary (Accent)** | `#FF8A75` | CTAs, Primary Buttons, Active States, Brand Icon |
| **Background (Base)** | `#121212` | Main page backgrounds |
| **Surface (Low)** | `#1E1E1E` | Secondary containers, Cards, Sidebars |
| **Surface (High)** | `#2D2D2D` | Hover states, Elevated components |
| **On-Background** | `#FFFFFF` | Primary headings and text |
| **On-Surface-Variant**| `#B0B0B0` | Secondary text, Placeholders, Disabled states |
| **Success** | `#4CAF50` | Confirmations, Active events |
| **Error** | `#CF6679` | Error messages, Delete actions |

## 3. Typography
**Font Family:** Hanken Grotesk (Primary), Rubik (Secondary/Hebrew support)

| Level | Size | Weight | Line Height | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Display Large** | 48px | 700 (Bold) | 1.2 | Hero sections, Major impact titles |
| **Headline Medium**| 32px | 600 (Semi-Bold)| 1.3 | Page titles, Modal headers |
| **Title Medium** | 20px | 500 (Medium) | 1.4 | Section headers, Card titles |
| **Body Large** | 16px | 400 (Regular) | 1.6 | Main body copy, Paragraphs |
| **Label Small** | 12px | 500 (Medium) | 1.5 | Captions, Metadata, Button labels |

## 4. Spacing & Grid System
- **Base Unit:** 8px
- **Container Margin:** 24px (Mobile), 80px (Desktop)
- **Gutter:** 16px
- **Stack Spacing:** 16px (Small), 32px (Medium), 64px (Large)
- **Border Radius:** 12px (Standard), 8px (Small inputs), 24px+ (Luxury cards)

## 5. Components Library

### Buttons
- **Primary:** Background `#FF8A75`, Text `#121212`, 500 weight.
- **Secondary:** Border 1px `#FF8A75`, Text `#FF8A75`, Transparent background.
- **States:**
  - *Hover:* Opacity 90%, subtle scale-up (1.02x).
  - *Pressed:* Scale-down (0.98x).
  - *Disabled:* Background `#2D2D2D`, Text `#B0B0B0`.

### Input Fields
- **Background:** `#1E1E1E`
- **Border:** 1px `#2D2D2D`
- **Focus State:** Border 1px `#FF8A75`, subtle outer glow.
- **Typography:** Body Large (16px).

### Cards & Modals
- **Surface:** `#1E1E1E` with subtle 1px border `#2D2D2D`.
- **Shadow:** Elevated (0 10px 30px rgba(0,0,0,0.5)).
- **Transitions:** Ease-in-out, 300ms for modal appearance.

## 6. Functional Prototypes & Flows
1. **Photographer Flow:** Dashboard → Create Event → Configure Branding → Generate QR.
2. **Guest Flow:** QR Scan → Landing Page → AI Recognition Explanation → Personal Gallery → Order Prints.

---
*Design generated and managed by Stitch AI Assistant.*