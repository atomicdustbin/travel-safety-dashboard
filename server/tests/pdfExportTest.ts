/**
 * PDF Export Functionality Tests
 * Tests PDF generation, error handling, and content validation
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

async function testValidPDFExport() {
  try {
    const response = await fetch(`${BASE_URL}/api/export/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countries: "France" })
    });
    
    if (!response.ok) {
      const data = await response.json();
      logTest("Valid PDF export (France)", false, undefined, `HTTP ${response.status}: ${data.error}`);
      return;
    }
    
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/pdf")) {
      const buffer = await response.arrayBuffer();
      const size = buffer.byteLength;
      
      // PDF should be at least 1KB
      if (size > 1024) {
        logTest(
          "Valid PDF export (France)",
          true,
          `Generated PDF of ${(size / 1024).toFixed(1)} KB`
        );
      } else {
        logTest(
          "Valid PDF export (France)",
          false,
          `PDF too small: ${size} bytes`
        );
      }
    } else {
      logTest(
        "Valid PDF export (France)",
        false,
        `Wrong content type: ${contentType}`
      );
    }
  } catch (error) {
    logTest("Valid PDF export (France)", false, undefined, String(error));
  }
}

async function testMultiCountryPDF() {
  try {
    const response = await fetch(`${BASE_URL}/api/export/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countries: "Japan, Germany, Brazil" })
    });
    
    if (!response.ok) {
      const data = await response.json();
      logTest("Multi-country PDF export", false, undefined, `HTTP ${response.status}: ${data.error}`);
      return;
    }
    
    const contentType = response.headers.get("content-type");
    const buffer = await response.arrayBuffer();
    const size = buffer.byteLength;
    
    // Multi-country PDF should be larger
    if (contentType?.includes("application/pdf") && size > 2048) {
      logTest(
        "Multi-country PDF export (3 countries)",
        true,
        `Generated PDF of ${(size / 1024).toFixed(1)} KB for 3 countries`
      );
    } else {
      logTest(
        "Multi-country PDF export",
        false,
        `Unexpected result: ${contentType}, ${size} bytes`
      );
    }
  } catch (error) {
    logTest("Multi-country PDF export", false, undefined, String(error));
  }
}

async function testInvalidCountryPDF() {
  try {
    const response = await fetch(`${BASE_URL}/api/export/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countries: "InvalidCountryXYZ" })
    });
    
    // Should return 400 Bad Request for invalid country
    if (response.status === 400) {
      const data = await response.json();
      logTest(
        "Invalid country PDF export (should error)",
        true,
        `Correctly returned 400: ${data.error}`
      );
    } else {
      logTest(
        "Invalid country PDF export",
        false,
        `Expected 400, got ${response.status}`
      );
    }
  } catch (error) {
    logTest("Invalid country PDF export", false, undefined, String(error));
  }
}

async function testEmptyCountriesPDF() {
  try {
    const response = await fetch(`${BASE_URL}/api/export/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countries: "" })
    });
    
    // Should return 400 Bad Request for empty countries
    if (response.status === 400) {
      logTest(
        "Empty countries PDF export (should error)",
        true,
        "Correctly rejected empty countries parameter"
      );
    } else {
      logTest(
        "Empty countries PDF export",
        false,
        `Expected 400, got ${response.status}`
      );
    }
  } catch (error) {
    logTest("Empty countries PDF export", false, undefined, String(error));
  }
}

async function testMissingBodyPDF() {
  try {
    const response = await fetch(`${BASE_URL}/api/export/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    
    // Should return 400 Bad Request for missing body
    if (response.status === 400) {
      logTest(
        "Missing request body (should error)",
        true,
        "Correctly rejected request without body"
      );
    } else {
      logTest(
        "Missing request body",
        false,
        `Expected 400, got ${response.status}`
      );
    }
  } catch (error) {
    logTest("Missing request body", false, undefined, String(error));
  }
}

async function testPDFFilenameHeader() {
  try {
    const response = await fetch(`${BASE_URL}/api/export/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countries: "Canada" })
    });
    
    if (!response.ok) {
      logTest("PDF filename header", false, undefined, `HTTP ${response.status}`);
      return;
    }
    
    const contentDisposition = response.headers.get("content-disposition");
    
    if (contentDisposition && contentDisposition.includes("attachment") && contentDisposition.includes(".pdf")) {
      logTest(
        "PDF filename header",
        true,
        `Found proper Content-Disposition: ${contentDisposition}`
      );
    } else {
      logTest(
        "PDF filename header",
        false,
        `Missing or invalid Content-Disposition header: ${contentDisposition}`
      );
    }
  } catch (error) {
    logTest("PDF filename header", false, undefined, String(error));
  }
}

// Run all tests
async function runAllTests() {
  console.log("\n========================================");
  console.log("PDF EXPORT FUNCTIONALITY TEST SUITE");
  console.log("========================================\n");
  
  await testValidPDFExport();
  await testMultiCountryPDF();
  await testInvalidCountryPDF();
  await testEmptyCountriesPDF();
  await testMissingBodyPDF();
  await testPDFFilenameHeader();
  
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
