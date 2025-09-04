import { storage } from "../storage";
import { type InsertAlert, type InsertBackgroundInfo } from "@shared/schema";

export class DataFetcher {
  private apiKeys = {
    worldBank: process.env.WORLD_BANK_API_KEY || "",
    restCountries: process.env.REST_COUNTRIES_API_KEY || "",
  };

  async fetchStateDeptAdvisories(countryName: string): Promise<InsertAlert[]> {
    try {
      // US State Department Travel Advisories API
      const response = await fetch(`https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.json`);
      const data = await response.json();
      
      const alerts: InsertAlert[] = [];
      const country = await storage.getCountryByName(countryName);
      if (!country) return alerts;

      // Parse State Dept data and find relevant country advisory
      if (data.data) {
        for (const advisory of data.data) {
          if (advisory.country_name?.toLowerCase().includes(countryName.toLowerCase())) {
            alerts.push({
              countryId: country.id,
              source: "US State Dept",
              title: advisory.advisory_text || "Travel Advisory",
              level: `Level ${advisory.advisory_level || "Unknown"}`,
              severity: this.mapStateDeptSeverity(advisory.advisory_level),
              summary: advisory.advisory_text || "Check current travel conditions",
              link: advisory.url || "https://travel.state.gov",
              date: new Date(advisory.date_updated || Date.now()),
            });
          }
        }
      }

      return alerts;
    } catch (error) {
      console.error("Error fetching State Dept advisories:", error);
      return [];
    }
  }

  async fetchFCDOAdvisories(countryName: string): Promise<InsertAlert[]> {
    try {
      // UK FCDO Travel Advice API
      const response = await fetch(`https://www.gov.uk/api/foreign-travel-advice/${countryName.toLowerCase().replace(/\s+/g, '-')}.json`);
      
      if (!response.ok) return [];
      
      const data = await response.json();
      const alerts: InsertAlert[] = [];
      const country = await storage.getCountryByName(countryName);
      if (!country) return alerts;

      if (data.details) {
        alerts.push({
          countryId: country.id,
          source: "UK FCDO",
          title: data.details.country?.name || "Travel Advice",
          level: data.details.alert_status?.[0]?.alert_type || "Standard",
          severity: this.mapFCDOSeverity(data.details.alert_status?.[0]?.alert_type),
          summary: data.details.summary || "Check current travel advice",
          link: `https://www.gov.uk/foreign-travel-advice/${countryName.toLowerCase().replace(/\s+/g, '-')}`,
          date: new Date(data.updated_at || Date.now()),
        });
      }

      return alerts;
    } catch (error) {
      console.error("Error fetching FCDO advisories:", error);
      return [];
    }
  }

  async fetchCDCHealthNotices(countryName: string): Promise<InsertAlert[]> {
    try {
      // CDC Travel Health Notices RSS/API
      const response = await fetch(`https://wwwnc.cdc.gov/travel/notices`);
      const alerts: InsertAlert[] = [];
      const country = await storage.getCountryByName(countryName);
      if (!country) return alerts;

      // This would parse CDC RSS feed or API response
      // For now, create a health notice template
      alerts.push({
        countryId: country.id,
        source: "CDC",
        title: "Health Notice Update",
        level: "Standard",
        severity: "info",
        summary: "Check CDC travel health recommendations for vaccination and health guidance",
        link: `https://wwwnc.cdc.gov/travel/destinations/traveler/none/${countryName.toLowerCase().replace(/\s+/g, '-')}`,
        date: new Date(),
      });

      return alerts;
    } catch (error) {
      console.error("Error fetching CDC notices:", error);
      return [];
    }
  }

  async fetchUSGSEarthquakes(countryName: string): Promise<InsertAlert[]> {
    try {
      // USGS Earthquake API
      const response = await fetch(`https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson`);
      const data = await response.json();
      
      const alerts: InsertAlert[] = [];
      const country = await storage.getCountryByName(countryName);
      if (!country) return alerts;

      if (data.features) {
        for (const earthquake of data.features) {
          const place = earthquake.properties.place;
          if (place && place.toLowerCase().includes(countryName.toLowerCase())) {
            const magnitude = earthquake.properties.mag;
            alerts.push({
              countryId: country.id,
              source: "USGS",
              title: `${magnitude} Magnitude Earthquake`,
              level: magnitude >= 6 ? "Major" : magnitude >= 4 ? "Moderate" : "Minor",
              severity: magnitude >= 6 ? "high" : magnitude >= 4 ? "medium" : "low",
              summary: `Earthquake occurred ${place}`,
              link: earthquake.properties.url || "https://earthquake.usgs.gov",
              date: new Date(earthquake.properties.time),
            });
          }
        }
      }

      return alerts;
    } catch (error) {
      console.error("Error fetching USGS earthquakes:", error);
      return [];
    }
  }

  async fetchReliefWebCrisis(countryName: string): Promise<InsertAlert[]> {
    try {
      // ReliefWeb API
      const response = await fetch(`https://api.reliefweb.int/v1/reports?appname=travel-dashboard&query[value]=${encodeURIComponent(countryName)}&limit=5`);
      const data = await response.json();
      
      const alerts: InsertAlert[] = [];
      const country = await storage.getCountryByName(countryName);
      if (!country) return alerts;

      if (data.data) {
        for (const report of data.data) {
          alerts.push({
            countryId: country.id,
            source: "ReliefWeb",
            title: report.fields.title,
            level: "Crisis Update",
            severity: "medium",
            summary: report.fields.body ? report.fields.body.substring(0, 200) + "..." : "Crisis situation update",
            link: report.fields.url || "https://reliefweb.int",
            date: new Date(report.fields.date.created),
          });
        }
      }

      return alerts;
    } catch (error) {
      console.error("Error fetching ReliefWeb data:", error);
      return [];
    }
  }

  async fetchCIAFactbook(countryName: string): Promise<InsertBackgroundInfo | null> {
    try {
      // CIA World Factbook API mirror
      const response = await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(countryName)}`);
      const data = await response.json();
      
      if (!Array.isArray(data) || data.length === 0) return null;
      
      const countryData = data[0];
      const country = await storage.getCountryByName(countryName);
      if (!country) return null;

      return {
        countryId: country.id,
        languages: countryData.languages ? Object.values(countryData.languages) as string[] : null,
        religion: countryData.religion || "Various",
        gdpPerCapita: null, // Will be filled by World Bank data
        population: countryData.population?.toLocaleString() || "Unknown",
        capital: countryData.capital?.[0] || "Unknown",
        currency: countryData.currencies ? Object.keys(countryData.currencies)[0] : "Unknown",
        wikiLink: `https://en.wikivoyage.org/wiki/${countryName.replace(/\s+/g, '_')}`,
      };
    } catch (error) {
      console.error("Error fetching CIA Factbook data:", error);
      return null;
    }
  }

  async fetchWorldBankData(countryName: string): Promise<Partial<InsertBackgroundInfo> | null> {
    try {
      // World Bank API
      const response = await fetch(`https://api.worldbank.org/v2/country/${countryName}/indicator/NY.GDP.PCAP.CD?format=json&date=2022&per_page=1`);
      const data = await response.json();
      
      if (Array.isArray(data) && data[1] && data[1][0]) {
        return {
          gdpPerCapita: Math.round(data[1][0].value || 0),
        };
      }
      
      return null;
    } catch (error) {
      console.error("Error fetching World Bank data:", error);
      return null;
    }
  }

  async fetchAllCountryData(countryName: string): Promise<void> {
    try {
      // Ensure country exists
      let country = await storage.getCountryByName(countryName);
      if (!country) {
        // Create country if it doesn't exist
        const countryId = countryName.toLowerCase().replace(/\s+/g, '-');
        country = await storage.createCountry({
          id: countryId,
          name: countryName,
          code: this.getCountryCode(countryName),
          flagUrl: `https://flagcdn.com/w40/${this.getCountryCode(countryName).toLowerCase()}.png`,
        });
      }

      // Clear existing alerts
      await storage.deleteAlertsByCountryId(country.id);

      // Fetch all alert sources
      const [stateDept, fcdo, cdc, usgs, reliefWeb] = await Promise.all([
        this.fetchStateDeptAdvisories(countryName),
        this.fetchFCDOAdvisories(countryName),
        this.fetchCDCHealthNotices(countryName),
        this.fetchUSGSEarthquakes(countryName),
        this.fetchReliefWebCrisis(countryName),
      ]);

      // Create all alerts
      const allAlerts = [...stateDept, ...fcdo, ...cdc, ...usgs, ...reliefWeb];
      for (const alert of allAlerts) {
        await storage.createAlert(alert);
      }

      // Fetch background information
      const [ciaData, worldBankData] = await Promise.all([
        this.fetchCIAFactbook(countryName),
        this.fetchWorldBankData(countryName),
      ]);

      if (ciaData) {
        const backgroundInfo = { ...ciaData };
        if (worldBankData?.gdpPerCapita) {
          backgroundInfo.gdpPerCapita = worldBankData.gdpPerCapita;
        }
        await storage.createOrUpdateBackgroundInfo(backgroundInfo);
      }

    } catch (error) {
      console.error(`Error fetching data for ${countryName}:`, error);
    }
  }

  private mapStateDeptSeverity(level: number): string {
    if (level >= 4) return "high";
    if (level >= 3) return "medium";
    if (level >= 2) return "medium";
    return "low";
  }

  private mapFCDOSeverity(alertType: string): string {
    if (!alertType) return "info";
    const type = alertType.toLowerCase();
    if (type.includes("advise against") || type.includes("essential")) return "high";
    if (type.includes("see our advice")) return "medium";
    return "low";
  }

  private getCountryCode(countryName: string): string {
    const codes: { [key: string]: string } = {
      "thailand": "TH",
      "japan": "JP",
      "united kingdom": "GB",
      "united states": "US",
      "germany": "DE",
      "france": "FR",
      "italy": "IT",
      "spain": "ES",
      "australia": "AU",
      "canada": "CA",
    };
    return codes[countryName.toLowerCase()] || "XX";
  }
}

export const dataFetcher = new DataFetcher();
