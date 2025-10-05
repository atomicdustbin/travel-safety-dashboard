import { dataFetcher } from "./dataFetcher";
import { bulkDownloadService } from "./bulkDownloadService";

class DataScheduler {
  private alertRefreshInterval: NodeJS.Timeout | null = null;
  private backgroundRefreshInterval: NodeJS.Timeout | null = null;
  private weeklyBulkDownloadInterval: NodeJS.Timeout | null = null;
  private recentCountries: Set<string> = new Set();

  startScheduler(): void {
    // Refresh alerts every 6 hours
    this.alertRefreshInterval = setInterval(() => {
      this.refreshAlerts();
    }, 6 * 60 * 60 * 1000);

    // Refresh background data weekly
    this.backgroundRefreshInterval = setInterval(() => {
      this.refreshBackgroundData();
    }, 7 * 24 * 60 * 60 * 1000);

    // Weekly bulk download - check every hour if it's Sunday at 1 AM
    this.weeklyBulkDownloadInterval = setInterval(() => {
      this.checkAndRunWeeklyBulkDownload();
    }, 60 * 60 * 1000); // Check every hour

    console.log("Data scheduler started - alerts: 6h, background: 7d, bulk download: weekly");
    
    // Run initial check for weekly bulk download in case we just started on Sunday at 1 AM
    this.checkAndRunWeeklyBulkDownload();
  }

  stopScheduler(): void {
    if (this.alertRefreshInterval) {
      clearInterval(this.alertRefreshInterval);
      this.alertRefreshInterval = null;
    }
    if (this.backgroundRefreshInterval) {
      clearInterval(this.backgroundRefreshInterval);
      this.backgroundRefreshInterval = null;
    }
    if (this.weeklyBulkDownloadInterval) {
      clearInterval(this.weeklyBulkDownloadInterval);
      this.weeklyBulkDownloadInterval = null;
    }
    console.log("Data scheduler stopped");
  }

  addCountryToRefresh(countryName: string): void {
    this.recentCountries.add(countryName);
  }

  private async refreshAlerts(): Promise<void> {
    console.log("Refreshing alert data for recent countries...");
    for (const countryName of Array.from(this.recentCountries)) {
      try {
        await dataFetcher.fetchAllCountryData(countryName);
      } catch (error) {
        console.error(`Failed to refresh alerts for ${countryName}:`, error);
      }
    }
  }

  private async refreshBackgroundData(): Promise<void> {
    console.log("Refreshing background data for recent countries...");
    for (const countryName of Array.from(this.recentCountries)) {
      try {
        // Only refresh background data, not alerts
        const ciaData = await dataFetcher.fetchCIAFactbook(countryName);
        const worldBankData = await dataFetcher.fetchWorldBankData(countryName);
        
        if (ciaData) {
          const backgroundInfo = { ...ciaData };
          if (worldBankData?.gdpPerCapita) {
            backgroundInfo.gdpPerCapita = worldBankData.gdpPerCapita;
          }
          // Implementation would update background info here
        }
      } catch (error) {
        console.error(`Failed to refresh background data for ${countryName}:`, error);
      }
    }
  }

  async forceRefresh(countryName: string): Promise<void> {
    console.log(`Force refreshing data for ${countryName}...`);
    this.addCountryToRefresh(countryName);
    await dataFetcher.fetchAllCountryData(countryName);
  }

  private lastWeeklyRunDate: string | null = null; // Track last run date to prevent duplicates

  /**
   * Check if it's Sunday at 1 AM and run bulk download if it is
   */
  private checkAndRunWeeklyBulkDownload(): void {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const hour = now.getHours();
    const dateKey = now.toISOString().split('T')[0]; // YYYY-MM-DD format

    // Run if it's Sunday (day 0) and hour is 1 (1 AM) and we haven't run today
    if (day === 0 && hour === 1 && this.lastWeeklyRunDate !== dateKey) {
      console.log("[Scheduler] Running weekly bulk download on Sunday at 1 AM");
      this.lastWeeklyRunDate = dateKey; // Mark as run for this date
      
      this.runWeeklyBulkDownload().catch(error => {
        console.error("[Scheduler] Weekly bulk download failed:", error);
        // Reset the date key on failure so it can retry later
        this.lastWeeklyRunDate = null;
      });
    }
  }

  /**
   * Run the weekly bulk download of all US State Dept advisories
   */
  private async runWeeklyBulkDownload(): Promise<void> {
    try {
      const jobId = await bulkDownloadService.downloadAllStateDeptAdvisories();
      console.log(`[Scheduler] Started weekly bulk download job: ${jobId}`);
    } catch (error) {
      console.error("[Scheduler] Failed to start weekly bulk download:", error);
      throw error;
    }
  }
}

export const scheduler = new DataScheduler();

// Start scheduler when module loads
scheduler.startScheduler();
