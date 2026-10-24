import { BarcodeService } from '../lib/products/BarcodeService';

async function runTests() {
  console.log("=== SCANNER TRUTHFULNESS & GROUNDING REGRESSION TESTS ===");

  // Test 1: Known barcode with full OFF data (e.g. Nutella 3017620422003 or Oreo 7622210449283)
  console.log("\n--- TEST 1: Known Food Barcode ---");
  try {
    const nutella = await BarcodeService.processScan('3017620422003', 'US');
    console.log("Name:", nutella.product.name);
    console.log("Calories:", nutella.product.nutrition?.calories);
    console.log("Ingredients sample:", nutella.product.ingredients?.substring(0, 80));
    console.log("Price Source:", nutella.pricing.source);
    console.log("Price Needs User Price:", nutella.pricing.needs_user_price);
    if (!nutella.product.name) throw new Error("Test 1 Failed: Name missing");
    if (!nutella.product.ingredients) console.warn("Warning: Nutella ingredients text empty from OFF");
    console.log("TEST 1 PASSED!");
  } catch (err: any) {
    console.error("Test 1 error:", err.message);
  }

  // Test 2: Indonesian 899 Barcode Price Grounding (Anti-Hallucination)
  console.log("\n--- TEST 2: Indonesian 899 Barcode Anti-Hallucination Price ---");
  try {
    const indoScan = await BarcodeService.processScan('8999999123456', 'ID');
    console.log("Indonesian product price:", indoScan.pricing.price);
    console.log("Indonesian currency:", indoScan.pricing.currency);
    console.log("Needs user price:", indoScan.pricing.needs_user_price);
    console.log("Confidence:", indoScan.pricing.confidence);
    if (indoScan.pricing.confidence > 0.5) {
      throw new Error("Test 2 Failed: Heuristic price has over-confident score!");
    }
    if (!indoScan.pricing.needs_user_price) {
      throw new Error("Test 2 Failed: Unconfirmed price did not set needs_user_price: true!");
    }
    console.log("TEST 2 PASSED!");
  } catch (err: any) {
    console.log("Test 2 OFF note (expected if barcode not in OFF database):", err.message);
    console.log("Testing pricing provider directly for Indonesian 899 barcode...");
    const price = await BarcodeService.priceProvider.getPrice('8999999123456', 'ID', 'Snack', 'Indo Snack');
    console.log("Indonesian price:", price.price, price.currency, "Source:", price.source, "needs_user_price:", price.needs_user_price, "confidence:", price.confidence);
    if (price.confidence > 0.5 || !price.needs_user_price) {
      throw new Error("Test 2 Failed: Indonesian price grounding failed");
    }
    console.log("TEST 2 PASSED!");
  }

  // Test 3: Water (True 0 kcal vs Fake Zeros)
  console.log("\n--- TEST 3: Water (True 0 kcal Grounding) ---");
  try {
    const { NutritionNormalizer } = await import('../lib/nutrition/NutritionNormalizer');
    
    // Normalizing water: should be exactly 0
    const waterNutriments = NutritionNormalizer.resolvePackagedProductNutrition("Spring Water", "beverages, waters", "500ml");
    console.log("Water normalized calories:", waterNutriments?.calories);
    if (!waterNutriments || waterNutriments.calories !== 0) {
      throw new Error(`Test 3 Failed: Water should be 0 kcal, got ${waterNutriments?.calories}`);
    }

    // Normalizing an unknown product with empty nutriments: MUST return null, NEVER fake zero
    const unknownNutriments = NutritionNormalizer.resolvePackagedProductNutrition("Mystery Biscuit Pack", "biscuits", "100g");
    console.log("Unknown biscuit calories with empty nutriments:", unknownNutriments);
    if (unknownNutriments !== null) {
      throw new Error("Test 3 Failed: Unknown packaged product returned invented nutrition instead of null!");
    }

    console.log("TEST 3 PASSED!");
  } catch (err: any) {
    console.error("Test 3 error:", err.message);
    throw err;
  }

  console.log("\nALL SCANNER REGRESSION SUITES EXECUTED.");
}

runTests().catch(console.error);
