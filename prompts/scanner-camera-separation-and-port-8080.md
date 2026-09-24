# Implementation Prompt: Scanner vs Camera Separation, Remove Auto-Scan Active Text, Unified Barcode Scanner, and Port 8080

## Scope & Requirements
1. **Port 8080 Configuration**:
   - Update `package.json` dev script to `next dev -p 8080` and start script to `next start -p 8080`.
   - Ensure the Next.js dev server runs permanently on `http://localhost:8080` instead of port 3000.

2. **Scanner vs Camera Separation**:
   - **Camera (`/camera`)**: Strictly for `MEAL` photography and AI food image analysis. Remove the mode switcher showing `MEAL`, `BARCODE`, and `MEDIC`.
   - **Scanner (`/scanner` / `mode=scanner`)**: Synchronize `MEDIC` and `BARCODE` into ONE unified barcode scanner. Do NOT show `MEAL`, `BARCODE`, and `MEDIC` mode tabs.
   - Support both dedicated routes: `/camera` (strictly camera/meal) and `/scanner` (strictly barcode/medication scanner).
   - Update Dashboard buttons so `Camera` opens the camera (meal) and `Scanner` opens the unified scanner.

3. **Remove `BARCODE AUTO SCAN ACTIVE`**:
   - Completely remove the header pill/writing that reads `BARCODE AUTO-SCAN ACTIVE` (and `Medication NDC Scanner`).
   - Clean viewport with only the top navigation actions (back and flip camera) and the scanning frame.

4. **Barcode Auto-Detection**:
   - Maintain the continuous barcode detection loop that immediately captures and scans upon detecting a barcode.
   - Ensure barcode detection handles both standard retail product barcodes (UPC/EAN) and medication barcodes (NDC/UPC/EAN) through the unified `/api/analyze-product-barcode` endpoint.
   - Support both native `BarcodeDetector` API and fallback to software decoding (`html5-qrcode` / ZXing) so it detects barcodes reliably on all mobile and desktop browsers.

5. **Maintain UI Integrity**:
   - Maintain all other elements (navigation, top header buttons, switch camera direction logic, styling) exactly as they are without distorting anything.
