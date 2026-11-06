import { runNutritionalAccuracyBenchmark } from '../lib/testing/NutritionalAccuracyBenchmark';

async function main() {
  console.log('================================================================================');
  console.log(' VICCALARY NUTRITIONAL ACCURACY, SCANNER & FOOD RECOGNITION BENCHMARK SUITE');
  console.log('================================================================================\n');

  const report = await runNutritionalAccuracyBenchmark();

  console.log('--- MANDATORY EXAMPLES (A - F) ---');
  for (const ex of report.mandatory_examples) {
    const status = ex.passed ? 'PASS' : 'FAIL';
    console.log(`[${status}] Example ${ex.example_id}: ${ex.title}`);
    console.log(`       Details:  ${ex.details}`);
    console.log(`       Observed: ${JSON.stringify(ex.observed)}\n`);
  }

  console.log('--- BENCHMARK METRICS BY CATEGORY (306 TOTAL CASES) ---');
  for (const m of report.metrics_by_category) {
    console.log(`* ${m.category}`);
    console.log(
      `  Cases: ${m.total_cases} | Baseline: ${m.baseline_passed}/${m.total_cases} (${m.baseline_accuracy_pct}%) -> Post-Implementation: ${m.post_impl_passed}/${m.total_cases} (${m.post_impl_accuracy_pct}%) [+${m.improvement_pct_points}%]`
    );
  }

  console.log('\n================================================================================');
  console.log(
    `OVERALL ACCURACY (${report.total_test_cases} cases): Baseline ${report.overall_baseline_accuracy_pct}% -> Post-Implementation ${report.overall_post_impl_accuracy_pct}%`
  );
  console.log('================================================================================');

  const anyFailed =
    report.mandatory_examples.some((e) => !e.passed) ||
    report.metrics_by_category.some((m) => m.post_impl_passed < m.total_cases);

  if (anyFailed) {
    console.error('Benchmark had failing assertions.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Benchmark error:', err);
  process.exit(1);
});

