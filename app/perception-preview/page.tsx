"use client"
import React, { useState } from 'react';
import { MealAnalysis } from '@/components/MealAnalysis';
import { ProductDetails } from '@/components/ProductDetails';

export default function PerceptionPreviewPage() {
  const [activeView, setActiveView] = useState<'NONE' | 'MEAL' | 'PRODUCT_FLAGGED' | 'PRODUCT_CLEARED' | 'MEDICATION'>('NONE');

  const mockMeal = {
    mealImage: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=800",
    analysis: {
      name: "Grilled Herb Chicken Bowl with Quinoa & Steamed Greens",
      description: "A balanced, nutrient-dense Mediterranean-style bowl featuring approximately 160g of seasoned chargrilled chicken breast resting on a bed of fluffy tri-color quinoa, accompanied by steamed florets of broccoli, tender baby spinach, and sliced cherry tomatoes.\n\nThe ingredients appear freshly prepared with minimal visible heavy oil, seasoned primarily with dried oregano, cracked black pepper, and a light olive oil glaze.",
      vitamins_and_nutrition: "This meal provides high-biological-value complete proteins supporting muscle synthesis and recovery, paired with low-glycemic complex carbohydrates from quinoa that offer steady glucose release.\n\nBroccoli and spinach contribute significant dietary fiber alongside rich concentrations of Vitamin C, Folate, and Vitamin K, while the chicken supplies essential B-complex vitamins (especially B6 and B3) and bioavailable zinc.",
      recommendation: "Highly recommended for your active Lean Bulk & Caloric Control objective. The lean chicken breast and fiber-dense grains seamlessly align with your 2,150 kcal daily target without exceeding your 65g daily saturated fat threshold.",
      verdict: "GOOD",
      is_recommended: true,
      calories: 540,
      calorie_range: { min: 475, max: 605 },
      protein: 48,
      carbs: 52,
      fat: 14,
      fiber: 9,
      sugar: 4,
      sodium_mg: 380,
      vitamins: ["Vitamin C (85% DV)", "Vitamin K (120% DV)", "Vitamin B6", "Folate"],
      minerals: ["Potassium (620mg)", "Iron (3.8mg)", "Zinc", "Magnesium"]
    }
  };

  const mockProductFlagged = {
    productName: "Lay's Classic Potato Chips 184g",
    brand: "Lay's",
    manufacturer: "PepsiCo",
    category: "Snacks",
    productImage: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&q=80&w=600",
    status: "FLAGGED",
    is_compliant: false,
    boycott: {
      flagged: true,
      campaignName: "Boycott, Divestment, Sanctions (BDS Movement)",
      companyName: "Lay's",
      parentCompany: "PepsiCo, Inc.",
      relationshipType: "SUBSIDIARY_OF",
      reason: "PepsiCo owns 100% of SodaStream and operates active commercial manufacturing facilities in occupied industrial zones in the West Bank.",
      sourceUrl: "https://bdsmovement.net/get-involved/what-to-boycott"
    },
    cheaper_alternatives: [
      { name: "Kusuka Cassava Chips", price: "Rp 9.500", reason: "Local Indonesian Ethical Manufacturer" },
      { name: "Tropicana Slim Corn Chips", price: "Rp 14.200", reason: "Non-flagged Healthy Snack Alternative" }
    ]
  };

  const mockProductCleared = {
    productName: "Biokul Greek Style Plain Yogurt 470g",
    brand: "Biokul",
    manufacturer: "PT Diamond Cold Storage",
    category: "Dairy & Yogurt",
    productImage: "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&q=80&w=600",
    servingSize: "100g",
    serving_basis: "serving",
    status: "APPROVED",
    is_compliant: true,
    description: "Biokul Greek Style Plain Yogurt is a strained fermented dairy product produced with live active probiotic cultures (Lactobacillus bulgaricus & Streptococcus thermophilus). It contains no added cane sugar, artificial colors, or chemical thickeners.",
    vitamins_and_nutrition: "Provides approximately 9.2g of protein per 100g serving with high calcium bioavailability, supporting bone density and muscular recovery. Probiotic strains aid healthy gut flora regulation and improved gastrointestinal barrier function.",
    recommendation: "Excellent fit for your daily protein intake and digestive health goals. Can be paired with fresh berries or chia seeds for a low-sugar afternoon energy boost.",
    healthStatus: "GOOD",
    calories: 120,
    protein: 9.2,
    carbs: 6.4,
    fat: 6.8,
    sugar: 4.1,
    fiber: 0,
    sodium_mg: 55,
    vitamins: ["Vitamin B12", "Riboflavin (B2)"],
    minerals: ["Calcium (180mg)", "Phosphorus"],
    price: 34500,
    estimated_price: "Rp 34.500",
    price_metadata: {
      amount: 34500,
      currency: "IDR",
      source: "Verified Retail Cache (Super Indo / Indomaret)",
      retrievedAt: new Date().toISOString()
    }
  };

  const mockMedication = {
    productName: "Paracetamol 500mg Tablet",
    type: "MEDICATION",
    generic_name: "Acetaminophen / Paracetamol",
    purpose: "Analgesic and antipyretic agent indicated for the temporary relief of mild-to-moderate pain (headaches, muscular aches) and reduction of fever.",
    description: "Paracetamol acts predominantly on the central nervous system to inhibit prostaglandin synthesis, elevating the pain threshold and acting on the hypothalamic heat-regulating center.",
    warnings: "Do not exceed 4,000mg within a 24-hour window. Concomitant consumption with alcohol increases the risk of severe hepatotoxicity.",
    side_effects: "Rare at therapeutic doses; may include mild skin rash, nausea, or elevated hepatic transaminases with prolonged high dosage.",
    interactions: "Warfarin (may enhance anticoagulant effect with prolonged daily use), Isoniazid, Cholestyramine.",
    estimated_price: "Rp 8.500 / strip",
    price_metadata: {
      amount: 8500,
      currency: "IDR",
      source: "Kimia Farma / K-24 Official Catalog"
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f14] text-white p-6 flex flex-col items-center justify-center">
      <div className="max-w-md w-full space-y-6 text-center">
        <h1 className="text-2xl font-black tracking-tight text-white">
          Perception Views Verification
        </h1>
        <p className="text-sm text-slate-400">
          Select any view to verify dedicated full-screen layout, back navigation, Boycott STOP Gate, verified pricing, and budget protection.
        </p>

        <div className="space-y-3 pt-4">
          <button
            onClick={() => setActiveView('MEAL')}
            className="w-full py-4 bg-vic-blue hover:bg-vic-blue/90 text-white rounded-2xl font-bold text-sm shadow-lg transition-all"
          >
            1. Dedicated Meal Analysis Screen
          </button>

          <button
            onClick={() => setActiveView('PRODUCT_FLAGGED')}
            className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-bold text-sm shadow-lg transition-all"
          >
            2. Scanner: Boycott STOP Gate (Flagged Product)
          </button>

          <button
            onClick={() => setActiveView('PRODUCT_CLEARED')}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-sm shadow-lg transition-all"
          >
            3. Scanner: Cleared Product with Verified Price
          </button>

          <button
            onClick={() => setActiveView('MEDICATION')}
            className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-bold text-sm shadow-lg transition-all"
          >
            4. Scanner: Medication Intelligence Screen
          </button>
        </div>
      </div>

      {activeView === 'MEAL' && (
        <MealAnalysis
          mealImage={mockMeal.mealImage}
          analysis={mockMeal.analysis}
          onClose={() => setActiveView('NONE')}
          onLog={() => {
            alert("Meal logged to diary! Note: No budget deduction created.");
            setActiveView('NONE');
          }}
        />
      )}

      {activeView === 'PRODUCT_FLAGGED' && (
        <ProductDetails
          {...mockProductFlagged}
          onClose={() => setActiveView('NONE')}
        />
      )}

      {activeView === 'PRODUCT_CLEARED' && (
        <ProductDetails
          {...mockProductCleared}
          onClose={() => setActiveView('NONE')}
          onAddToDiary={() => {
            alert("Purchase confirmed! Financial transaction created in budget.");
            setActiveView('NONE');
          }}
        />
      )}

      {activeView === 'MEDICATION' && (
        <ProductDetails
          {...mockMedication}
          onClose={() => setActiveView('NONE')}
        />
      )}
    </div>
  );
}
