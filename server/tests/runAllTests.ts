/**
 * Master Test Runner
 * Executes all test suites and provides a summary
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface TestSuiteResult {
  name: string;
  passed: boolean;
  output: string;
  error?: string;
}

const testSuites = [
  { name: 'Search Functionality', file: 'server/tests/searchTest.ts' },
  { name: 'Bulk Refresh', file: 'server/tests/bulkRefreshTest.ts' },
  { name: 'PDF Export', file: 'server/tests/pdfExportTest.ts' },
];

async function runTestSuite(name: string, file: string): Promise<TestSuiteResult> {
  try {
    console.log(`\nRunning ${name} tests...`);
    const { stdout, stderr } = await execAsync(`npx tsx ${file}`, { timeout: 60000 });
    
    return {
      name,
      passed: true,
      output: stdout + (stderr || '')
    };
  } catch (error: any) {
    return {
      name,
      passed: error.code === 0,
      output: error.stdout || '',
      error: error.stderr || error.message
    };
  }
}

async function runAllTests() {
  console.log("=".repeat(60));
  console.log("GLOBAL TRAVEL ADVISORY - COMPREHENSIVE TEST SUITE");
  console.log("=".repeat(60));
  
  const results: TestSuiteResult[] = [];
  
  for (const suite of testSuites) {
    const result = await runTestSuite(suite.name, suite.file);
    results.push(result);
    console.log(result.output);
    if (result.error) {
      console.error(`Error in ${suite.name}:`, result.error);
    }
  }
  
  // Print overall summary
  console.log("\n" + "=".repeat(60));
  console.log("OVERALL TEST SUMMARY");
  console.log("=".repeat(60));
  
  const passedSuites = results.filter(r => r.passed).length;
  const totalSuites = results.length;
  
  console.log(`\nTest Suites: ${passedSuites}/${totalSuites} passed\n`);
  
  results.forEach(result => {
    const status = result.passed ? "✓ PASS" : "✗ FAIL";
    console.log(`${status}: ${result.name}`);
  });
  
  console.log("\n" + "=".repeat(60));
  
  const allPassed = results.every(r => r.passed);
  process.exit(allPassed ? 0 : 1);
}

runAllTests().catch(error => {
  console.error("Test runner failed:", error);
  process.exit(1);
});
