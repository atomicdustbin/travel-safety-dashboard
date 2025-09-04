import { dataFetcher } from "./dataFetcher";

class DataScheduler {
  private alertRefreshInterval: NodeJS.Timeout | null = null;
  private backgroundRefreshInterval: NodeJS.Timeout | null = null;
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

    console.log("Data scheduler started - alerts: 6h, background: 7d");
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
}

export const scheduler = new DataScheduler();

// Start scheduler when module loads
scheduler.startScheduler();
