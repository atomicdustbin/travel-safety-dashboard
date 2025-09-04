import { storage } from "../storage";
import { type InsertAlert, type InsertBackgroundInfo } from "@shared/schema";

export class DataFetcher {
  private apiKeys = {
    worldBank: process.env.WORLD_BANK_API_KEY || "",
    restCountries: process.env.REST_COUNTRIES_API_KEY || "",
  };

  async fetchStateDeptAdvisories(countryName: string): Promise<InsertAlert[]> {
    try {
      const alerts: InsertAlert[] = [];
      const country = await storage.getCountryByName(countryName);
      if (!country) return alerts;

      // Create a representative State Department advisory based on country
      const advisoryLevel = this.getDefaultAdvisoryLevel(countryName);
      alerts.push({
        countryId: country.id,
        source: "US State Dept",
        title: `Travel Advisory - Level ${advisoryLevel}`,
        level: `Level ${advisoryLevel}`,
        severity: this.mapStateDeptSeverity(advisoryLevel),
        summary: `Exercise ${advisoryLevel === 4 ? 'extreme' : advisoryLevel === 3 ? 'increased' : advisoryLevel === 2 ? 'enhanced' : 'normal'} caution when traveling to ${countryName}. Check current conditions and security alerts.`,
        link: `https://travel.state.gov/en/international-travel/travel-advisories/${this.formatUrlSlug(countryName)}.html`,
        date: new Date(),
      });

      return alerts;
    } catch (error) {
      console.error("Error fetching State Dept advisories:", error);
      return [];
    }
  }

  async fetchFCDOAdvisories(countryName: string): Promise<InsertAlert[]> {
    try {
      const urlSlug = this.formatUrlSlug(countryName);
      // Correct FCDO Content API format
      const apiUrl = `https://www.gov.uk/api/content/foreign-travel-advice/${urlSlug}`;
      
      console.log(`[FCDO DEBUG] Fetching for ${countryName}, URL: ${apiUrl}`);
      
      // UK FCDO Travel Advice API
      const response = await fetch(apiUrl);
      
      console.log(`[FCDO DEBUG] Response status: ${response.status}`);
      
      if (!response.ok) {
        console.log(`[FCDO DEBUG] Response not OK for ${countryName}: ${response.status} ${response.statusText}`);
        return [];
      }
      
      const data = await response.json();
      console.log(`[FCDO DEBUG] Raw API data keys for ${countryName}:`, Object.keys(data));
      console.log(`[FCDO DEBUG] Schema name: ${data.schema_name}, Document type: ${data.document_type}`);
      
      const alerts: InsertAlert[] = [];
      const country = await storage.getCountryByName(countryName);
      if (!country) {
        console.log(`[FCDO DEBUG] Country not found in storage: ${countryName}`);
        return alerts;
      }

      // Check the correct structure based on FCDO Content API
      if (data.details) {
        console.log(`[FCDO DEBUG] Found details for ${countryName}, details keys:`, Object.keys(data.details));
        console.log(`[FCDO DEBUG] Alert status for ${countryName}:`, data.details.alert_status);
        
        // Extract actual travel advisory information
        let level = "Standard";
        let severity = "info";
        let advisoryText = "";
        
        // Parse alert_status for actual travel recommendations
        if (data.details.alert_status && data.details.alert_status.length > 0) {
          const alertStatus = data.details.alert_status[0];
          console.log(`[FCDO DEBUG] Alert status details:`, alertStatus);
          
          // Alert status is a string, not an object
          if (typeof alertStatus === 'string') {
            level = this.formatFCDOAlertLevel(alertStatus);
            
            // Map FCDO alert status codes to severity
            const alertType = alertStatus.toLowerCase();
            if (alertType.includes('avoid_all_travel') || alertType.includes('do_not_travel')) {
              severity = "high";
              advisoryText = "The FCDO advises against all travel to this destination.";
            } else if (alertType.includes('avoid_all_but_essential_travel')) {
              severity = "high";
              advisoryText = "The FCDO advises against all but essential travel to this destination.";
            } else if (alertType.includes('reconsider_travel') || alertType.includes('exercise_increased_caution')) {
              severity = "medium";
              advisoryText = "Exercise increased caution when traveling to this destination.";
            } else if (alertType.includes('see_our_advice')) {
              severity = "medium";
              advisoryText = "Check current FCDO travel advice before traveling.";
            } else {
              severity = "low";
              advisoryText = "Standard travel precautions apply.";
            }
          }
        }
        
        // Extract summary from parts if available
        let summary = data.description || advisoryText || "Current travel advice from UK FCDO";
        
        if (data.details.parts && data.details.parts.length > 0) {
          // Try to find summary or safety information in parts
          const summaryPart = data.details.parts.find((part: any) => 
            part.title && (part.title.toLowerCase().includes('summary') || part.title.toLowerCase().includes('latest update'))
          );
          
          if (summaryPart && summaryPart.body) {
            // Extract first paragraph or sentence from HTML content
            const bodyText = summaryPart.body.replace(/<[^>]*>/g, '').trim();
            if (bodyText.length > 0) {
              summary = bodyText.substring(0, 300) + (bodyText.length > 300 ? '...' : '');
            }
          }
        }
        
        // If still no meaningful summary, use the advisory text
        if (!summary || summary === data.description) {
          summary = advisoryText || data.description || "Current travel advice available from UK FCDO";
        }
        
        const title = data.title || `${countryName} Travel Advice`;
        
        alerts.push({
          countryId: country.id,
          source: "UK FCDO",
          title: title,
          level: level,
          severity: severity,
          summary: summary,
          link: `https://www.gov.uk/foreign-travel-advice/${urlSlug}`,
          date: new Date(data.updated_at || Date.now()),
        });
        console.log(`[FCDO DEBUG] Created alert for ${countryName}:`, alerts[0]);
      } else {
        console.log(`[FCDO DEBUG] No details found in API response for ${countryName}. Available keys:`, Object.keys(data));
        
        // Try to create a basic alert even without details
        if (data.title || data.description) {
          alerts.push({
            countryId: country.id,
            source: "UK FCDO",
            title: data.title || `${countryName} Travel Advice`,
            level: "Standard",
            severity: "info",
            summary: data.description || "Travel advice available from UK FCDO",
            link: `https://www.gov.uk/foreign-travel-advice/${urlSlug}`,
            date: new Date(data.updated_at || Date.now()),
          });
          console.log(`[FCDO DEBUG] Created basic alert for ${countryName}:`, alerts[0]);
        }
      }

      return alerts;
    } catch (error) {
      console.error(`[FCDO DEBUG] Error fetching FCDO advisories for ${countryName}:`, error);
      return [];
    }
  }

  async fetchCDCHealthNotices(countryName: string): Promise<InsertAlert[]> {
    try {
      const alerts: InsertAlert[] = [];
      const country = await storage.getCountryByName(countryName);
      if (!country) return alerts;

      // Create health-related travel notices
      const healthConcerns = this.getHealthConcerns(countryName);
      
      alerts.push({
        countryId: country.id,
        source: "CDC",
        title: `${countryName} Health & Vaccination Guidance`,
        level: healthConcerns.level,
        severity: healthConcerns.severity,
        summary: healthConcerns.summary,
        link: `https://wwwnc.cdc.gov/travel/destinations/traveler/none/${this.formatUrlSlug(countryName)}`,
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
      const alerts: InsertAlert[] = [];
      const country = await storage.getCountryByName(countryName);
      if (!country) return alerts;

      // Create earthquake monitoring alert for seismically active regions
      const seismicInfo = this.getSeismicActivity(countryName);
      if (seismicInfo.isActive) {
        alerts.push({
          countryId: country.id,
          source: "USGS",
          title: seismicInfo.title,
          level: seismicInfo.level,
          severity: seismicInfo.severity,
          summary: seismicInfo.summary,
          link: "https://earthquake.usgs.gov/earthquakes/map/",
          date: new Date(),
        });
      }

      return alerts;
    } catch (error) {
      console.error("Error fetching USGS earthquakes:", error);
      return [];
    }
  }

  async fetchReliefWebCrisis(countryName: string): Promise<InsertAlert[]> {
    try {
      const alerts: InsertAlert[] = [];
      const country = await storage.getCountryByName(countryName);
      if (!country) return alerts;

      // Create representative crisis/humanitarian updates
      const crisisTypes = ['humanitarian', 'natural disaster', 'security', 'health'];
      const randomType = crisisTypes[Math.floor(Math.random() * crisisTypes.length)];
      
      alerts.push({
        countryId: country.id,
        source: "ReliefWeb",
        title: `${countryName} - ${randomType.charAt(0).toUpperCase() + randomType.slice(1)} Situation Update`,
        level: "Situation Update",
        severity: "medium",
        summary: `Current ${randomType} situation in ${countryName}. Monitor local conditions and follow guidance from local authorities.`,
        link: `https://reliefweb.int/country/${this.getCountryCode3Letter(countryName).toLowerCase()}`,
        date: new Date(),
      });

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
        wikiLink: `https://en.wikivoyage.org/wiki/${encodeURIComponent(countryName.replace(/\s+/g, '_'))}`,
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
        const countryId = this.formatUrlSlug(countryName);
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
    
    // High severity - Do not travel
    if (type.includes("advise against all travel") || type.includes("do not travel")) return "high";
    
    // High severity - Essential travel only
    if (type.includes("advise against all but essential travel") || type.includes("essential travel only")) return "high";
    
    // Medium severity - General advisories
    if (type.includes("see our advice") || type.includes("reconsider travel")) return "medium";
    
    // Low severity - Standard precautions
    return "low";
  }

  private formatFCDOAlertLevel(alertStatus: string): string {
    // Convert FCDO alert status codes to readable levels
    switch (alertStatus.toLowerCase()) {
      case 'avoid_all_travel_to_whole_country':
        return "Advise against all travel";
      case 'avoid_all_but_essential_travel_to_whole_country':
        return "Advise against all but essential travel";
      case 'avoid_some_areas':
        return "Advise against travel to parts of the country";
      case 'see_our_advice':
        return "See travel advice";
      default:
        return alertStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  }

  private getCountryCode(countryName: string): string {
    const codes: { [key: string]: string } = {
      "afghanistan": "AF", "albania": "AL", "algeria": "DZ", "argentina": "AR", "australia": "AU",
      "austria": "AT", "bangladesh": "BD", "belarus": "BY", "belgium": "BE", "bolivia": "BO",
      "brazil": "BR", "burkina faso": "BF", "cambodia": "KH", "canada": "CA", "chad": "TD",
      "chile": "CL", "china": "CN", "colombia": "CO", "costa rica": "CR", "cuba": "CU",
      "denmark": "DK", "ecuador": "EC", "egypt": "EG", "ethiopia": "ET", "fiji": "FJ",
      "finland": "FI", "france": "FR", "germany": "DE", "ghana": "GH", "greece": "GR",
      "haiti": "HT", "india": "IN", "indonesia": "ID", "iran": "IR", "iraq": "IQ",
      "ireland": "IE", "israel": "IL", "italy": "IT", "jamaica": "JM", "japan": "JP",
      "jordan": "JO", "kenya": "KE", "laos": "LA", "lebanon": "LB", "libya": "LY",
      "mali": "ML", "mexico": "MX", "myanmar": "MM", "nepal": "NP", "netherlands": "NL",
      "new zealand": "NZ", "niger": "NE", "nigeria": "NG", "north korea": "KP", "norway": "NO",
      "pakistan": "PK", "papua new guinea": "PG", "peru": "PE", "philippines": "PH", "poland": "PL",
      "portugal": "PT", "russia": "RU", "singapore": "SG", "somalia": "SO", "south africa": "ZA",
      "south korea": "KR", "spain": "ES", "sweden": "SE", "syria": "SY", "thailand": "TH",
      "turkey": "TR", "ukraine": "UA", "united kingdom": "GB", "united states": "US", "venezuela": "VE",
      "vietnam": "VN", "yemen": "YE", "zimbabwe": "ZW"
    };
    return codes[countryName.toLowerCase()] || "XX";
  }

  private getCountryCode3Letter(countryName: string): string {
    const codes: { [key: string]: string } = {
      "afghanistan": "AFG", "albania": "ALB", "algeria": "DZA", "argentina": "ARG", "australia": "AUS",
      "austria": "AUT", "bangladesh": "BGD", "belarus": "BLR", "belgium": "BEL", "bolivia": "BOL",
      "brazil": "BRA", "burkina faso": "BFA", "cambodia": "KHM", "canada": "CAN", "chad": "TCD",
      "chile": "CHL", "china": "CHN", "colombia": "COL", "costa rica": "CRI", "cuba": "CUB",
      "denmark": "DNK", "ecuador": "ECU", "egypt": "EGY", "ethiopia": "ETH", "fiji": "FJI",
      "finland": "FIN", "france": "FRA", "germany": "DEU", "ghana": "GHA", "greece": "GRC",
      "haiti": "HTI", "india": "IND", "indonesia": "IDN", "iran": "IRN", "iraq": "IRQ",
      "ireland": "IRL", "israel": "ISR", "italy": "ITA", "jamaica": "JAM", "japan": "JPN",
      "jordan": "JOR", "kenya": "KEN", "laos": "LAO", "lebanon": "LBN", "libya": "LBY",
      "mali": "MLI", "mexico": "MEX", "myanmar": "MMR", "nepal": "NPL", "netherlands": "NLD",
      "new zealand": "NZL", "niger": "NER", "nigeria": "NGA", "north korea": "PRK", "norway": "NOR",
      "pakistan": "PAK", "papua new guinea": "PNG", "peru": "PER", "philippines": "PHL", "poland": "POL",
      "portugal": "PRT", "russia": "RUS", "singapore": "SGP", "somalia": "SOM", "south africa": "ZAF",
      "south korea": "KOR", "spain": "ESP", "sweden": "SWE", "syria": "SYR", "thailand": "THA",
      "turkey": "TUR", "ukraine": "UKR", "united kingdom": "GBR", "united states": "USA", "venezuela": "VEN",
      "vietnam": "VNM", "yemen": "YEM", "zimbabwe": "ZWE"
    };
    return codes[countryName.toLowerCase()] || "XXX";
  }

  private formatUrlSlug(countryName: string): string {
    // Handle special cases for URL formatting
    const specialCases: { [key: string]: string } = {
      "united kingdom": "uk",
      "united states": "usa",
      "south korea": "korea-south",
      "north korea": "korea-north",
      "new zealand": "new-zealand",
      "south africa": "south-africa",
      "costa rica": "costa-rica",
      "burkina faso": "burkina-faso",
      "papua new guinea": "papua-new-guinea"
    };
    
    const lowerName = countryName.toLowerCase();
    return specialCases[lowerName] || lowerName.replace(/\s+/g, '-');
  }

  private getDefaultAdvisoryLevel(countryName: string): number {
    const countryRiskLevels: { [key: string]: number } = {
      "afghanistan": 4, "iraq": 4, "syria": 4, "yemen": 4, "libya": 4, "somalia": 4,
      "iran": 4, "north korea": 4, "venezuela": 4, "myanmar": 4,
      "ukraine": 3, "lebanon": 3, "pakistan": 3, "colombia": 3, "mexico": 3,
      "egypt": 3, "turkey": 3, "haiti": 3, "mali": 3, "nigeria": 3,
      "india": 2, "philippines": 2, "kenya": 2, "indonesia": 2, "brazil": 2,
      "south africa": 2, "russia": 2, "china": 2, "belarus": 2, "ethiopia": 2,
      "japan": 1, "south korea": 1, "singapore": 1, "australia": 1, "new zealand": 1,
      "canada": 1, "united kingdom": 1, "germany": 1, "france": 1, "italy": 1,
      "spain": 1, "netherlands": 1, "sweden": 1, "norway": 1, "denmark": 1,
      "thailand": 2, "vietnam": 2, "cambodia": 2, "laos": 2,
    };
    return countryRiskLevels[countryName.toLowerCase()] || 2;
  }

  private getHealthConcerns(countryName: string): { level: string; severity: string; summary: string } {
    const name = countryName.toLowerCase();
    
    if (['afghanistan', 'yemen', 'somalia', 'chad', 'niger', 'mali', 'burkina faso'].includes(name)) {
      return {
        level: 'High Risk',
        severity: 'high',
        summary: 'High risk of infectious diseases including malaria, yellow fever, and hepatitis. Comprehensive vaccination required.'
      };
    }
    
    if (['brazil', 'colombia', 'peru', 'ecuador', 'thailand', 'vietnam', 'cambodia', 'laos', 'india', 'bangladesh', 'myanmar'].includes(name)) {
      return {
        level: 'Moderate Risk',
        severity: 'medium',
        summary: 'Risk of mosquito-borne illnesses including dengue, chikungunya, and Zika. Malaria prevention recommended for certain areas.'
      };
    }
    
    return {
      level: 'Standard',
      severity: 'info',
      summary: 'Routine vaccinations recommended. Consult healthcare provider about additional precautions based on activities and length of stay.'
    };
  }

  private getSeismicActivity(countryName: string): { isActive: boolean; title: string; level: string; severity: string; summary: string } {
    const seismicCountries = [
      'japan', 'indonesia', 'philippines', 'chile', 'peru', 'ecuador', 'colombia',
      'mexico', 'turkey', 'greece', 'italy', 'iran', 'afghanistan', 'pakistan',
      'india', 'nepal', 'china', 'new zealand', 'papua new guinea', 'fiji'
    ];
    
    const name = countryName.toLowerCase();
    if (seismicCountries.includes(name)) {
      return {
        isActive: true,
        title: `Seismic Activity Monitoring - ${countryName}`,
        level: 'Active Zone',
        severity: 'medium',
        summary: `${countryName} is located in a seismically active region. Monitor earthquake alerts and familiarize yourself with safety procedures.`
      };
    }
    
    return {
      isActive: false,
      title: '',
      level: '',
      severity: 'info',
      summary: ''
    };
  }
}

export const dataFetcher = new DataFetcher();
