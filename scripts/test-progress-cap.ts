// Test script for Meal Accumulation & Daily Calorie Cap & Coach Alert logic

function assertEq(actual: unknown, expected: unknown, stepName: string) {
  if (actual !== expected) {
    throw new Error(`${stepName} Failed: Expected ${expected}, got ${actual}`);
  }
}

class ProgressSimulator {
  goalCalories: number = 2000;
  currentConsumed: number = 0;
  mealsLogged: any[] = [];
  coachAlertsSent: any[] = [];

  simulateLogMeal(meal: { name: string; calories: number }): any {
    console.log(`\nAttempting to log meal: "${meal.name}" (${meal.calories} kcal)`);
    console.log(`Current consumed before log: ${this.currentConsumed} / ${this.goalCalories} kcal`);

    const previousConsumed = this.currentConsumed;
    this.currentConsumed = previousConsumed + meal.calories;
    this.mealsLogged.push(meal);

    const justAchieved = this.goalCalories > 0 && this.currentConsumed >= this.goalCalories && previousConsumed < this.goalCalories;
    const exceededGoal = this.goalCalories > 0 && this.currentConsumed > this.goalCalories;
    const caloriesLeft = this.goalCalories - this.currentConsumed;
    const percentage = Math.round((this.currentConsumed / this.goalCalories) * 100);

    console.log(`✅ ACCUMULATION SUCCESS: New consumed total = ${this.currentConsumed} kcal (${percentage}%), Left = ${caloriesLeft} kcal`);

    if (exceededGoal) {
      const alertMsg = `⚠️ Calorie Target Exceeded: Consumed ${this.currentConsumed} kcal against ${this.goalCalories} kcal goal. Coach alerted.`;
      console.log(`🚨 HEALTH COACH ALERT DISPATCHED: ${alertMsg}`);
      this.coachAlertsSent.push({
        consumed: this.currentConsumed,
        goal: this.goalCalories,
        excess: this.currentConsumed - this.goalCalories
      });
      return {
        capReached: true,
        exceededGoal: true,
        justAchieved,
        caloriesConsumed: this.currentConsumed,
        caloriesLeft,
        message: alertMsg
      };
    }

    if (justAchieved) {
      console.log(`🎉 GOAL ACHIEVED: Exactly reached daily target.`);
      return {
        capReached: true,
        justAchieved: true,
        caloriesConsumed: this.currentConsumed,
        caloriesLeft,
        message: "Congratulations! You've achieved your daily calorie goal today."
      };
    }

    return {
      success: true,
      caloriesConsumed: this.currentConsumed,
      caloriesLeft
    };
  }
}

function runSim() {
  console.log("=== DAILY PROGRESS ACCUMULATION & OVER-TARGET COACH ALERT VERIFICATION ===");
  const sim = new ProgressSimulator();

  // 1. Log First Meal
  const res1 = sim.simulateLogMeal({ name: "Avocado Toast & Egg", calories: 480 });
  assertEq(sim.currentConsumed, 480, "Step 1 Consumed");
  assertEq(res1.caloriesLeft, 1520, "Step 1 Left");
  if (res1.exceededGoal) throw new Error("Step 1 Failed: exceededGoal prematurely flagged");

  // 2. Log Second Meal (must ACCUMULATE, NOT overwrite)
  const res2 = sim.simulateLogMeal({ name: "Grilled Chicken Salad", calories: 650 });
  assertEq(sim.currentConsumed, 1130, "Step 2 Consumed");
  assertEq(res2.caloriesLeft, 870, "Step 2 Left");
  console.log("-> Step 2 PASSED: 480 kcal + 650 kcal accumulated to 1130 kcal (57%, 870 left)!");

  // 3. Log Third Meal (Pushes over 2000 kcal -> 2050 kcal, left is -50)
  const res3 = sim.simulateLogMeal({ name: "Salmon Dinner with Rice", calories: 920 });
  assertEq(sim.currentConsumed, 2050, "Step 3 Consumed");
  assertEq(res3.caloriesLeft, -50, "Step 3 Left (Negative)");
  if (!res3.exceededGoal) throw new Error("Step 3 Failed: exceededGoal flag was not set!");
  console.log("-> Step 3 PASSED: 1130 + 920 = 2050 kcal (103%, -50 LEFT) -> Coach Alert Dispatched!");

  // 4. Log Fourth Meal: User consumes 4500 total calories like in screenshot
  const res4 = sim.simulateLogMeal({ name: "Late Night Feast", calories: 2450 });
  assertEq(sim.currentConsumed, 4500, "Step 4 Consumed");
  assertEq(res4.caloriesLeft, -2500, "Step 4 Left (Negative -2500)");
  if (!res4.exceededGoal) throw new Error("Step 4 Failed: Expected exceededGoal!");
  console.log("-> Step 4 PASSED: Total consumed = 4500 kcal, Goal = 2000 kcal, Left = -2500 kcal. Fully recorded without zero-clamping!");

  console.log("\nALL TESTS PASSED: Negative remaining calories & Health Coach alert verified!\n");
}

runSim();
