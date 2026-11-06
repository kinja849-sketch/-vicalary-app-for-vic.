# Implementation Blueprint: Fix Mobile Safari Gallery Upload Pattern Error

## Objective
Eliminate the mobile WebKit/iOS Safari error:
```
The string did not match the expected pattern.
```
which appears as a toast alert when sharing/uploading images from the gallery into the Camera / Food Analysis flow, without altering the established UI or breaking existing camera/barcode functionality.

---

## 1. Technical Root Cause Analysis

### Cause 1: Unguarded Supabase Storage Upload in `analyzeFoodImage`
- **Location**: [`lib/api/food.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/api/food.ts#L67-L80)
- **Mechanism**:
  - `uploadPromise` executes `supabase.storage.from('food-images').upload(filePath, file)` and runs:
    ```ts
    if (res.error) throw res.error;
    ```
    without any `.catch(() => null)`.
  - On mobile Safari / iOS, files uploaded from the photo gallery or shared via the OS share sheet often have filenames or user identifiers containing characters (such as `+` for phone OTP users or spaces/parentheses from camera roll naming `IMG_1234 (1).jpg`) that fail storage validation or RLS.
  - When the storage API returns an HTTP error or non-JSON payload, `@supabase/storage-js`'s internal `responseError.json()` fails. Under WebKit (iOS Safari), this syntax/DOM parsing failure is surfaced as the native DOMException 12 message:
    `"The string did not match the expected pattern."`
  - In [`analyzeMedication`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/api/food.ts#L162-L168), this was already guarded with `if (res.error) return null;` and `.catch(() => null);`, but in `analyzeFoodImage` it was unguarded and caused `Promise.all` to immediately reject.
  - The AI analysis backend (`/api/analyze-food-image`) processes the image via `imageBase64` directly; the Supabase storage upload is only a secondary asset backup. A failure to upload to Supabase storage must never block meal analysis.

### Cause 2: Unguarded `res.json()` Parsing in `analyzeFoodImage`
- **Location**: [`lib/api/food.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/api/food.ts#L132)
- **Mechanism**:
  - Calling `const data = await res.json();` directly without reading `res.text()` first triggers WebKit's native `"The string did not match the expected pattern"` error if the response body contains unexpected characters or non-JSON content.

### Cause 3: WebKit `fetch(dataUrl)` Incompatibility in `takePhoto`
- **Location**: [`app/_pages/Camera.tsx`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/app/_pages/Camera.tsx#L516-L518)
- **Mechanism**:
  - `takePhoto` calls:
    ```ts
    const response = await fetch(imageData); // imageData is data:image/jpeg;base64,...
    const blob = await response.blob();
    ```
  - In WebKit / iOS Safari, passing large data URLs into the native `fetch()` API throws `DOMException 12: "The string did not match the expected pattern."`.
  - Standard compliant conversion requires `canvas.toBlob(...)` or synchronous binary conversion (`atob` into `Uint8Array`).

### Cause 4: BarcodeDetector Format Initializer Validation
- **Location**: [`app/_pages/Camera.tsx`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/app/_pages/Camera.tsx#L127-L137)
- **Mechanism**:
  - Instantiating `new BarcodeDetector({ formats: [...] })` with unsupported format names in WebKit (when experimental feature flags are enabled) throws DOMException 12 `"The string did not match the expected pattern."`.
  - Formats must be filtered using `getSupportedFormats()` or enclosed in a silent fallback.

---

## 2. Proposed Changes

### File 1: [`lib/api/food.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/api/food.ts)
1. **Sanitize Path and File Extension**:
   - Clean `userId` with `(userId || 'anon').replace(/[^a-zA-Z0-9_-]/g, '_')`.
   - Sanitize file extension to alphanumeric only (`jpg`, `png`, `webp`, etc.).
2. **Resilient Storage Upload**:
   - Update `uploadPromise` in `analyzeFoodImage` to mirror `analyzeMedication`:
     ```ts
     const uploadPromise = supabase.storage
       .from('food-images')
       .upload(filePath, file)
       .then(res => {
         if (res.error) return null;
         const { data: { publicUrl } } = supabase.storage
           .from('food-images')
           .getPublicUrl(filePath);
         return publicUrl;
       })
       .catch(() => null);
     ```
   - Guarantee that storage upload failure never causes the AI food analysis to abort.
3. **Safe Response Parsing**:
   - Read `const rawText = await res.text().catch(() => '')`.
   - Parse JSON inside a guarded try/catch block, returning meaningful user-facing errors rather than browser syntax exceptions.

### File 2: [`app/_pages/Camera.tsx`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/app/_pages/Camera.tsx)
1. **Safe Blob Extraction in `takePhoto`**:
   - Replace `await fetch(imageData)` with `canvas.toBlob()` and a synchronous `atob` fallback:
     ```ts
     const blob = await new Promise<Blob>((resolve, reject) => {
       canvas.toBlob((b) => {
         if (b) resolve(b);
         else {
           try {
             const byteString = atob(imageData.split(',')[1]);
             const mimeString = imageData.split(',')[0].split(':')[1].split(';')[0];
             const ab = new ArrayBuffer(byteString.length);
             const ia = new Uint8Array(ab);
             for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
             resolve(new Blob([ab], { type: mimeString }));
           } catch (e) {
             reject(e);
           }
         }
       }, "image/jpeg", 0.9);
     });
     ```
2. **Safe Barcode Detection in `handleGalleryUpload`**:
   - Ensure format list is checked against `BarcodeDetector.getSupportedFormats()` or safely handled so WebKit never throws format syntax errors.

---

## 3. Verification Plan

1. **Typecheck**:
   - Run `npx tsc --noEmit` to verify zero TypeScript errors.
2. **Automated Unit / API Regression Test**:
   - Run `scratch/test-analyze-food.js` to ensure deterministic nutrition calculations remain 100% operational.
3. **Localhost & DevTools Visual Verification**:
   - Check `http://localhost:8080/camera` to ensure photo capture and gallery upload flows execute cleanly with zero console errors or DOM exceptions.
