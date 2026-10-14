# Implementation Prompt: In-Verification OTP Popup

## Objective
On phone verification for chat, the six-digit verification code must appear in a clear popup on the verification screen itself (`/verification-code`), allowing the user to view and insert it immediately without having to leave the screen or hunt in Alerts. Delivery to Alerts/notifications is strictly preserved.

## Scope Boundaries
- **In Scope**:
  1. `app/api/send-otp/route.ts`: Ensure success response consistently includes the OTP code (`code` and `devCode`).
  2. `lib/api/auth.ts`: Normalize `code` / `devCode` in `sendPhoneVerification` return payload.
  3. `app/_pages/PhoneInput.tsx`: Retrieve the code, insert into `notifications` table for Alerts, and store in `sessionStorage` under `pending_otp_code` for short-lived client handoff.
  4. `app/_pages/VerificationCode.tsx`:
     - On mount, if `pending_otp_code` is present, display a prominent, dismissible popup containing the 6-digit code.
     - Provide an "Insert Code" action that populates the code into the verification input boxes immediately, and a dismiss/close button that leaves the normal inputs ready for manual typing.
     - Provide a "Copy" button for convenience.
     - On "Resend Code", request a new OTP, update `sessionStorage`, refresh and display the popup with the new code, and persist the new notification to Alerts.
     - Clear `pending_otp_code` upon successful verification.
- **Out of Scope**:
  - Real SMS/WhatsApp gateways or external provider integrations.
  - Changes to `/api/verify-otp` or `chat_users` table schema.
  - Changes to navigation targets after success (`/chat?view=contacts`) or bottom navigation.
  - Changes to WhatsApp-style chat features, delete/reactions, cooking voice, or avatar.

## Data Flow & Architecture
```
[PhoneInput Screen]
       │
       ▼
[POST /api/send-otp]
       │
       ├─► Generates & saves code in `chat_users`
       │
       ▼ Returns { success: true, code: "123456", devCode: "123456" }
[PhoneInput.tsx]
       │
       ├─► Inserts notification in Supabase `notifications` table (Alerts preserved)
       ├─► Stores "123456" into sessionStorage['pending_otp_code']
       └─► Navigates to `/verification-code`
             │
             ▼
[VerificationCode.tsx]
       │
       ├─► Reads sessionStorage['pending_otp_code']
       ├─► Opens on-screen popup showing "123456"
       │     ├─► User clicks "Insert Code": fills inputs & triggers auto-verify
       │     ├─► User clicks "Dismiss": closes popup, inputs remain editable
       │     └─► User clicks "Resend": calls send-otp, updates popup & alerts
       ▼
[POST /api/verify-otp]
       │
       ▼
[Success]
       ├─► Clears sessionStorage['pending_otp_code']
       └─► Redirects to `/chat?view=contacts`
```

## Detailed File Changes

### 1. `the-app-belong-to-vic--main/app/api/send-otp/route.ts`
- Return `code: verificationCode` and `devCode: verificationCode` in the JSON response payload.

### 2. `the-app-belong-to-vic--main/lib/api/auth.ts`
- In `sendPhoneVerification`, normalize the returned payload to ensure `code` and `devCode` are always populated.

### 3. `the-app-belong-to-vic--main/app/_pages/PhoneInput.tsx`
- Extract `const otpCode = response?.code || response?.devCode;`
- Save to `sessionStorage.setItem("pending_otp_code", otpCode)`
- Keep `supabase.from('notifications').insert(...)` with `otpCode` so the Alerts tab still receives the notification.

### 4. `the-app-belong-to-vic--main/app/_pages/VerificationCode.tsx`
- Add state for popup visibility (`isPopupOpen`) and code (`popupCode`).
- Read `sessionStorage.getItem("pending_otp_code")` on component mount.
- Render on-screen modal/card using `framer-motion` and native VicCalary design tokens (`bg-white dark:bg-[#1f2c34]`, `border-vic-green`, `text-vic-green`, etc.).
- Allow the user to click "Insert Code" (populates `code` state) or dismiss the popup.
- In `handleResend`, fetch the new code, update `sessionStorage`, update the popup code, open the popup, and insert a new notification into `notifications`.
- In `handleVerify` and the realtime listener, clear `sessionStorage.removeItem("pending_otp_code")` upon successful verification.

## Acceptance Criteria
1. Submitting phone number in `/phone-input` navigates to `/verification-code`.
2. On `/verification-code`, a prominent popup immediately displays the 6-digit code.
3. User can click "Insert Code" to instantly populate the input fields and complete verification.
4. Dismissing the popup leaves the 6 inputs empty and fully interactive for manual entry.
5. Alerts page (`/notifications`) still receives the verification notification.
6. Clicking "Resend Code" triggers a new OTP, updates the popup with the new 6-digit code, and adds another notification to Alerts.
7. Verification success clears `pending_otp_code` from storage and navigates to `/chat?view=contacts`.
