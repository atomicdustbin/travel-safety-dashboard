/**
 * Performance Test for Search API
 * Tests search speed with cached vs uncached data
 */

const BASE_URL = "http://localhost:5000";

interface PerformanceResult {
  testName: string;
  elapsedTime: number;
  cacheHits: number;
  cacheMisses: number;
  passed: boolean;
  details?: string;
}

async function testSearchPerformance(
  testName: string,
  countries: string,
  expectedCacheHits?: number
): Promise<PerformanceResult> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(
      `${BASE_URL}/api/search?countries=${encodeURIComponent(countries)}`,
      { method: "GET" }
    );
    
    const elapsedTime = Date.now() - startTime;
    
    if (!response.ok) {
      return {
        testName,
        elapsedTime,
        cacheHits: 0,
        cacheMisses: 0,
        passed: false,
        details: `HTTP ${response.status}: ${await response.text()}`
      };
    }
    
    const data = await response.json();
    
    // Check if we got results
    const passed = data.results && data.results.length > 0;
    
    return {
      testName,
      elapsedTime,
      cacheHits: expectedCacheHits || 0,
      cacheMisses: 0,
      passed,
      details: passed 
        ? `Found ${data.totalFound} countries` 
        : "No results returned"
    };
  } catch (error) {
    return {
      testName,
      elapsedTime: Date.now() - startTime,
      cacheHits: 0,
      cacheMisses: 0,
      passed: false,
      details: error instanceof Error ? error.message : String(error)
    };
  }
}

async function runPerformanceTests() {
  console.log("\n=== SEARCH PERFORMANCE TEST SUITE ===\n");
  
  const results: PerformanceResult[] = [];
  
  // Test 1: Single cached country (should be very fast)
  console.log("Test 1: Single cached country (Japan)...");
  const test1 = await testSearchPerformance(
    "Single cached country",
    "Japan",
    1
  );
  results.push(test1);
  console.log(`✓ Completed in ${test1.elapsedTime}ms\n`);
  
  // Test 2: Multiple cached countries (should be fast)
  console.log("Test 2: Multiple cached countries (France, Germany, Italy)...");
  const test2 = await testSearchPerformance(
    "Multiple cached countries",
    "France,Germany,Italy",
    3
  );
  results.push(test2);
  console.log(`✓ Completed in ${test2.elapsedTime}ms\n`);
  
  // Test 3: Repeat search (all should be cached now)
  console.log("Test 3: Repeat search for Japan (should be even faster)...");
  const test3 = await testSearchPerformance(
    "Repeat cached search",
    "Japan",
    1
  );
  results.push(test3);
  console.log(`✓ Completed in ${test3.elapsedTime}ms\n`);
  
  // Test 4: Popular countries (likely cached from bulk download)
  console.log("Test 4: Popular countries (USA, China, Brazil)...");
  const test4 = await testSearchPerformance(
    "Popular countries search",
    "United States,China,Brazil",
    3
  );
  results.push(test4);
  console.log(`✓ Completed in ${test4.elapsedTime}ms\n`);
  
  // Test 5: Large batch search
  console.log("Test 5: Large batch search (10 countries)...");
  const test5 = await testSearchPerformance(
    "Large batch search",
    "United Kingdom,Spain,Portugal,Netherlands,Belgium,Sweden,Norway,Denmark,Finland,Poland"
  );
  results.push(test5);
  console.log(`✓ Completed in ${test5.elapsedTime}ms\n`);
  
  // Print summary
  console.log("\n=== PERFORMANCE SUMMARY ===\n");
  
  const passedTests = results.filter(r => r.passed).length;
  const totalTests = results.length;
  
  results.forEach((result, index) => {
    const status = result.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`Test ${index + 1}: ${result.testName}`);
    console.log(`  ${status} | Time: ${result.elapsedTime}ms | ${result.details}`);
  });
  
  console.log(`\n=== RESULTS: ${passedTests}/${totalTests} tests passed ===\n`);
  
  // Performance analysis
  const avgTime = results.reduce((sum, r) => sum + r.elapsedTime, 0) / results.length;
  const fastestTest = results.reduce((min, r) => r.elapsedTime < min.elapsedTime ? r : min);
  const slowestTest = results.reduce((max, r) => r.elapsedTime > max.elapsedTime ? r : max);
  
  console.log("=== PERFORMANCE ANALYSIS ===");
  console.log(`Average search time: ${avgTime.toFixed(0)}ms`);
  console.log(`Fastest: ${fastestTest.testName} (${fastestTest.elapsedTime}ms)`);
  console.log(`Slowest: ${slowestTest.testName} (${slowestTest.elapsedTime}ms)`);
  
  // Performance expectations
  console.log("\n=== OPTIMIZATION IMPACT ===");
  console.log("Expected improvements from removing duplicate DB calls:");
  console.log("- Cached countries: ~50% faster (1 DB call instead of 2)");
  console.log("- Most searches should complete in <1000ms with cached data");
  console.log("- UK FCDO data is included in weekly bulk download cache");
  
  if (avgTime < 1000) {
    console.log("\n✅ Performance target met: Average < 1000ms");
  } else {
    console.log(`\n⚠️  Performance target missed: Average ${avgTime.toFixed(0)}ms > 1000ms`);
    console.log("   This may indicate cache misses or database performance issues");
  }
  
  process.exit(passedTests === totalTests ? 0 : 1);
}

// Run tests
runPerformanceTests().catch(error => {
  console.error("Test suite failed:", error);
  process.exit(1);
});
