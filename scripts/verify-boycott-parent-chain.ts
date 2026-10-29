import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { BoycottScreeningService } from '../lib/scanner/BoycottScreeningService';
import { ScannerDecisionEngine } from '../lib/scanner/ScannerDecisionEngine';

async function verifyParentFirstBoycottResolution() {
  console.log('=== VERIFYING PARENT-FIRST BOYCOTT RESOLUTION & REGISTRY ===\n');

  BoycottScreeningService.clearCache();

  // 1. Core Acceptance Criteria Brands (Famous SKUs + Lesser-known Subsidiaries under same Parent)
  const expectedFlaggedCases: Array<{
    brand: string;
    productName?: string;
    expectedParentSubstring: string;
    chainLabel: string;
  }> = [
    // Mondelēz International
    { brand: 'Oreo', expectedParentSubstring: 'Mondelēz International', chainLabel: 'Mondelēz (Famous)' },
    { brand: 'Mondelēz, Oreo', expectedParentSubstring: 'Mondelēz International', chainLabel: 'Mondelēz OFF multi-brand' },
    { brand: '7Days', expectedParentSubstring: 'Mondelēz International', chainLabel: 'Mondelēz (Subsidiary)' },
    { brand: 'Alpen Gold', expectedParentSubstring: 'Mondelēz International', chainLabel: 'Mondelēz (Subsidiary)' },
    { brand: 'Côte d’Or', expectedParentSubstring: 'Mondelēz International', chainLabel: 'Mondelēz (Diacritic/Apostrophe)' },
    { brand: 'Toblerone', expectedParentSubstring: 'Mondelēz International', chainLabel: 'Mondelēz (Subsidiary)' },
    { brand: 'belVita', expectedParentSubstring: 'Mondelēz International', chainLabel: 'Mondelēz (Subsidiary)' },

    // Mars, Incorporated
    { brand: 'Snickers', expectedParentSubstring: 'Mars, Incorporated', chainLabel: 'Mars (Famous)' },
    { brand: '3 Musketeers', expectedParentSubstring: 'Mars, Incorporated', chainLabel: 'Mars (Subsidiary)' },
    { brand: '5 Gum', expectedParentSubstring: 'Mars, Incorporated', chainLabel: 'Mars -> Wrigley -> Mars, Incorporated' },
    { brand: 'Pringles', expectedParentSubstring: 'Mars, Incorporated', chainLabel: 'Mars -> Kellanova -> Mars, Incorporated' },
    { brand: 'Acana', expectedParentSubstring: 'Mars, Incorporated', chainLabel: 'Mars -> Champion Petfoods -> Mars, Incorporated' },
    { brand: 'Royal Canin', expectedParentSubstring: 'Mars, Incorporated', chainLabel: 'Mars (Petcare Subsidiary)' },
    { brand: 'Balisto', expectedParentSubstring: 'Mars, Incorporated', chainLabel: 'Mars (Subsidiary)' },

    // PepsiCo
    { brand: 'Aquafina', expectedParentSubstring: 'PepsiCo', chainLabel: 'PepsiCo (Famous)' },
    { brand: "Lay's", expectedParentSubstring: 'PepsiCo', chainLabel: 'PepsiCo (Famous ASCII apostrophe)' },
    { brand: 'Lay’s', expectedParentSubstring: 'PepsiCo', chainLabel: 'PepsiCo (Famous curly apostrophe)' },
    { brand: 'Frito-Lay', expectedParentSubstring: 'PepsiCo', chainLabel: 'PepsiCo (Frito-Lay division)' },
    { brand: 'Bokomo', expectedParentSubstring: 'PepsiCo', chainLabel: 'PepsiCo -> Pioneer Foods -> PepsiCo' },
    { brand: 'Alvalle', expectedParentSubstring: 'PepsiCo', chainLabel: 'PepsiCo (Subsidiary)' },
    { brand: 'Baken-Ets', expectedParentSubstring: 'PepsiCo', chainLabel: 'PepsiCo (Subsidiary)' },
    { brand: 'Doritos', expectedParentSubstring: 'PepsiCo', chainLabel: 'PepsiCo (Subsidiary)' },
    { brand: 'Quaker', expectedParentSubstring: 'PepsiCo', chainLabel: 'PepsiCo (Subsidiary)' },

    // Ferrero Group
    { brand: 'Nutella', expectedParentSubstring: 'Ferrero Group', chainLabel: 'Ferrero (Famous)' },
    { brand: '100 Grand', expectedParentSubstring: 'Ferrero Group', chainLabel: 'Ferrero (Subsidiary)' },
    { brand: 'Baby Ruth', expectedParentSubstring: 'Ferrero Group', chainLabel: 'Ferrero (Subsidiary)' },
    { brand: 'Blue Bunny', expectedParentSubstring: 'Ferrero Group', chainLabel: 'Ferrero -> Wells Enterprises -> Ferrero Group' },
    { brand: 'Halo Top', expectedParentSubstring: 'Ferrero Group', chainLabel: 'Ferrero -> Wells Enterprises -> Ferrero Group' },
    { brand: 'Tic Tac', expectedParentSubstring: 'Ferrero Group', chainLabel: 'Ferrero (Subsidiary)' },
    { brand: 'Keebler', expectedParentSubstring: 'Ferrero Group', chainLabel: 'Ferrero (Subsidiary)' },

    // Nestlé S.A.
    { brand: 'Nescafé', expectedParentSubstring: 'Nestlé S.A.', chainLabel: 'Nestlé (Famous)' },
    { brand: 'Nescafe', expectedParentSubstring: 'Nestlé S.A.', chainLabel: 'Nestlé (No accent)' },
    { brand: 'KitKat', expectedParentSubstring: 'Nestlé S.A.', chainLabel: 'Nestlé (Famous)' },
    { brand: 'Aero', expectedParentSubstring: 'Nestlé S.A.', chainLabel: 'Nestlé (Subsidiary)' },
    { brand: 'Friskies', expectedParentSubstring: 'Nestlé S.A.', chainLabel: 'Nestlé -> Nestlé Purina -> Nestlé S.A.' },
    { brand: 'Tidy Cats', expectedParentSubstring: 'Nestlé S.A.', chainLabel: 'Nestlé -> Nestlé Purina -> Nestlé S.A.' },
    { brand: 'Chocapic', expectedParentSubstring: 'Nestlé S.A.', chainLabel: 'Nestlé -> Cereal Partners Worldwide -> Nestlé S.A.' },
    { brand: 'Froneri Extreme', expectedParentSubstring: 'Nestlé S.A.', chainLabel: 'Nestlé -> Froneri -> Nestlé S.A.' },
    { brand: 'San Pellegrino', expectedParentSubstring: 'Nestlé S.A.', chainLabel: 'Nestlé (Water Subsidiary)' },

    // The Coca-Cola Company
    { brand: 'Coca-Cola', expectedParentSubstring: 'The Coca-Cola Company', chainLabel: 'Coca-Cola (Direct/Parent)' },
    { brand: 'Sprite', expectedParentSubstring: 'The Coca-Cola Company', chainLabel: 'Coca-Cola (Famous)' },
    { brand: 'Dasani', expectedParentSubstring: 'The Coca-Cola Company', chainLabel: 'Coca-Cola (Famous)' },
    { brand: 'Appletiser', expectedParentSubstring: 'The Coca-Cola Company', chainLabel: 'Coca-Cola (Subsidiary)' },
    { brand: 'Barbican', expectedParentSubstring: 'The Coca-Cola Company', chainLabel: 'Coca-Cola -> Aujan -> The Coca-Cola Company' },
    { brand: 'Bambi', expectedParentSubstring: 'The Coca-Cola Company', chainLabel: 'Coca-Cola -> HBC -> The Coca-Cola Company' },
    { brand: 'Barista Bros', expectedParentSubstring: 'The Coca-Cola Company', chainLabel: 'Coca-Cola -> CCEP -> The Coca-Cola Company' },
    { brand: 'Fairlife', expectedParentSubstring: 'The Coca-Cola Company', chainLabel: 'Coca-Cola (Subsidiary)' },

    // Unilever PLC / The Magnum Ice Cream Company
    { brand: 'Knorr', expectedParentSubstring: 'Unilever PLC', chainLabel: 'Unilever (Famous)' },
    { brand: 'Hellmann’s', expectedParentSubstring: 'Unilever PLC', chainLabel: 'Unilever (Famous)' },
    { brand: 'Amora', expectedParentSubstring: 'Unilever PLC', chainLabel: 'Unilever (Subsidiary)' },
    { brand: 'Bru', expectedParentSubstring: 'Unilever PLC', chainLabel: 'Unilever -> Hindustan Unilever -> Unilever PLC' },
    { brand: 'Algida', expectedParentSubstring: 'Unilever PLC', chainLabel: 'Algida -> Magnum Ice Cream -> Unilever PLC' },
    { brand: 'Ben & Jerry’s', expectedParentSubstring: 'Unilever PLC', chainLabel: 'Ben & Jerrys -> Magnum Ice Cream -> Unilever PLC' },
    { brand: 'Magnum', expectedParentSubstring: 'Unilever PLC', chainLabel: 'Magnum -> Magnum Ice Cream -> Unilever PLC' },

    // Danone S.A.
    { brand: 'Activia', expectedParentSubstring: 'Danone S.A.', chainLabel: 'Danone (Famous)' },
    { brand: 'Evian', expectedParentSubstring: 'Danone S.A.', chainLabel: 'Danone (Famous)' },
    { brand: 'AlSafi', expectedParentSubstring: 'Danone S.A.', chainLabel: 'Danone -> Al Safi Danone -> Danone S.A.' },
    { brand: 'Badoit', expectedParentSubstring: 'Danone S.A.', chainLabel: 'Danone (Subsidiary)' },

    // The Hershey Company
    { brand: "Hershey's", expectedParentSubstring: 'The Hershey Company', chainLabel: 'Hershey (Direct/Parent)' },
    { brand: "Reese's", expectedParentSubstring: 'The Hershey Company', chainLabel: 'Hershey (Famous)' },
    { brand: 'barkTHINS', expectedParentSubstring: 'The Hershey Company', chainLabel: 'Hershey (Subsidiary)' },
    { brand: 'Dot’s Homestyle Pretzels', expectedParentSubstring: 'The Hershey Company', chainLabel: 'Hershey (Subsidiary)' },

    // Kraft Heinz
    { brand: 'Heinz', expectedParentSubstring: 'Kraft Heinz', chainLabel: 'Kraft Heinz (Famous)' },
    { brand: 'A.1.', expectedParentSubstring: 'Kraft Heinz', chainLabel: 'Kraft Heinz (Subsidiary)' },
    { brand: 'ABC Kecap Manis', expectedParentSubstring: 'Kraft Heinz', chainLabel: 'Kraft Heinz (Subsidiary)' },
    { brand: 'Pudliszki', expectedParentSubstring: 'Kraft Heinz', chainLabel: 'Kraft Heinz (Subsidiary)' },
    { brand: 'Velveeta', expectedParentSubstring: 'Kraft Heinz', chainLabel: 'Kraft Heinz (Subsidiary)' },

    // Missing Brand -> Product Name Token Fallback
    { brand: '', productName: 'Oreo Chocolate Sandwich Cookies 137g', expectedParentSubstring: 'Mondelēz International', chainLabel: 'Empty brand -> Name token Oreo -> Mondelēz' },
    { brand: '', productName: 'Nutella Hazelnut Spread with Cocoa', expectedParentSubstring: 'Ferrero Group', chainLabel: 'Empty brand -> Name token Nutella -> Ferrero' }
  ];

  for (const testCase of expectedFlaggedCases) {
    const res = await BoycottScreeningService.screenBrand(testCase.brand, undefined, testCase.productName);
    if (!res.flagged) {
      throw new Error(`[FAIL] Expected ${testCase.chainLabel} (${testCase.brand || testCase.productName}) to be FLAGGED, got unflagged!`);
    }
    if (!res.parentCompany || !res.parentCompany.includes(testCase.expectedParentSubstring)) {
      throw new Error(
        `[FAIL] Expected ${testCase.chainLabel} parentCompany to include "${testCase.expectedParentSubstring}", got "${res.parentCompany}"`
      );
    }
    console.log(
      `✅ [FLAGGED] ${testCase.chainLabel.padEnd(46)} | Brand: ${(res.companyName || '').padEnd(22)} -> Parent: ${res.parentCompany}`
    );
  }

  // 2. Unverified & Ambiguous Guard Cases + Non-Boycotted Brands (MUST NOT FLAG)
  const expectedClearCases: Array<{ brand: string; productName?: string; reason: string }> = [
    { brand: '18/70', reason: 'Unverified row in A-Z table' },
    { brand: 'Abu Siouf', reason: 'Unverified row in A-Z table' },
    { brand: 'Agrifood Marketing', reason: 'Unverified row in A-Z table' },
    { brand: 'Aquarade', reason: 'Unverified row in A-Z table' },
    { brand: 'Asian Delight', reason: 'Unverified row in A-Z table' },
    { brand: 'Bakers’ Choice', reason: 'Unverified row in A-Z table' },
    { brand: 'Biopet', reason: 'Unverified row in A-Z table' },
    { brand: 'Bwild', reason: 'Unverified row in A-Z table' },
    { brand: 'Crystal', productName: 'Crystal Spring Bottled Water', reason: 'Ambiguous multi-owner brand' },
    { brand: 'DFS', reason: 'Multiple businesses use this name; unverified' },
    { brand: 'Fiesta', reason: 'Multiple unrelated brands; unverified' },
    { brand: 'Viva', reason: 'Multiple brands; unverified' },
    { brand: 'Vital', reason: 'Multiple brands; unverified' },
    { brand: 'YumYum', reason: 'Multiple brands; market required' },
    { brand: 'Zico', reason: 'Independent brand; formerly Coca-Cola-owned' },
    { brand: 'Honest Tea', reason: 'Former Coca-Cola brand; discontinued' },
    { brand: 'Al Arz Tahini', reason: 'Independent manufacturer (non-targeted)' },
    { brand: 'Anita Gelato', reason: 'Independent brand (non-targeted)' },
    { brand: 'Barilla', reason: 'Barilla Group (non-targeted parent)' },
    { brand: 'Haribo', reason: 'Haribo Group (non-targeted parent)' },
    { brand: '', productName: 'Pure Crystal Mineral Water 500ml', reason: 'Empty brand with ambiguous word Crystal in product name' }
  ];

  console.log('\n--- Checking Unverified, Ambiguous, and Non-Targeted Brands (Must NOT Flag) ---');
  for (const clearCase of expectedClearCases) {
    const res = await BoycottScreeningService.screenBrand(clearCase.brand, undefined, clearCase.productName);
    if (res.flagged) {
      throw new Error(
        `[FAIL] Expected "${clearCase.brand || clearCase.productName}" (${clearCase.reason}) to be CLEAR, but got FLAGGED: ${JSON.stringify(res)}`
      );
    }
    console.log(`✅ [CLEAR]   ${(clearCase.brand || clearCase.productName || '').padEnd(35)} | (${clearCase.reason})`);
  }

  // 3. End-to-End ScannerDecisionEngine Live Barcode Test (Nutella 3017620422003 & Barilla 8076800195057)
  console.log('\n--- Checking Live ScannerDecisionEngine Barcode Flows ---');
  const nutellaDecision = await ScannerDecisionEngine.processScan('3017620422003', 'anon', 'US');
  console.log('Nutella (3017620422003) Decision Status:', nutellaDecision.status, 'Parent:', nutellaDecision.boycottDetails?.parentCompany);
  if (nutellaDecision.status !== 'FLAGGED' || !nutellaDecision.boycottDetails?.parentCompany?.includes('Ferrero')) {
    throw new Error(`[FAIL] Expected Nutella barcode 3017620422003 to be FLAGGED with Ferrero Group parent!`);
  }

  const barillaDecision = await ScannerDecisionEngine.processScan('8076800195057', 'anon', 'US');
  console.log(
    'Barilla (8076800195057) Decision Status:',
    barillaDecision.status,
    'Calories:',
    barillaDecision.nutrition?.calories,
    'Price:',
    barillaDecision.pricing?.price
  );
  if (barillaDecision.status !== 'APPROVED') {
    throw new Error(`[FAIL] Expected Barilla barcode 8076800195057 to be APPROVED, got ${barillaDecision.status}`);
  }

  console.log('\n🎉 ALL PARENT-FIRST BOYCOTT RESOLUTION & NON-REGRESSION CHECKS PASSED!');
}

verifyParentFirstBoycottResolution().catch(err => {
  console.error(err);
  process.exit(1);
});
