import assert from 'assert';

async function runTests() {
  console.log('=== 1. Non-Medication Rejection Gate Verification (/api/analyze-medication) ===');
  const baseUrl = 'http://localhost:8080';

  // 1A. Testing a non-medicinal item (Coffee)
  console.log('  Testing coffee / food query in medication route...');
  const coffeeRes = await fetch(`${baseUrl}/api/analyze-medication`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      medicationName: 'Fresh Roasted Arabica Coffee Beans',
      userId: 'anon',
      language: 'en'
    })
  });

  const coffeeData = await coffeeRes.json();
  console.log('  [Coffee Response]:', {
    status: coffeeRes.status,
    data: coffeeData
  });

  assert.strictEqual(coffeeRes.status, 422, 'Non-medication must return HTTP 422');
  assert.strictEqual(coffeeData.is_medication, false, 'is_medication must be false for coffee');
  assert.strictEqual(
    coffeeData.error,
    'Be serious. This is not a medicine at all.',
    'Expected error to state exactly "Be serious. This is not a medicine at all."'
  );
  console.log('  [PASS] Non-medication rejection gate correctly returned 422 and exact warning.');

  // 1B. Testing authentic medication (Guaifenesin Cough Syrup)
  console.log('\n=== 2. Authentic Medication Verification (/api/analyze-medication) ===');
  const medRes = await fetch(`${baseUrl}/api/analyze-medication`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      medicationName: 'Guaifenesin 100mg/5mL Cough Syrup',
      userId: 'anon',
      language: 'en'
    })
  });

  const medData = await medRes.json();
  console.log('  [Medication Response]:', {
    status: medRes.status,
    name: medData.name,
    type: medData.type,
    purpose: medData.purpose?.substring(0, 60),
    healthStatus: medData.healthStatus
  });

  assert.strictEqual(medRes.status, 200, 'Authentic medication must return HTTP 200');
  assert.strictEqual(medData.type, 'MEDICATION', 'Type must be MEDICATION');
  assert(medData.active_ingredients?.length > 0, 'Active ingredients must be present');
  console.log('  [PASS] Authentic medication returned valid clinical pharmacology.');

  // 1C. Testing boycotted barcode scan payload (Oreo 7622210100917)
  console.log('\n=== 3. Boycott Flagged Gate Payload Verification (/api/analyze-product-barcode) ===');
  const boycottRes = await fetch(`${baseUrl}/api/analyze-product-barcode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      barcode: '7622210100917',
      userId: 'anon',
      language: 'en'
    })
  });

  const boycottData = await boycottRes.json();
  console.log('  [Boycott Response]:', {
    status: boycottData.status,
    brand: boycottData.brand,
    parentCompany: boycottData.boycott?.parentCompany,
    reason: boycottData.boycott?.reason?.substring(0, 80)
  });

  assert.strictEqual(boycottData.status, 'FLAGGED', 'Oreo must be FLAGGED');
  assert(boycottData.boycott?.parentCompany?.includes('Mondelēz'), 'Must identify parent company Mondelēz International');
  assert(!boycottData.cheaper_alternatives, 'Alternatives must not be generated or returned on boycott gate');
  console.log('  [PASS] Boycott gate payload verified.');

  // 1D. Testing anonymous user barcode scan (Barilla 8076800195057) for speed and zero UUID errors
  console.log('\n=== 4. Anonymous Barcode Scan (Fast Bounded Netlify Safe) ===');
  const startMs = Date.now();
  const barillaRes = await fetch(`${baseUrl}/api/analyze-product-barcode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      barcode: '8076800195057',
      userId: 'anon',
      language: 'en'
    })
  });
  const durationMs = Date.now() - startMs;
  const barillaData = await barillaRes.json();
  console.log('  [Barilla Anon Scan]:', {
    status: barillaRes.status,
    name: barillaData.name,
    brand: barillaData.brand,
    durationMs,
    found: barillaData.found
  });

  assert.strictEqual(barillaRes.status, 200, 'Barilla anon scan must return HTTP 200 without Postgres UUID syntax error');
  assert.strictEqual(barillaData.status, 'APPROVED', 'Barilla must be APPROVED');
  assert(durationMs < 6000, `Scan duration must be < 6000ms to stay safely under Netlify timeout, took: ${durationMs}ms`);
  console.log(`  [PASS] Anonymous barcode scan succeeded in ${durationMs}ms without Postgres errors.`);

  console.log('\n✅ ALL MEDICATION VALIDATION & BOYCOTT PROCEDURAL CHECKS PASSED!');
}

runTests().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
