"use client"
import React, { useState } from 'react';
import { MealAnalysis } from '@/components/MealAnalysis';
import { ProductDetails } from '@/components/ProductDetails';

export default function PerceptionPreviewPage() {
  const [activeView, setActiveView] = useState<'NONE' | 'MEAL' | 'PRODUCT_FLAGGED' | 'PRODUCT_CLEARED' | 'MEDICATION'>('NONE');

  const mockMeal = {
    mealImage: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=800",
    analysis: {
      name: "Potato & Tomato Stew with White Rice",
      description: "This dish presents a comforting home-style plate featuring a hearty simmered potato and tomato stew served alongside a generous portion of steamed fluffy white rice. The stew is prepared with tender, bite-sized potato chunks simmered in a rich tomato reduction, integrated with translucent sautéed onions that provide a natural aromatic sweetness throughout the savory sauce. Steamed white rice occupies half of the plate, providing a clean neutral grain foundation that absorbs the savory sauce.",
      vitamins_and_nutrition: "This meal provides easily digestible complex carbohydrates from both the steamed white rice and potatoes, offering sustained energy release and muscle glycogen replenishment. The simmered tomatoes are rich in lycopene—a potent antioxidant whose cellular bioavailability is enhanced through thermal cooking—along with Vitamin C and potassium from the potatoes to support fluid balance.",
      recommendation: "Recommended as a wholesome, low-fat carbohydrate-rich meal. The combination of root vegetables and steamed rice keeps total dietary fat exceptionally minimal (under 2g) while delivering 368 kcal. To optimize macronutrient distribution for muscle synthesis, consider pairing this dish with a lean protein source such as grilled chicken or boiled eggs.",
      verdict: "GOOD",
      is_recommended: true,
      calories: 368,
      calorie_range: { min: 330, max: 410 },
      protein: 8,
      carbs: 81,
      fat: 1,
      fiber: 4,
      sugar: 5,
      sodium_mg: 220,
      vitamins: ["Vitamin C", "Vitamin B6", "Vitamin A"],
      minerals: ["Potassium", "Iron", "Magnesium"],
      items: [
        {
          name: "Potatoes",
          count: "1x",
          variant_or_method: "stewed",
          portion_g: 150,
          portion_description: "1 medium potato (~150g)",
          calories: 131,
          protein: 2.9,
          carbs: 30.0,
          fat: 0.2,
          image_url: "https://www.themealdb.com/images/ingredients/Potatoes.png"
        },
        {
          name: "Tomatoes",
          count: "1x",
          variant_or_method: "stewed",
          portion_g: 70,
          portion_description: "in stew base (~70g)",
          calories: 13,
          protein: 0.6,
          carbs: 2.7,
          fat: 0.1,
          image_url: "https://www.themealdb.com/images/ingredients/Tomato.png"
        },
        {
          name: "Onions",
          count: "1x",
          variant_or_method: "cooked",
          portion_g: 40,
          portion_description: "sautéed aromatics (~40g)",
          calories: 16,
          protein: 0.5,
          carbs: 3.0,
          fat: 0.1,
          image_url: "https://www.themealdb.com/images/ingredients/Onion.png"
        },
        {
          name: "White Rice",
          count: "1x",
          variant_or_method: "steamed",
          portion_g: 160,
          portion_description: "1 cup cooked (~160g)",
          calories: 208,
          protein: 4.3,
          carbs: 45.1,
          fat: 0.5,
          image_url: "https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=300&q=80"
        }
      ]
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
