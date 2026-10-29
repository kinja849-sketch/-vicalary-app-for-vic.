import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { SafetyEngine } from '@/lib/services/SafetyEngine';
import { callChatCompletionWithFallback, getPrimaryApiKey, getBackupApiKey } from '@/lib/ai/ai-fallback';
import { resolveUserLanguage, buildAILanguageDirective } from '@/lib/api/serverLanguage';

function parseJSONSafely(text?: string | null, fallback: any = {}) {
  try {
    if (!text) return fallback;
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      return JSON.parse(text.substring(jsonStart, jsonEnd + 1));
    }
    return JSON.parse(text);
  } catch (e) {
    return fallback;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrl, imageBase64, barcode, medicationName: inputMedName, userId, locationContext } = body;

    if (!imageUrl && !imageBase64 && !barcode && !inputMedName) {
      return NextResponse.json({ error: 'Medication image, barcode, or name is required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const hasAIKey = !!(getPrimaryApiKey() || getBackupApiKey());

    if (!hasAIKey) {
      return NextResponse.json({ error: 'AI provider API key not configured (neither primary nor backup)' }, { status: 500 });
    }

    // 1. Resolve Authoritative User Language
    const resolvedLang = await resolveUserLanguage({
      userId,
      requestLanguage: body.language,
      locationContext,
      supabase,
    });
    const langDirective = buildAILanguageDirective(resolvedLang);

    // Load User Safety Profile from Onboarding & Settings
    const userSafetyProfile = userId 
      ? await SafetyEngine.getUserSafetyProfile(userId, supabase, resolvedLang)
      : {
          userId: 'anonymous',
          userGoal: 'stay healthy',
          dailyCalorieGoal: 2000,
          allergies: [],
          medicalConditions: [],
          dietaryLifestyle: [],
          isDiabetic: false,
          hasHypertension: false,
          language: resolvedLang
        };

    const userLang = resolvedLang;

    // 2. Identify Medication details via OpenAI Vision or GPT
    const systemPrompt = `You are an expert clinical pharmacologist and patient medication safety intelligence engine.

CRITICAL STEP 0: AUTHENTIC MEDICATION CLASSIFICATION (MANDATORY GATE):
You must first evaluate if the photo or query represents an authentic pharmaceutical medication, over-the-counter (OTC) drug, prescription medicine, medicinal syrup, blister pack, pills/tablets/capsules, medicinal ointment/drops, or official medicine box/packaging.
- If the image depicts coffee, tea, food, beverages, snacks, fruit, groceries, clothing, electronics, or ANY NON-MEDICINAL ITEM:
  You MUST set "is_medication": false, "non_medication_detected": "<detected item, e.g. Coffee / Fruit / Snack / Beverage>", and DO NOT fabricate or invent medical indications or active ingredients for it.
- If and ONLY if the item is an authentic medicinal drug or pharmaceutical product, set "is_medication": true, "non_medication_detected": null, and extract authentic clinical facts.

CRITICAL VISION EXTRACTION MANDATE (When is_medication is true):
- You MUST read the visible product/brand name, active substances, and dosage strengths directly from the package photo.
- DO NOT return placeholder generic text such as "Scanned Medication", "Pharmaceutical Product", or "Medication indication".
- If the box displays "Guaifenesin Sodium citrate Syrup", the brand/trade name is "Guaifenesin Sodium citrate Syrup", active ingredients are ["Guaifenesin", "Sodium citrate"], and the indication is cough expectorant / chest congestion relief.

Analyze the package typography, markings, formulation, and labeling carefully:
1. Proprietary / Brand name: Identify the exact commercial trade name and manufacturer/lab if visible.
2. Generic formulation: Identify the scientific International Nonproprietary Name (INN) / generic drug names.
3. Active ingredients & exact strengths: List all active pharmaceutical substances along with their respective dosage/strengths if readable (e.g., ["Guaifenesin 100mg/5mL", "Sodium citrate 45mg/5mL"]).
4. Inactive excipients: List all visible inactive ingredients, specifically noting sugars/syrup, alcohol, preservatives, or artificial dyes.
5. Mechanism & Clinical Purpose: Provide a clear, structured explanation answering:
   - What condition or symptoms this medication is specifically formulated to treat (e.g. productive cough, chest congestion).
   - What clinical drug class it belongs to and the therapeutic role of each active component (e.g., expectorant/mucolytic to thin phlegm).
   - Expected therapeutic outcome.
6. Warnings & Precautions: Critical contraindications, safety alerts.
7. Common side effects: Frequent and notable side effects.
8. Drug & condition interactions: Interactions with other medications and chronic health conditions.

Return ONLY a valid JSON object matching this schema:
{
  "is_medication": true,
  "non_medication_detected": null,
  "name": "Exact visible trade name on the package (NEVER 'Scanned Medication')",
  "generic_name": "Scientific INN generic name(s) (NEVER 'Pharmaceutical Product')",
  "active_ingredients": ["Active substance 1 (strength)", "Active substance 2 (strength)"],
  "inactive_ingredients": ["Excipient 1", "Excipient 2"],
  "purpose": "Comprehensive clinical mechanism, therapeutic class, and exact medical indication explaining what this medication is for",
  "manufacturer": "Visible manufacturer or laboratory name, or null",
  "warnings": "Critical warnings, precautions, and contraindications",
  "side_effects": "Common and notable side effects",
  "interactions": "Known drug/food/condition interactions"
}`;

    let messages: any[] = [];
    if (imageBase64 || imageUrl) {
      messages = [{
        role: 'user',
        content: [
          { type: 'text', text: systemPrompt },
          {
            type: 'image_url',
            image_url: {
              url: imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : imageUrl,
              detail: 'high'
            }
          }
        ]
      }];
    } else {
      messages = [{
        role: 'user',
        content: `${systemPrompt}\n\nMEDICATION NAME / BARCODE QUERY: ${inputMedName || barcode}`
      }];
    }

    const visionResult = await callChatCompletionWithFallback({
      model: 'gpt-4o',
      messages,
      temperature: 0.1,
      max_tokens: 1200,
      response_format: { type: 'json_object' }
    });

    let medData = parseJSONSafely(visionResult.choices[0]?.message?.content);

    // ZERO-TOLERANCE NON-MEDICATION GATE
    if (medData.is_medication === false) {
      const detectedItem = medData.non_medication_detected || 'non-medicinal product';
      console.warn(`[analyze-medication] Non-medication rejected: ${detectedItem}`);
      return NextResponse.json({
        error: 'Be serious. This is not a medicine at all.',
        message: 'Be serious. This is not a medicine at all.',
        is_medication: false,
        detected_item: detectedItem
      }, { status: 422 });
    }

    // Second-pass retry if the vision model failed to parse or returned generic placeholder strings
    const isPlaceholder = !medData.name || 
      medData.name.toLowerCase().includes('scanned medication') || 
      !medData.purpose || 
      medData.purpose.toLowerCase().includes('medication indication') ||
      medData.generic_name?.toLowerCase().includes('pharmaceutical product');

    if (isPlaceholder && (imageBase64 || imageUrl)) {
      console.info('[analyze-medication] Primary pass yielded placeholder; executing second-pass typography OCR...');
      try {
        const retryPrompt = `Look closely at the image of the medicine box/bottle.
Read the literal words and numbers printed on the box.
1. What is the prominent medicine title on the box? (e.g. "Guaifenesin Sodium citrate Syrup")
2. What are the active drug ingredients? (e.g. Guaifenesin, Sodium citrate)
3. What is the generic class and indication? (e.g. Expectorant cough syrup)

Return ONLY valid JSON:
{
  "name": "Exact printed trade name",
  "generic_name": "Generic INN name",
  "active_ingredients": ["Active ingredient 1", "Active ingredient 2"],
  "inactive_ingredients": ["Visible excipients"],
  "purpose": "Specific therapeutic purpose and mechanism",
  "manufacturer": "Brand/Company name",
  "warnings": "Contraindications and warnings",
  "side_effects": "Notable side effects",
  "interactions": "Known interactions"
}`;

        const retryResult = await callChatCompletionWithFallback({
          model: 'gpt-4o',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: retryPrompt },
              {
                type: 'image_url',
                image_url: {
                  url: imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : imageUrl,
                  detail: 'high'
                }
              }
            ]
          }],
          temperature: 0.0,
          max_tokens: 800,
          response_format: { type: 'json_object' }
        });

        const retryParsed = parseJSONSafely(retryResult.choices[0]?.message?.content);
        if (retryParsed.name && !retryParsed.name.toLowerCase().includes('scanned medication')) {
          medData = { ...medData, ...retryParsed };
        }
      } catch (retryErr) {
        console.warn('[analyze-medication] Second-pass retry error:', retryErr);
      }
    }

    const medName = medData.name || inputMedName || 'Scanned Medication';
    const genericName = medData.generic_name || (medData.active_ingredients?.length ? medData.active_ingredients.join(', ') : 'Pharmaceutical Product');
    const activeIngredients: string[] = Array.isArray(medData.active_ingredients) && medData.active_ingredients.length > 0 
      ? medData.active_ingredients 
      : [genericName];
    const inactiveIngredients: string[] = Array.isArray(medData.inactive_ingredients) ? medData.inactive_ingredients : [];
    const fullTextSearch = `${medName} ${genericName} ${activeIngredients.join(' ')} ${inactiveIngredients.join(' ')} ${medData.warnings || ''} ${medData.purpose || ''}`.toLowerCase();

    // 3. ONBOARDING SAFETY GATE EVALUATION (Allergies & Medical Conditions)
    let isSuitable = true;
    let safetyReason = '';
    let matchedCondition = '';

    // Check Allergies
    for (const allergy of userSafetyProfile.allergies) {
      const normAllergy = allergy.toLowerCase();
      if (normAllergy.length > 2 && fullTextSearch.includes(normAllergy)) {
        isSuitable = false;
        matchedCondition = `Allergy (${allergy})`;
        safetyReason = `contains ${allergy}, which matches your declared allergy`;
        break;
      }
    }

    // Check Diabetic Contraindications
    if (isSuitable && userSafetyProfile.isDiabetic) {
      const diabeticRisks = ['syrup', 'sucrose', 'high sugar', 'corticosteroid', 'prednisone', 'dexamethasone'];
      const foundRisk = diabeticRisks.find(r => fullTextSearch.includes(r));
      if (foundRisk) {
        isSuitable = false;
        matchedCondition = 'Diabetic Condition';
        safetyReason = `contains ${foundRisk} which can significantly raise blood sugar levels and is unsuitable for diabetic patients`;
      }
    }

    // Check Hypertension Contraindications
    if (isSuitable && userSafetyProfile.hasHypertension) {
      const bpRisks = ['pseudoephedrine', 'phenylephrine', 'decongestant', 'nsaid', 'ibuprofen', 'naproxen'];
      const foundRisk = bpRisks.find(r => fullTextSearch.includes(r));
      if (foundRisk) {
        isSuitable = false;
        matchedCondition = 'Hypertension';
        safetyReason = `contains ${foundRisk} which elevates blood pressure and is contraindicated for high blood pressure`;
      }
    }

    // 4. Clinical Recommendation & Alternative Medication Synthesis
    const synthesisPrompt = `You are the chief medical & pharmacological officer for VicCalary.
${langDirective}

MEDICATION PACKET:
- Trade Name: ${medName}
- Generic Name: ${genericName}
- Active Ingredients: ${activeIngredients.join(', ')}
- Indication / Purpose: ${medData.purpose}
- Warnings: ${medData.warnings}

USER ONBOARDING HEALTH PROFILE:
- Declared Allergies: ${userSafetyProfile.allergies.length ? userSafetyProfile.allergies.join(', ') : 'None'}
- Declared Medical Conditions: ${userSafetyProfile.medicalConditions.length ? userSafetyProfile.medicalConditions.join(', ') : 'None'}
- Is Diabetic: ${userSafetyProfile.isDiabetic ? 'YES' : 'NO'}
- Has Hypertension: ${userSafetyProfile.hasHypertension ? 'YES' : 'NO'}
- SAFETY EVALUATION DETERMINATION: ${isSuitable ? 'SUITABLE / APPROVED' : `UNSUITABLE / REJECTED (${matchedCondition}: ${safetyReason})`}

INSTRUCTIONS:
1. If UNSUITABLE / REJECTED:
   - Set "is_recommended": false, "healthStatus": "POOR".
   - Start "recommendation" with an explicit, high-priority safety warning in '${userLang}':
     "Hey, ${medName} is not suitable for your profile because it ${safetyReason}. Avoid taking this medication!"
   - CRITICAL MANDATORY REQUIREMENT: You MUST name and suggest a suitable, safe ALTERNATIVE MEDICINE for their indication (e.g. for diabetic cough syrup -> sugar-free cough syrup; for NSAID allergy -> Acetaminophen / Paracetamol).
2. If SUITABLE / APPROVED:
   - Set "is_recommended": true, "healthStatus": "GOOD".
   - Provide clear, reassuring guidance on proper usage and adherence to doctor/pharmacist instructions.

Return ONLY a JSON object:
{
  "description": "A comprehensive, clear clinical paragraph explaining exactly what this medication is, its therapeutic classification, why it is prescribed or taken, and how its active components function together for symptom relief.",
  "recommendation": "A thorough paragraph with the safety verdict, clear warnings if unsuitable, and instructions.",
  "alternative_medicine": "Name and brief explanation of a safe alternative medication if unsuitable, or null if suitable",
  "is_recommended": ${isSuitable ? 'true' : 'false'},
  "healthStatus": "${isSuitable ? 'GOOD' : 'POOR'}"
}`;

    const synthesisResult = await callChatCompletionWithFallback({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: synthesisPrompt }],
      temperature: 0.2,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    });

    const synthData = parseJSONSafely(synthesisResult.choices[0]?.message?.content);

    return NextResponse.json({
      name: medName,
      productName: medName,
      generic_name: genericName,
      active_ingredients: activeIngredients,
      inactive_ingredients: inactiveIngredients,
      type: 'MEDICATION',
      category: 'Pharmacy & Health',
      brand: medData.manufacturer || 'Pharmacy',
      description: synthData.description || `${medName} (${genericName}). ${medData.purpose || ''}`,
      purpose: medData.purpose || 'Medication indication',
      warnings: medData.warnings || 'Consult physician before use.',
      side_effects: medData.side_effects || 'Common side effects as listed on package.',
      interactions: medData.interactions || 'Check with pharmacist for drug interactions.',
      recommendation: synthData.recommendation || medData.warnings,
      alternative_medicine: synthData.alternative_medicine || null,
      healthStatus: isSuitable ? 'GOOD' : 'POOR',
      is_recommended: isSuitable,
      is_compliant: isSuitable,
      user_alignment_boolean: isSuitable,
      status: isSuitable ? 'APPROVED' : 'FLAGGED',
      needs_crowdsourcing: false
    });

  } catch (error: any) {
    console.error('[analyze-medication] Error:', error.message || error);
    return NextResponse.json({ error: error.message || 'Medication analysis failed' }, { status: 500 });
  }
}
