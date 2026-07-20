# Oura Photographer Dashboard - Technical Implementation Guide for Claude

This document provides the necessary context and functional requirements to implement the **Oura Photographer Dashboard** (Print Queue) using the provided HTML/CSS source code.

## 1. Project Overview
**Oura** is a premium wedding photography platform. This dashboard allows photographers to manage print orders, payments, and client communication.
**Style:** Dark Luxury (Surface: `#0E0E0E`, Primary: `#FF8A75`).
**Language:** Hebrew (RTL).

## 2. Core Functional Requirements

### A. Data Management & Table Logic
- **Order Queue:** Implement a dynamic list of orders. Each order includes:
    - Guest Name & Phone
    - Order Date & Time
    - Print Status (Ready, In Progress, Pending)
    - Payment Status (Paid, Pending)
    - Print Type (Magnet, Wood Block, Canvas, etc.)
- **Sorting & Filtering:** Enable real-time filtering by:
    - **Date Range:** Filter orders between two dates.
    - **Print Type:** Filter by specific product categories.
    - **Payment Status:** Filter by Paid/Unpaid.
- **CSV Export:** Implement logic to generate and download a CSV file based on the *currently filtered* view.

### B. WhatsApp Integration Flow
The dashboard includes a recovery/reminder system via WhatsApp:
1. **Trigger:** A "WhatsApp Reminder" button appears for orders with "Pending Payment" status.
2. **Template System:**
    - Provide at least 3 templates: "Payment Reminder", "Order Ready", "Thank You".
    - Clicking a template chip should update the message textarea.
3. **Dynamic Placeholders:** Replace bracketed variables (e.g., `[Guest Name]`, `[Payment Link]`) with real data from the selected order.
4. **Previewer:** Show a mobile-style chat bubble that live-updates as the user edits the message.
5. **Execution:** The "Send" button should open a `wa.me` link with the encoded message and guest's phone number.

### C. Responsiveness
- **Desktop:** A high-density data table with sidebar filters and persistent stats.
- **Mobile:** Transition the table into a **Card Layout**. Ensure the Top Bar and Bottom Navigation remain functional.

## 3. Visual & Interactive Guidelines
- **Animations:** Use smooth CSS transitions for the Lightbox/Modal opening (Slide-up for mobile, Fade/Scale for desktop).
- **Brand Fidelity:** Use the Oura Aperture Logo (`{{DATA:IMAGE:IMAGE_2}}`).
- **Typography:** Hebrew text must use **Rubik**; Latin/Branding uses **Hanken Grotesk**.

## 4. Expected Deliverable
Please integrate these logics into the existing `code.html` structure, ensuring all interactive elements (buttons, inputs, filters) are wired to functional JavaScript handlers while maintaining the established RTL layout and Dark Luxury aesthetic.