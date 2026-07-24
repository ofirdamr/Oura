# Stitch Design Request — §10 Cleanup + Missing Screens

**Context:** Design audit session (2026-07-24) found that the Checkout screen design (photographer admin dashboard) exists in Stitch but was never implemented. Seven additional auth/guest flows have code but no Stitch designs. This prompt lists everything needed.

---

## 1. REDESIGN: Checkout Flow (Photographer Admin Dashboard)

**Current State:** Stitch has designs for checkout desktop/mobile, but they show photographer admin dashboard screens (with tabs: Gallery, Prints, Statistics, Messaging, Settings, etc.). Code implemented a different guest checkout form instead.

**Required:** Create the photographer admin checkout/dashboard screens per the existing Stitch designs that show:
- Desktop: Photographer dashboard with nav tabs, message center, notifications, settings toggles
- Mobile: Same dashboard, mobile-optimized

This is what the existing design files contain; implement to match.

---

## 2. NEW DESIGNS NEEDED: Auth & Guest Flows

### 2a. Authentication Screens (2 designs)

**Login Page** (`/login`)
- Photographer sign-in form
- Hebrew, RTL, dark theme (match brand: #141210 bg, #e2725b accent, #ede7e3 text)
- Fields: email, password
- "Forgot password" link
- Sign-up link for new photographers
- Logo + branding
- Desktop + Mobile variants

**Signup Page** (`/signup`)
- New photographer registration
- Fields: first name, last name, email, password, studio name (optional)
- Terms acceptance checkbox
- Already have account? Login link
- Same branding as login
- Desktop + Mobile variants

### 2b. Password Recovery Screens (2 designs)

**Forgot Password** (`/forgot-password`)
- Email input: "Enter the email associated with your account"
- Submit button: "Send recovery link"
- Confirmation message
- Link to login
- Desktop + Mobile variants

**Reset Password** (`/reset-password`)
- Page that appears after clicking recovery email link
- Password input field (new password)
- Confirm password field
- Submit button: "Update password"
- Success state
- Desktop + Mobile variants

### 2c. Guest Auth Flows (2 designs)

**Guest Join** (`/join`)
- Page where guest enters code/QR info to access event
- Text input: event code or barcode
- Submit button
- Or alternative: QR scanner UI
- Link to return home
- Mobile-optimized
- Desktop variant (if needed)

**Guest Selfie Capture** (`/selfie`)
- Full-screen camera interface for guest to take selfie
- Capture button (large, centered)
- Retake option
- Submit button: "Continue"
- Instructions: "Take a clear photo of your face"
- Mobile-optimized (portrait orientation)
- Desktop variant (fallback)

### 2d. Consent Screen (1 design)

**Biometric Consent Gate** (`/consent`)
- Large, prominent consent message in Hebrew
- Headline: "ההסכמה שלך חשובה לנו" or similar
- Explain face recognition usage
- Two buttons: "Agree" and "Decline"
- Info: "This is for personalized gallery matching"
- Desktop + Mobile variants

---

## 3. NOTES FOR STITCH

- **Branding:** All screens use Oura brand (logo, colors, typography)
- **RTL:** All text is Hebrew, full RTL support
- **Color Palette:** 
  - Background: #141210
  - Accent: #e2725b (coral)
  - Text: #ede7e3 (light)
  - Secondary: #a48b87 (muted)
  - Borders: #56423e (dark brown)
- **Typography:** Rubik for Hebrew text (Hanken Grotesk for Latin branding bits only)
- **Export:** Save all screen PNGs to `design/screens/oura_final_production_<screen_name>_<desktop|mobile>/screen.png`

---

## 4. IMPLEMENTATION ORDER

1. **High priority (blocking §10 completion):**
   - Checkout/Admin Dashboard (desktop + mobile)
   - Order Confirmation was already designed; verify code matches

2. **Medium priority (auth flows, needed for live app):**
   - Login, Signup (photographer auth)
   - Forgot Password, Reset Password (recovery)
   - Guest Selfie Capture (essential for guest flow)

3. **Lower priority (refinements):**
   - Guest Join (alternative QR/code entry)
   - Biometric Consent Gate (can use simple modal for now)

---

Ready to paste into Stitch. Once designs are exported, update code to match them exactly.
