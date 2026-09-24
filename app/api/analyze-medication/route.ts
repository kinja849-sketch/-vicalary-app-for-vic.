import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { SafetyEngine } from '@/lib/services/SafetyEngine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrl, imageBase64, barcode, medicationName: inputMedName, userId, locationContext } = body;

    if (!imageUrl && !imageBase64 && !barcode && !inputMedName) {
      return NextResponse.json({ error: 'Medication image, barcode, or name is required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // 1. Load User Safety Profile from Onboarding & Settings
    const userSafetyProfile = userId 
      ? await SafetyEngine.getUserSafetyProfile(userId, supabase, locationContext?.language || 'en')
      : {
          userId: 'anonymous',
          userGoal: 'stay healthy',
          dailyCalorieGoal: 2000,
          allergies: [],
          medicalConditions: [],
          dietaryLifestyle: [],
          isDiabetic: false,
          hasHypertension: false,
          language: locationContext?.language || 'en'
        };

    const userLang = userSafetyProfile.language;

    // 2. Identify Medication details via OpenAI Vision or GPT
    const systemPrompt = `You are a clinical pharmacologist and medication safety engine.
Analyze the medication package photo or product name carefully.
Extract:
- Proprietary / Brand name
- Generic name
- Active ingredients & strength
- Key purpose & therapeutic indication
- Documented warnings & contraindications
- Common side effects
- Drug & condition interactions

Return ONLY a valid JSON object matching this schema:
{
  "name": "Brand/Trade Name of medication",
  "generic_name": "Generic active pharmaceutical ingredient name(s)",
  "active_ingredients": ["Ingredient 1", "Ingredient 2"],
  "inactive_ingredients": ["Sugar syrup", "Lactose", "Gelatin", "Starch"],
  "purpose": "Primary medical indication and dosage form",
  "warnings": "Critical warnings, precautions, and contraindications",
  "side_effects": "Common side effects",
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

    const visionRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        response_format: { type: 'json_object' }
      })
    });

    if (!visionRes.ok) {
      const errText = await visionRes.text();
      console.error('[analyze-medication] OpenAI Vision error:', errText);
      throw new Error(`OpenAI Vision analysis failed: ${errText}`);
    }

    const visionJson = await visionRes.json();
    const medData = JSON.parse(visionJson.choices[0].message.content || '{}');

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
Write a clinical evaluation and recommendation for the scanned medication in language code '${userLang}'.

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
  "description": "A clear, clinical paragraph explaining what this medication is, its generic class, and primary indication.",
  "recommendation": "A thorough paragraph with the safety verdict, clear warnings if unsuitable, and instructions.",
  "alternative_medicine": "Name and brief explanation of a safe alternative medication if unsuitable, or null if suitable",
  "is_recommended": ${isSuitable ? 'true' : 'false'},
  "healthStatus": "${isSuitable ? 'GOOD' : 'POOR'}"
}`;

    const synthesisRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: synthesisPrompt }],
        response_format: { type: 'json_object' }
      })
    });

    if (!synthesisRes.ok) {
      const errText = await synthesisRes.text();
      console.error('[analyze-medication] Synthesis OpenAI error:', errText);
      throw new Error(`OpenAI Synthesis failed: ${errText}`);
    }

    const synthesisJson = await synthesisRes.json();
    const synthData = JSON.parse(synthesisJson.choices[0].message.content || '{}');

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
