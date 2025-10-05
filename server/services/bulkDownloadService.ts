import { storage } from "../storage";
import { dataFetcher } from "./dataFetcher";
import { isAIEnhancementAvailable } from "../aiService";

export interface BulkDownloadProgress {
  jobId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  totalCountries: number;
  processedCountries: number;
  failedCountries: number;
  currentCountry: string | null;
  startedAt: Date;
  completedAt: Date | null;
  errors: Array<{ country: string; error: string }>;
}

class BulkDownloadService {
  private activeJobs: Map<string, BulkDownloadProgress> = new Map();
  private readonly DELAY_BETWEEN_COUNTRIES = 2000; // 2 seconds delay
  private readonly MAX_RETRIES = 3;
  private lastRunDate: Date | null = null; // Track last run to prevent duplicates
  private initialized = false;

  /**
   * Initialize service and recover orphaned jobs
   * Should be called once on server startup
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('[BulkDownload] Initializing service and checking for orphaned jobs...');

    try {
      // Get all running jobs from database
      const allJobs = await storage.getAllBulkJobs();
      const runningJobs = allJobs.filter(job => job.status === 'running');

      if (runningJobs.length > 0) {
        console.log(`[BulkDownload] Found ${runningJobs.length} running job(s) - attempting to resume`);

        for (const job of runningJobs) {
          console.log(`[BulkDownload] Resuming job ${job.id} (${job.processedCountries}/${job.totalCountries} countries processed)`);
          
          // Resume the job instead of marking it as failed
          this.resumeJob(job.id).catch(error => {
            console.error(`[BulkDownload] Failed to resume job ${job.id}:`, error);
          });
        }
      } else {
        console.log('[BulkDownload] No running jobs found');
      }
    } catch (error) {
      console.error('[BulkDownload] Failed to check for orphaned jobs:', error);
    }

    this.initialized = true;
  }

  /**
   * Resume a previously interrupted job
   */
  private async resumeJob(jobId: string): Promise<void> {
    try {
      // Get job details from database
      const job = await storage.getBulkJob(jobId);
      if (!job || job.status !== 'running') {
        console.log(`[BulkDownload] Job ${jobId} cannot be resumed (status: ${job?.status})`);
        return;
      }

      // Get list of already processed countries
      const processedProgress = await storage.getJobCountryProgress(jobId);
      const processedCountryNames = new Set(
        processedProgress
          .filter(p => p.status === 'completed' || p.status === 'failed')
          .map(p => p.countryName)
      );

      console.log(`[BulkDownload] Job ${jobId} has ${processedCountryNames.size} countries already processed`);

      // Get remaining countries to process
      const allCountries = this.getValidCountries();
      const remainingCountries = allCountries.filter(c => !processedCountryNames.has(c));

      if (remainingCountries.length === 0) {
        console.log(`[BulkDownload] Job ${jobId} is already complete, marking as completed`);
        await storage.updateBulkJob(jobId, {
          status: 'completed',
          completedAt: new Date(),
          lastRunDate: new Date(),
        });
        return;
      }

      console.log(`[BulkDownload] Resuming job ${jobId} with ${remainingCountries.length} remaining countries`);

      // Create in-memory progress for UI/API
      const progress: BulkDownloadProgress = {
        jobId,
        status: 'running',
        totalCountries: job.totalCountries,
        processedCountries: job.processedCountries,
        failedCountries: job.failedCountries,
        currentCountry: null,
        startedAt: job.startedAt,
        completedAt: null,
        errors: job.errorLog || [],
      };

      this.activeJobs.set(jobId, progress);

      // Process remaining countries
      await this.processCountries(jobId, remainingCountries);
    } catch (error) {
      console.error(`[BulkDownload] Error resuming job ${jobId}:`, error);
      
      // Mark job as failed
      await storage.updateBulkJob(jobId, {
        status: 'failed',
        completedAt: new Date(),
        errorLog: [
          { 
            country: 'system', 
            error: `Failed to resume job: ${error instanceof Error ? error.message : String(error)}` 
          }
        ]
      });
    }
  }

  /**
   * Get all valid countries that can be processed
   * Uses dataFetcher's country validation to ensure consistency
   */
  private getValidCountries(): string[] {
    return dataFetcher.getAllValidCountries();
  }

  /**
   * Generate a unique job ID
   */
  private generateJobId(): string {
    return `bulk-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Delay execution for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if any job is currently running
   */
  private isJobRunning(): boolean {
    for (const progress of Array.from(this.activeJobs.values())) {
      if (progress.status === 'running') {
        return true;
      }
    }
    return false;
  }

  /**
   * Download US State Department advisories for all countries
   */
  async downloadAllStateDeptAdvisories(): Promise<string> {
    // Prevent concurrent jobs
    if (this.isJobRunning()) {
      throw new Error('A bulk download job is already running. Please wait for it to complete.');
    }

    // Prevent duplicate runs on the same day (check database instead of memory)
    const today = new Date().toISOString().split('T')[0];
    const lastRunDate = await storage.getLastRunDate();
    if (lastRunDate) {
      const lastRunDay = lastRunDate.toISOString().split('T')[0];
      if (lastRunDay === today) {
        throw new Error('A bulk download has already been initiated today. Please try again tomorrow.');
      }
    }

    const jobId = this.generateJobId();
    const countries = this.getValidCountries();

    // Initialize job progress
    const progress: BulkDownloadProgress = {
      jobId,
      status: 'running',
      totalCountries: countries.length,
      processedCountries: 0,
      failedCountries: 0,
      currentCountry: null,
      startedAt: new Date(),
      completedAt: null,
      errors: []
    };

    this.activeJobs.set(jobId, progress);

    console.log(`[BulkDownload] Starting bulk download job ${jobId} for ${countries.length} countries`);

    // Check if AI enhancement is available
    if (!isAIEnhancementAvailable()) {
      console.warn('[BulkDownload] AI enhancement not available - OpenAI API key missing');
    }

    // Save job to database
    try {
      await storage.createBulkJob({
        id: jobId,
        startedAt: progress.startedAt,
        status: 'running',
        totalCountries: progress.totalCountries,
        processedCountries: 0,
        failedCountries: 0,
        errorLog: []
      });
    } catch (error) {
      console.error('[BulkDownload] Failed to save job to database:', error);
    }

    // Process countries asynchronously with comprehensive error handling
    this.processCountries(jobId, countries).catch(async (error) => {
      console.error(`[BulkDownload] Job ${jobId} failed with unhandled error:`, error);
      progress.status = 'failed';
      progress.completedAt = new Date();
      
      // Update database with failure status
      try {
        await storage.updateBulkJob(jobId, {
          status: 'failed',
          completedAt: progress.completedAt,
          errorLog: [
            ...(progress.errors || []),
            { country: 'system', error: error instanceof Error ? error.message : String(error) }
          ]
        });
      } catch (dbError) {
        console.error('[BulkDownload] Failed to update job failure in database:', dbError);
      }
    });

    // DO NOT set lastRunDate here - only set on successful completion

    return jobId;
  }

  /**
   * Process all countries sequentially with delays
   */
  private async processCountries(jobId: string, countries: string[]): Promise<void> {
    const progress = this.activeJobs.get(jobId);
    if (!progress) {
      throw new Error(`Job ${jobId} not found`);
    }

    try {
      for (const country of countries) {
        // Check for cancellation (status already updated by cancelJob)
        if (progress.status === 'cancelled') {
          console.log(`[BulkDownload] Job ${jobId} cancelled, exiting processing loop`);
          // Cancellation was already persisted by cancelJob, just exit
          return;
        }

        progress.currentCountry = country;
        console.log(`[BulkDownload] Processing ${country} (${progress.processedCountries + 1}/${progress.totalCountries})`);

        try {
          // Download and enhance advisory for this country
          await this.downloadCountryAdvisory(country);
          
          // Use transactional update for atomicity
          await storage.updateJobWithTransaction(jobId, country, 'completed');
          
          // Update in-memory progress for UI/API
          progress.processedCountries++;
        } catch (error) {
          console.error(`[BulkDownload] Failed to process ${country}:`, error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          // Use transactional update for atomicity
          try {
            await storage.updateJobWithTransaction(jobId, country, 'failed', errorMessage);
          } catch (txError) {
            console.error('[BulkDownload] Failed to update job transaction:', txError);
          }
          
          // Update in-memory progress for UI/API
          progress.failedCountries++;
          progress.errors.push({
            country,
            error: errorMessage
          });
        }

        // Delay before next country to avoid rate limiting
        if (progress.processedCountries < countries.length) {
          await this.delay(this.DELAY_BETWEEN_COUNTRIES);
        }
      }

      // Mark job as completed only if we finished all countries
      progress.status = 'completed';
      progress.completedAt = new Date();
      progress.currentCountry = null;

      console.log(`[BulkDownload] Job ${jobId} completed successfully - Processed: ${progress.processedCountries}, Failed: ${progress.failedCountries}`);

      // Update final job status in database with lastRunDate for deduplication
      await storage.updateBulkJob(jobId, {
        status: 'completed',
        completedAt: progress.completedAt,
        processedCountries: progress.processedCountries,
        failedCountries: progress.failedCountries,
        errorLog: progress.errors,
        lastRunDate: new Date(), // Store in database instead of memory
      });
    } catch (error) {
      // Handle any unexpected errors during processing
      console.error(`[BulkDownload] Job ${jobId} encountered error:`, error);
      progress.status = 'failed';
      progress.completedAt = new Date();
      progress.currentCountry = null;
      
      // Add system error to error log
      progress.errors.push({
        country: 'system',
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Update database with failed status
      await storage.updateBulkJob(jobId, {
        status: 'failed',
        completedAt: progress.completedAt,
        processedCountries: progress.processedCountries,
        failedCountries: progress.failedCountries,
        errorLog: progress.errors
      });
      
      throw error; // Re-throw to be caught by outer handler
    }
  }

  /**
   * Download advisory for a single country
   */
  private async downloadCountryAdvisory(countryName: string): Promise<void> {
    // Use dataFetcher to get US State Department advisory with AI enhancement
    await dataFetcher.fetchAllCountryData(countryName);
  }

  /**
   * Get progress for a specific job
   */
  getJobProgress(jobId: string): BulkDownloadProgress | undefined {
    return this.activeJobs.get(jobId);
  }

  /**
   * Cancel a running job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const progress = this.activeJobs.get(jobId);
    if (!progress || progress.status !== 'running') {
      return false;
    }

    progress.status = 'cancelled';
    progress.completedAt = new Date();

    // Immediately update database with cancellation (await to ensure it's persisted)
    try {
      await storage.updateBulkJob(jobId, {
        status: 'cancelled',
        completedAt: progress.completedAt,
        processedCountries: progress.processedCountries,
        failedCountries: progress.failedCountries,
        errorLog: progress.errors
      });
    } catch (error) {
      console.error('[BulkDownload] Failed to update cancelled job:', error);
      // Still return true because we've marked it as cancelled in memory
    }

    return true;
  }

  /**
   * Clean up old completed jobs from memory
   */
  cleanupOldJobs(maxAgeHours: number = 24): void {
    const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
    
    for (const [jobId, progress] of Array.from(this.activeJobs.entries())) {
      if (progress.status !== 'running' && progress.startedAt.getTime() < cutoffTime) {
        this.activeJobs.delete(jobId);
      }
    }
  }
}

export const bulkDownloadService = new BulkDownloadService();
