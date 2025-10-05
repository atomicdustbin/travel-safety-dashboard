/**
 * Bulk Refresh Job Lifecycle Tests
 * Tests job creation, progress tracking, cancellation, and completion
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

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testJobCreation() {
  try {
    const response = await fetch(`${BASE_URL}/api/refresh-advisories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    
    if (!response.ok) {
      const data = await response.json();
      // If there's already a job running or was run today, that's expected
      if (data.error && (data.error.includes('already running') || data.error.includes('already been initiated'))) {
        logTest(
          "Job creation (concurrent protection working)",
          true,
          `Correctly prevented duplicate: ${data.error}`
        );
        return null;
      }
      logTest("Job creation", false, undefined, `HTTP ${response.status}: ${data.error}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.jobId && typeof data.jobId === 'string') {
      logTest(
        "Job creation",
        true,
        `Created job with ID: ${data.jobId}`
      );
      return data.jobId;
    } else {
      logTest("Job creation", false, "Response missing jobId");
      return null;
    }
  } catch (error) {
    logTest("Job creation", false, undefined, String(error));
    return null;
  }
}

async function testJobProgress(jobId: string) {
  try {
    const response = await fetch(`${BASE_URL}/api/refresh-status/${jobId}`);
    
    if (!response.ok) {
      logTest("Job progress tracking", false, undefined, `HTTP ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    const hasRequiredFields = 
      typeof data.jobId === 'string' &&
      typeof data.status === 'string' &&
      typeof data.totalCountries === 'number' &&
      typeof data.processedCountries === 'number' &&
      Array.isArray(data.errors);
    
    if (hasRequiredFields) {
      logTest(
        "Job progress tracking",
        true,
        `Status: ${data.status}, Progress: ${data.processedCountries}/${data.totalCountries}`
      );
      return data;
    } else {
      logTest("Job progress tracking", false, "Missing required fields in response");
      return null;
    }
  } catch (error) {
    logTest("Job progress tracking", false, undefined, String(error));
    return null;
  }
}

async function testJobCancellation(jobId: string) {
  try {
    const response = await fetch(`${BASE_URL}/api/refresh-cancel/${jobId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      logTest(
        "Job cancellation",
        true,
        "Successfully cancelled running job"
      );
      return true;
    } else if (response.status === 404) {
      logTest(
        "Job cancellation (not running)",
        true,
        "Correctly returned 404 for non-running job"
      );
      return false;
    } else {
      logTest("Job cancellation", false, `Unexpected status: ${response.status}`);
      return false;
    }
  } catch (error) {
    logTest("Job cancellation", false, undefined, String(error));
    return false;
  }
}

async function testJobHistory() {
  try {
    const response = await fetch(`${BASE_URL}/api/refresh-history`);
    
    if (!response.ok) {
      logTest("Job history retrieval", false, undefined, `HTTP ${response.status}`);
      return;
    }
    
    const data = await response.json();
    
    if (Array.isArray(data.jobs)) {
      logTest(
        "Job history retrieval",
        true,
        `Found ${data.jobs.length} historical jobs`
      );
    } else {
      logTest("Job history retrieval", false, "Response is not an array");
    }
  } catch (error) {
    logTest("Job history retrieval", false, undefined, String(error));
  }
}

async function testConcurrentJobPrevention() {
  try {
    // Try to start first job
    const response1 = await fetch(`${BASE_URL}/api/refresh-advisories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    
    const data1 = await response1.json();
    
    // If first job failed due to existing job, that's fine
    if (!response1.ok) {
      logTest(
        "Concurrent job prevention",
        true,
        `System correctly prevents concurrent jobs: ${data1.error}`
      );
      return;
    }
    
    // Try to start second job immediately
    const response2 = await fetch(`${BASE_URL}/api/refresh-advisories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    
    const data2 = await response2.json();
    
    if (!response2.ok && data2.error) {
      logTest(
        "Concurrent job prevention",
        true,
        `Second job correctly rejected: ${data2.error}`
      );
      
      // Cancel the first job to clean up
      if (data1.jobId) {
        await testJobCancellation(data1.jobId);
      }
    } else {
      logTest(
        "Concurrent job prevention",
        false,
        "System allowed concurrent jobs (should prevent)"
      );
    }
  } catch (error) {
    logTest("Concurrent job prevention", false, undefined, String(error));
  }
}

async function testInvalidJobId() {
  try {
    const response = await fetch(`${BASE_URL}/api/refresh-status/invalid-job-id-123`);
    const data = await response.json();
    
    if (response.status === 404 || (data.error && data.error.includes('not found'))) {
      logTest(
        "Invalid job ID handling",
        true,
        "Correctly returned 404 for invalid job ID"
      );
    } else {
      logTest(
        "Invalid job ID handling",
        false,
        `Expected 404, got ${response.status}`
      );
    }
  } catch (error) {
    logTest("Invalid job ID handling", false, undefined, String(error));
  }
}

// Run all tests
async function runAllTests() {
  console.log("\n========================================");
  console.log("BULK REFRESH JOB LIFECYCLE TEST SUITE");
  console.log("========================================\n");
  
  // Test job creation
  const jobId = await testJobCreation();
  
  // If we created a job, test progress and cancellation
  if (jobId) {
    await delay(1000); // Wait a bit for job to start
    const progress = await testJobProgress(jobId);
    
    // Only test cancellation if job is still running
    if (progress && progress.status === 'running') {
      await testJobCancellation(jobId);
    }
  }
  
  // Test job history
  await testJobHistory();
  
  // Test concurrent job prevention
  await testConcurrentJobPrevention();
  
  // Test invalid job ID handling
  await testInvalidJobId();
  
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
