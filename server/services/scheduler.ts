import { dataFetcher } from "./dataFetcher";
import { bulkDownloadService } from "./bulkDownloadService";
import { embassyDataFetcher } from "./embassyFetcher";
import { storage } from "../storage";

class DataScheduler {
  private alertRefreshInterval: NodeJS.Timeout | null = null;
  private backgroundRefreshInterval: NodeJS.Timeout | null = null;
  private weeklyBulkDownloadInterval: NodeJS.Timeout | null = null;
  private monthlyEmbassyRefreshInterval: NodeJS.Timeout | null = null;
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

    // Monthly embassy refresh - check every hour if it's 1st of month at 2 AM
    this.monthlyEmbassyRefreshInterval = setInterval(() => {
      this.checkAndRunMonthlyEmbassyRefresh();
    }, 60 * 60 * 1000); // Check every hour

    console.log("Data scheduler started - alerts: 6h, background: 7d, bulk download: weekly, embassy: monthly");
    
    // Run initial checks in case we just started at the scheduled time
    this.checkAndRunWeeklyBulkDownload();
    this.checkAndRunMonthlyEmbassyRefresh();
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
    if (this.monthlyEmbassyRefreshInterval) {
      clearInterval(this.monthlyEmbassyRefreshInterval);
      this.monthlyEmbassyRefreshInterval = null;
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
        const country = await storage.getCountryByName(countryName);
        if (!country) {
          console.warn(`Country ${countryName} not found in storage, skipping background refresh`);
          continue;
        }

        const ciaData = await dataFetcher.fetchCIAFactbook(countryName);
        const worldBankData = await dataFetcher.fetchWorldBankData(countryName);
        
        if (ciaData) {
          const backgroundInfo = { ...ciaData, countryId: country.id };
          if (worldBankData?.gdpPerCapita) {
            backgroundInfo.gdpPerCapita = worldBankData.gdpPerCapita;
          }
          
          // Persist the background data to storage
          await storage.createOrUpdateBackgroundInfo(backgroundInfo);
          console.log(`Successfully refreshed background data for ${countryName}`);
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

  private lastEmbassyRefreshDate: string | null = null; // Track last run date to prevent duplicates

  /**
   * Check if it's the 1st of the month at 2 AM and run embassy refresh if it is
   */
  private checkAndRunMonthlyEmbassyRefresh(): void {
    const now = new Date();
    const day = now.getDate(); // 1-31
    const hour = now.getHours();
    const dateKey = now.toISOString().split('T')[0]; // YYYY-MM-DD format

    // Run if it's the 1st of the month (day 1) and hour is 2 (2 AM) and we haven't run today
    if (day === 1 && hour === 2 && this.lastEmbassyRefreshDate !== dateKey) {
      console.log("[Scheduler] Running monthly embassy refresh on 1st of month at 2 AM");
      this.lastEmbassyRefreshDate = dateKey; // Mark as run for this date
      
      this.runMonthlyEmbassyRefresh().catch(error => {
        console.error("[Scheduler] Monthly embassy refresh failed:", error);
        // Reset the date key on failure so it can retry later
        this.lastEmbassyRefreshDate = null;
      });
    }
  }

  /**
   * Run the monthly refresh of US embassy/consulate data
   */
  private async runMonthlyEmbassyRefresh(): Promise<void> {
    try {
      console.log("[Scheduler] Fetching all US embassy data from OpenStreetMap...");
      const embassies = await embassyDataFetcher.fetchAllUSEmbassies();
      
      if (embassies.length === 0) {
        console.warn("[Scheduler] No embassy data found");
        return;
      }

      // Clear existing data and save new data
      await storage.deleteAllEmbassies();
      await storage.bulkCreateEmbassies(embassies);
      console.log(`[Scheduler] ✅ Successfully refreshed ${embassies.length} US embassies worldwide`);
    } catch (error) {
      console.error("[Scheduler] Failed to refresh embassy data:", error);
      throw error;
    }
  }
}

export const scheduler = new DataScheduler();

// Start scheduler when module loads
scheduler.startScheduler();
