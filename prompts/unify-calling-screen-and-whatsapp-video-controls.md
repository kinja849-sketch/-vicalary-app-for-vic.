# Implementation Prompt: Unify Calling Screen Layout, Remove Decline Straw, WhatsApp Tap-to-Switch Video & Speaker/Bluetooth Dock

## Scope & Requirements
1. **Unify Calling/Ringing Screen Layout (Exact 1:1 Match with Reference)**
   - Eliminate separate layouts for offline/online or outgoing/incoming calling states.
   - Maintain the exact reference design ([media_1791516132449.png](file:///C:/Users/acer/.gemini/antigravity/brain/ab014732-a074-46b4-9b18-1877258dd9d2/.user_uploaded/media_1791516132449.png)) across all calling/ringing states:
     - Avatar centered with subtle ring
     - Caller / Recipient Name
     - Subtitle under name:
       - Displays **"Ringing"** when the peer is online / device is ringing
       - Displays **"Calling"** when the peer is offline
     - Animated dual upward chevrons (`^`)
     - 3-action bottom row:
       - **Decline / End**: Red circular button. **Fix**: Replace `PhoneOff` (which has the diagonal slash / "straw") with a clean phone handset icon (`<Phone className="rotate-[135deg]" />` with no slash line). Tapping cancels/declines the call cleanly.
       - **Accept / Swipe up**: Green circular button with `<Phone />` icon. Supports swipe up and tap to accept when incoming, or active indicator.
       - **Message**: Dark circular button with `<MessageSquare />` icon opening quick replies.
2. **Video Section — WhatsApp-Style Tap-to-Switch & Camera Flip**
   - **Remove Star Icon**: Completely eliminate the star/sparkle badge (`Sparkles`) from the video interface.
   - **PiP Controls**: The button on the PiP card is strictly for **Camera Flip** (switching between front and rear cameras via `onFlipCamera`).
   - **Tap-to-Switch View**:
     - Tapping the large/main screen swaps who is in the main screen and who is in the PiP.
     - Tapping the PiP card swaps who is in the main screen and who is in the PiP.
     - This matches WhatsApp's exact behavior: tap either surface to swap caller and local views effortlessly.
3. **Video Dock Audio Output (Speaker / Bluetooth Indicator)**
   - Match [media_1791516354689.png](file:///C:/Users/acer/.gemini/antigravity/brain/ab014732-a074-46b4-9b18-1877258dd9d2/.user_uploaded/media_1791516354689.png):
   - Button 3 on the 5-button dock:
     - Show the combined Speaker + Bluetooth icon glyph as depicted in the reference screenshot when speaker/Bluetooth output is active.
     - Provide an indicator when output is routed to speaker/Bluetooth vs earpiece.
   - Clear indicators for Video Camera (white when active, off state when disabled) and Microphone (unmuted vs muted).

---

## Files to Modify
- [`components/CallOverlay.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/CallOverlay.tsx)
- [`app/test-call-ui/page.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/test-call-ui/page.tsx)
- [`hooks/useDailyCall.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/hooks/useDailyCall.ts) (if audio output enumeration enhancement is needed)

---

## Verification Plan
1. Typecheck: `cmd.exe /c "npm run typecheck"` (0 errors).
2. DevTools visual check at `http://localhost:8080/test-call-ui`:
   - Inspect calling screen: verify exact look with Decline (no straw), Accept, Message. Verify subtitle says "Ringing" when online, "Calling" when offline.
   - Inspect video screen: verify star icon is gone; verify Camera flip button is present; verify tap on main screen and PiP swaps views; verify Speaker/Bluetooth icon matches screenshot.
