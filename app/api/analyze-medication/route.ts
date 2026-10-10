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
Your primary objective is to analyze the medication package photo or medication query and explain clearly, authoritatively, and comprehensively WHAT THE MEDICATION IS FOR, how it works, and how to use it safely.

Analyze the package typography, markings, formulation, and labeling carefully:
1. Proprietary / Brand name: Identify the exact commercial trade name and manufacturer/lab if visible.
2. Generic formulation: Identify the scientific International Nonproprietary Name (INN) / generic drug names.
3. Active ingredients & exact strengths: List all active pharmaceutical substances along with their respective dosage/strengths if readable (e.g., "Promethazine HCl 5mg/5mL", "Dextromethorphan HBr 15mg/5mL", "Guaifenesin 100mg/5mL", "Sodium Citrate 45mg/5mL").
4. Inactive excipients: List all visible inactive ingredients, specifically noting sugars/syrup, alcohol, preservatives, or artificial dyes.
5. Mechanism & Clinical Purpose: Provide a clear, structured explanation answering:
   - What condition or symptoms this medication is specifically formulated to treat.
   - What clinical drug class it belongs to and the therapeutic role of each active component (e.g., antitussive to suppress cough spasms, expectorant/mucolytic to thin phlegm, antihistamine to relieve nasal/throat allergy irritation).
   - Expected therapeutic outcome.
6. Warnings & Precautions: Critical contraindications, safety alerts (e.g., drowsiness, operating machinery, age restrictions, respiratory depression warnings, liver/kidney cautions).
7. Common side effects: Frequent and notable side effects (sedation, dry mouth, dizziness, GI upset).
8. Drug & condition interactions: Interactions with other medications (MAOIs, sedatives, SSRIs, alcohol) and chronic health conditions.

Return ONLY a valid JSON object matching this schema:
{
  "name": "Brand/Trade Name of medication",
  "generic_name": "Generic active pharmaceutical ingredient name(s)",
  "active_ingredients": ["Ingredient 1 (strength)", "Ingredient 2 (strength)"],
  "inactive_ingredients": ["Sugar syrup", "Alcohol", "Sodium benzoate"],
  "purpose": "Comprehensive clinical mechanism, therapeutic class, and exact medical indication explaining what this medication is for",
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
              detail: 'auto'
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
      max_tokens: 500,
      response_format: { type: 'json_object' }
    });

    const medData = parseJSONSafely(visionResult.choices[0]?.message?.content);

    const medName = medData.name || inputMedName || 'Scanned Medication';
    const genericName = medData.generic_name || 'Pharmaceutical Product';
    const activeIngredients: string[] = Array.isArray(medData.active_ingredients) ? medData.active_ingredients : [genericName];
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
