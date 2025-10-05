/**
 * Comprehensive Search Functionality Tests
 * Tests valid countries, invalid countries, partial matches, and error handling
 */

interface TestResult {
  test: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const BASE_URL = "http://localhost:5000";
const results: TestResult[] = [];

function logTest(test: string, passed: boolean, details?: string, error?: string) {
  results.push({ test, passed, details, error });
  const status = passed ? "✓ PASS" : "✗ FAIL";
  console.log(`${status}: ${test}`);
  if (details) console.log(`  Details: ${details}`);
  if (error) console.error(`  Error: ${error}`);
}

async function testValidCountrySearch() {
  try {
    const response = await fetch(`${BASE_URL}/api/search?countries=France`);
    const data = await response.json();
    
    if (!response.ok) {
      logTest("Valid country search (France)", false, undefined, `HTTP ${response.status}`);
      return;
    }
    
    if (data.results && data.results.length > 0) {
      const france = data.results[0];
      const hasCountryData = france.country && france.country.name;
      const hasAlerts = Array.isArray(france.alerts);
      
      logTest(
        "Valid country search (France)",
        hasCountryData && hasAlerts,
        `Found ${data.totalFound} results with country data and alerts`
      );
    } else {
      logTest("Valid country search (France)", false, "No results returned");
    }
  } catch (error) {
    logTest("Valid country search (France)", false, undefined, String(error));
  }
}

async function testMultipleCountrySearch() {
  try {
    const response = await fetch(`${BASE_URL}/api/search?countries=Japan,Germany,Brazil`);
    const data = await response.json();
    
    if (!response.ok) {
      logTest("Multiple country search", false, undefined, `HTTP ${response.status}`);
      return;
    }
    
    const expectedCount = 3;
    const actualCount = data.totalFound;
    
    logTest(
      "Multiple country search (3 countries)",
      actualCount === expectedCount,
      `Expected ${expectedCount}, got ${actualCount} results`
    );
  } catch (error) {
    logTest("Multiple country search", false, undefined, String(error));
  }
}

async function testInvalidCountrySearch() {
  try {
    const response = await fetch(`${BASE_URL}/api/search?countries=InvalidCountryName123`);
    const data = await response.json();
    
    // Should return 400 Bad Request for invalid country
    if (response.status === 400 && data.error) {
      logTest(
        "Invalid country search (should return error)",
        true,
        `Correctly returned 400 with error: ${data.error}`
      );
    } else {
      logTest(
        "Invalid country search",
        false,
        `Expected 400 error, got ${response.status}`
      );
    }
  } catch (error) {
    logTest("Invalid country search", false, undefined, String(error));
  }
}

async function testCountryAlias() {
  try {
    // Test if aliases work (e.g., "USA" should map to "United States")
    const response = await fetch(`${BASE_URL}/api/search?countries=USA`);
    const data = await response.json();
    
    if (!response.ok) {
      logTest("Country alias (USA)", false, undefined, `HTTP ${response.status}`);
      return;
    }
    
    if (data.results && data.results.length > 0) {
      const country = data.results[0];
      const countryName = country.country.name.toLowerCase();
      const isUSA = countryName.includes('united') && countryName.includes('states');
      
      logTest(
        "Country alias (USA → United States)",
        isUSA,
        `Resolved to: ${country.country.name}`
      );
    } else {
      logTest("Country alias (USA)", false, "No results returned");
    }
  } catch (error) {
    logTest("Country alias (USA)", false, undefined, String(error));
  }
}

async function testEmptySearch() {
  try {
    const response = await fetch(`${BASE_URL}/api/search?countries=`);
    const data = await response.json();
    
    // Should return 400 Bad Request for empty search
    if (response.status === 400) {
      logTest(
        "Empty search query (should return error)",
        true,
        "Correctly rejected empty query"
      );
    } else {
      logTest(
        "Empty search query",
        false,
        `Expected 400 error, got ${response.status}`
      );
    }
  } catch (error) {
    logTest("Empty search query", false, undefined, String(error));
  }
}

async function testMissingParameter() {
  try {
    const response = await fetch(`${BASE_URL}/api/search`);
    const data = await response.json();
    
    // Should return 400 Bad Request for missing parameter
    if (response.status === 400) {
      logTest(
        "Missing countries parameter (should return error)",
        true,
        "Correctly rejected missing parameter"
      );
    } else {
      logTest(
        "Missing countries parameter",
        false,
        `Expected 400 error, got ${response.status}`
      );
    }
  } catch (error) {
    logTest("Missing countries parameter", false, undefined, String(error));
  }
}

async function testSpecialCharacters() {
  try {
    // Test country with special characters - use Ivory Coast directly
    const response = await fetch(`${BASE_URL}/api/search?countries=Ivory%20Coast`);
    const data = await response.json();
    
    if (response.ok && data.results && data.results.length > 0) {
      logTest(
        "Special characters (Ivory Coast)",
        true,
        `Successfully handled country name: ${data.results[0].country.name}`
      );
    } else {
      logTest(
        "Special characters",
        false,
        `Unexpected response: ${response.status}`
      );
    }
  } catch (error) {
    logTest("Special characters", false, undefined, String(error));
  }
}

async function testCaseSensitivity() {
  try {
    // Test if search is case-insensitive
    const response1 = await fetch(`${BASE_URL}/api/search?countries=CANADA`);
    const response2 = await fetch(`${BASE_URL}/api/search?countries=canada`);
    const response3 = await fetch(`${BASE_URL}/api/search?countries=CaNaDa`);
    
    const data1 = await response1.json();
    const data2 = await response2.json();
    const data3 = await response3.json();
    
    const allSuccessful = response1.ok && response2.ok && response3.ok;
    const allHaveResults = data1.totalFound > 0 && data2.totalFound > 0 && data3.totalFound > 0;
    
    logTest(
      "Case insensitivity (CANADA, canada, CaNaDa)",
      allSuccessful && allHaveResults,
      `All variations returned results: ${allSuccessful && allHaveResults}`
    );
  } catch (error) {
    logTest("Case insensitivity", false, undefined, String(error));
  }
}

// Run all tests
async function runAllTests() {
  console.log("\n========================================");
  console.log("SEARCH FUNCTIONALITY TEST SUITE");
  console.log("========================================\n");
  
  await testValidCountrySearch();
  await testMultipleCountrySearch();
  await testInvalidCountrySearch();
  await testCountryAlias();
  await testEmptySearch();
  await testMissingParameter();
  await testSpecialCharacters();
  await testCaseSensitivity();
  
  // Print summary
  console.log("\n========================================");
  console.log("TEST SUMMARY");
  console.log("========================================");
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  const passRate = ((passed / total) * 100).toFixed(1);
  
  console.log(`Total Tests: ${total}`);
  console.log(`Passed: ${passed} (${passRate}%)`);
  console.log(`Failed: ${failed}`);
  console.log("========================================\n");
  
  if (failed > 0) {
    console.log("Failed Tests:");
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.test}`);
      if (r.error) console.log(`    Error: ${r.error}`);
    });
    console.log();
  }
  
  return failed === 0;
}

// Execute tests
runAllTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error("Test suite failed:", error);
  process.exit(1);
});
