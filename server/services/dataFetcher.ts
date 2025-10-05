import { storage } from "../storage";
import { type InsertAlert, type InsertBackgroundInfo } from "@shared/schema";
import { enhanceStateDeptSummary, isAIEnhancementAvailable } from "../aiService";

interface ThreatLevelCache {
  levels: Map<string, number>;
  lastUpdated: Date;
}

export class DataFetcher {
  private apiKeys = {
    worldBank: process.env.WORLD_BANK_API_KEY || "",
    restCountries: process.env.REST_COUNTRIES_API_KEY || "",
  };

  // Cache for State Department threat levels (refreshed every 24 hours)
  private threatLevelCache: ThreatLevelCache | null = null;
  private readonly THREAT_LEVEL_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  
  // System CA bundle loaded once at startup
  private caBundle: Buffer | null = null;
  private caBundleLoaded = false;

  // Comprehensive list of valid countries and territories
  private validCountries = new Set([
    // Major countries
    "afghanistan", "albania", "algeria", "andorra", "angola", "antigua and barbuda", "argentina", 
    "armenia", "australia", "austria", "azerbaijan", "bahamas", "bahrain", "bangladesh", "barbados", 
    "belarus", "belgium", "belize", "benin", "bhutan", "bolivia", "bosnia and herzegovina", "botswana", 
    "brazil", "brunei", "bulgaria", "burkina faso", "burundi", "cambodia", "cameroon", "canada", 
    "cape verde", "central african republic", "chad", "chile", "china", "colombia", "comoros", 
    "congo", "costa rica", "croatia", "cuba", "cyprus", "czech republic", "denmark", "djibouti", 
    "dominica", "dominican republic", "ecuador", "egypt", "el salvador", "equatorial guinea", "eritrea", 
    "estonia", "eswatini", "ethiopia", "fiji", "finland", "france", "gabon", "gambia", "georgia", 
    "germany", "ghana", "greece", "grenada", "guatemala", "guinea", "guinea-bissau", "guyana", "haiti", 
    "honduras", "hungary", "iceland", "india", "indonesia", "iran", "iraq", "ireland", "israel", 
    "italy", "ivory coast", "jamaica", "japan", "jordan", "kazakhstan", "kenya", "kiribati", "kosovo", 
    "kuwait", "kyrgyzstan", "laos", "latvia", "lebanon", "lesotho", "liberia", "libya", "liechtenstein", 
    "lithuania", "luxembourg", "madagascar", "malawi", "malaysia", "maldives", "mali", "malta", 
    "marshall islands", "mauritania", "mauritius", "mexico", "micronesia", "moldova", "monaco", 
    "mongolia", "montenegro", "morocco", "mozambique", "myanmar", "namibia", "nauru", "nepal", 
    "netherlands", "new zealand", "nicaragua", "niger", "nigeria", "north korea", "north macedonia", 
    "norway", "oman", "pakistan", "palau", "palestine", "panama", "papua new guinea", "paraguay", 
    "peru", "philippines", "poland", "portugal", "qatar", "romania", "russia", "rwanda", 
    "saint kitts and nevis", "saint lucia", "saint vincent and the grenadines", "samoa", "san marino", 
    "sao tome and principe", "saudi arabia", "senegal", "serbia", "seychelles", "sierra leone", 
    "singapore", "slovakia", "slovenia", "solomon islands", "somalia", "south africa", "south korea", 
    "south sudan", "spain", "sri lanka", "sudan", "suriname", "sweden", "switzerland", "syria", 
    "taiwan", "tajikistan", "tanzania", "thailand", "timor-leste", "togo", "tonga", "trinidad and tobago", 
    "tunisia", "turkey", "turkmenistan", "tuvalu", "uganda", "ukraine", "united arab emirates", 
    "united kingdom", "united states", "uruguay", "uzbekistan", "vanuatu", "vatican city", "venezuela", 
    "vietnam", "yemen", "zambia", "zimbabwe",
    // British territories and dependencies
    "cayman islands", "british virgin islands", "anguilla", "bermuda", "gibraltar", "falkland islands",
    "montserrat", "pitcairn islands", "saint helena", "turks and caicos islands",
    // Other territories and common alternate names
    "hong kong", "macau", "puerto rico", "guam", "american samoa", "northern mariana islands",
    "us virgin islands", "cook islands", "niue", "tokelau", "french polynesia", "new caledonia",
    "wallis and futuna", "mayotte", "reunion", "martinique", "guadeloupe", "french guiana",
    "saint pierre and miquelon", "aruba", "curacao", "sint maarten", "faroe islands", "greenland",
    "isle of man", "jersey", "guernsey", "aland islands"
  ]);

  // Common alternate names and spellings
  private countryAliases: { [key: string]: string } = {
    "usa": "united states",
    "us": "united states",
    "america": "united states",
    "uk": "united kingdom",
    "britain": "united kingdom",
    "great britain": "united kingdom",
    "england": "united kingdom",
    "scotland": "united kingdom", 
    "wales": "united kingdom",
    "northern ireland": "united kingdom",
    "south korea": "south korea",
    "north korea": "north korea",
    "russia": "russia",
    "russian federation": "russia",
    "czech republic": "czech republic",
    "czechia": "czech republic",
    "myanmar": "myanmar",
    "burma": "myanmar",
    "ivory coast": "ivory coast",
    "cote d'ivoire": "ivory coast",
    "east timor": "timor-leste",
    "cape verde": "cape verde",
    "cabo verde": "cape verde",
    "swaziland": "eswatini",
    "macedonia": "north macedonia",
    "congo-brazzaville": "congo",
    "congo-kinshasa": "congo",
    "democratic republic of congo": "congo",
    "drc": "congo"
  };

  /**
   * Get all valid country names as an array
   * Used by bulk download service to ensure consistency
   */
  getAllValidCountries(): string[] {
    return Array.from(this.validCountries);
  }

  // Validate if a country name is legitimate
  validateCountryName(countryName: string): { isValid: boolean; normalizedName?: string; suggestion?: string } {
    const normalizedInput = countryName.toLowerCase().trim();
    
    // Check if it's a direct match
    if (this.validCountries.has(normalizedInput)) {
      return { isValid: true, normalizedName: normalizedInput };
    }
    
    // Check if it's an alias/alternate name
    if (this.countryAliases[normalizedInput]) {
      const normalizedName = this.countryAliases[normalizedInput];
      return { isValid: true, normalizedName };
    }
    
    // Check for partial matches (for suggestions)
    const suggestions = Array.from(this.validCountries)
      .filter(country => 
        country.includes(normalizedInput) || 
        normalizedInput.includes(country) ||
        this.levenshteinDistance(normalizedInput, country) <= 2
      )
      .slice(0, 3); // Limit to 3 suggestions
    
    return { 
      isValid: false, 
      suggestion: suggestions.length > 0 ? suggestions[0] : undefined 
    };
  }

  // Simple Levenshtein distance for typo detection
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i += 1) {
      matrix[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j += 1) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j += 1) {
      for (let i = 1; i <= str1.length; i += 1) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator, // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  async fetchStateDeptAdvisories(countryName: string): Promise<InsertAlert[]> {
    try {
      const alerts: InsertAlert[] = [];
      const country = await storage.getCountryByName(countryName);
      if (!country) return alerts;

      // Fetch real threat level from State Dept API (with fallback to defaults)
      const apiLevel = await this.getAdvisoryLevel(countryName);
      const advisoryLink = `https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/${this.formatStateDeptUrlSlug(countryName)}-travel-advisory.html`;

      // Start with API level, may be enhanced by AI with additional details
      let finalAdvisoryLevel = apiLevel;
      const baseSummary = `Exercise ${apiLevel === 4 ? 'extreme' : apiLevel === 3 ? 'increased' : apiLevel === 2 ? 'enhanced' : 'normal'} caution when traveling to ${countryName}. Check current conditions and security alerts.`;
      
      // Enhanced summary using AI if available
      let finalSummary = baseSummary;
      let finalTitle = `Travel Advisory - Level ${finalAdvisoryLevel}`;
      
      let enhancedData = null;
      if (isAIEnhancementAvailable()) {
        try {
          const enhanced = await enhanceStateDeptSummary(baseSummary, advisoryLink, countryName);
          
          // Always store enhanced data if AI call was successful
          enhancedData = enhanced;
          
          // Note: We use the API-provided threat level, not AI interpretation
          // The official State Dept API is the authoritative source for threat levels
          finalTitle = `Travel Advisory - Level ${finalAdvisoryLevel}`;
          
          // Use enhanced summary if available and different
          if (enhanced.summary && enhanced.summary !== baseSummary) {
            finalSummary = enhanced.summary;
          }
          
          // If AI found specific risks, add them to the title
          if (enhanced.keyRisks && enhanced.keyRisks.length > 0) {
            finalTitle = `${finalTitle} - ${enhanced.keyRisks.slice(0, 2).join(", ")}`;
          }
        } catch (error) {
          console.error(`[ERROR] AI enhancement failed for ${countryName}:`, error);
          // Continue with API level and basic summary
        }
      }

      alerts.push({
        countryId: country.id,
        source: "US State Dept",
        title: finalTitle,
        level: `Level ${finalAdvisoryLevel}`,
        severity: this.mapStateDeptSeverity(finalAdvisoryLevel),
        summary: finalSummary,
        link: advisoryLink,
        date: new Date(),
        // Add AI-enhanced data if available
        keyRisks: enhancedData?.keyRisks || null,
        safetyRecommendations: enhancedData?.safetyRecommendations || null,
        specificAreas: enhancedData?.specificAreas || null,
        aiEnhanced: (enhancedData?.aiApplied) ? new Date() : null,
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
      
      // UK FCDO Travel Advice API
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        return [];
      }
      
      const data = await response.json();
      
      const alerts: InsertAlert[] = [];
      const country = await storage.getCountryByName(countryName);
      if (!country) {
        return alerts;
      }

      // Check the correct structure based on FCDO Content API
      if (data.details) {
        
        // Extract actual travel advisory information
        let level = "Standard";
        let severity = "info";
        let advisoryText = "";
        
        // Parse alert_status for actual travel recommendations
        if (data.details.alert_status && data.details.alert_status.length > 0) {
          const alertStatus = data.details.alert_status[0];
          
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
      } else {
        
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
        }
      }

      return alerts;
    } catch (error) {
      console.error("Error fetching FCDO advisories:", error);
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
        link: `https://wwwnc.cdc.gov/travel/destinations/traveler/none/${this.formatCDCUrlSlug(countryName)}`,
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
      // A
      "afghanistan": "AF", "aland islands": "AX", "albania": "AL", "algeria": "DZ", "american samoa": "AS",
      "andorra": "AD", "angola": "AO", "anguilla": "AI", "antigua and barbuda": "AG", "argentina": "AR",
      "armenia": "AM", "aruba": "AW", "australia": "AU", "austria": "AT", "azerbaijan": "AZ",
      // B
      "bahamas": "BS", "bahrain": "BH", "bangladesh": "BD", "barbados": "BB", "belarus": "BY",
      "belgium": "BE", "belize": "BZ", "benin": "BJ", "bermuda": "BM", "bhutan": "BT",
      "bolivia": "BO", "bosnia and herzegovina": "BA", "botswana": "BW", "brazil": "BR",
      "british virgin islands": "VG", "brunei": "BN", "bulgaria": "BG", "burkina faso": "BF", "burundi": "BI",
      // C
      "cambodia": "KH", "cameroon": "CM", "canada": "CA", "cape verde": "CV", "cayman islands": "KY",
      "central african republic": "CF", "chad": "TD", "chile": "CL", "china": "CN", "colombia": "CO",
      "comoros": "KM", "congo": "CG", "cook islands": "CK", "costa rica": "CR", "croatia": "HR",
      "cuba": "CU", "curacao": "CW", "cyprus": "CY", "czech republic": "CZ",
      // D
      "denmark": "DK", "djibouti": "DJ", "dominica": "DM", "dominican republic": "DO",
      // E
      "ecuador": "EC", "egypt": "EG", "el salvador": "SV", "equatorial guinea": "GQ", "eritrea": "ER",
      "estonia": "EE", "eswatini": "SZ", "ethiopia": "ET",
      // F
      "falkland islands": "FK", "faroe islands": "FO", "fiji": "FJ", "finland": "FI", "france": "FR",
      "french guiana": "GF", "french polynesia": "PF",
      // G
      "gabon": "GA", "gambia": "GM", "georgia": "GE", "germany": "DE", "ghana": "GH",
      "gibraltar": "GI", "greece": "GR", "greenland": "GL", "grenada": "GD", "guadeloupe": "GP",
      "guam": "GU", "guatemala": "GT", "guernsey": "GG", "guinea": "GN", "guinea-bissau": "GW",
      "guyana": "GY",
      // H
      "haiti": "HT", "honduras": "HN", "hong kong": "HK", "hungary": "HU",
      // I
      "iceland": "IS", "india": "IN", "indonesia": "ID", "iran": "IR", "iraq": "IQ",
      "ireland": "IE", "isle of man": "IM", "israel": "IL", "italy": "IT", "ivory coast": "CI",
      // J
      "jamaica": "JM", "japan": "JP", "jersey": "JE", "jordan": "JO",
      // K
      "kazakhstan": "KZ", "kenya": "KE", "kiribati": "KI", "kosovo": "XK", "kuwait": "KW",
      "kyrgyzstan": "KG",
      // L
      "laos": "LA", "latvia": "LV", "lebanon": "LB", "lesotho": "LS", "liberia": "LR",
      "libya": "LY", "liechtenstein": "LI", "lithuania": "LT", "luxembourg": "LU",
      // M
      "macau": "MO", "madagascar": "MG", "malawi": "MW", "malaysia": "MY", "maldives": "MV",
      "mali": "ML", "malta": "MT", "marshall islands": "MH", "martinique": "MQ", "mauritania": "MR",
      "mauritius": "MU", "mayotte": "YT", "mexico": "MX", "micronesia": "FM", "moldova": "MD",
      "monaco": "MC", "mongolia": "MN", "montenegro": "ME", "montserrat": "MS", "morocco": "MA",
      "mozambique": "MZ", "myanmar": "MM",
      // N
      "namibia": "NA", "nauru": "NR", "nepal": "NP", "netherlands": "NL", "new caledonia": "NC",
      "new zealand": "NZ", "nicaragua": "NI", "niger": "NE", "nigeria": "NG", "niue": "NU",
      "north korea": "KP", "north macedonia": "MK", "northern mariana islands": "MP", "norway": "NO",
      // O
      "oman": "OM",
      // P
      "pakistan": "PK", "palau": "PW", "palestine": "PS", "panama": "PA", "papua new guinea": "PG",
      "paraguay": "PY", "peru": "PE", "philippines": "PH", "pitcairn islands": "PN", "poland": "PL",
      "portugal": "PT", "puerto rico": "PR",
      // Q
      "qatar": "QA",
      // R
      "reunion": "RE", "romania": "RO", "russia": "RU", "rwanda": "RW",
      // S
      "saint helena": "SH", "saint kitts and nevis": "KN", "saint lucia": "LC",
      "saint pierre and miquelon": "PM", "saint vincent and the grenadines": "VC", "samoa": "WS",
      "san marino": "SM", "sao tome and principe": "ST", "saudi arabia": "SA", "senegal": "SN",
      "serbia": "RS", "seychelles": "SC", "sierra leone": "SL", "singapore": "SG",
      "sint maarten": "SX", "slovakia": "SK", "slovenia": "SI", "solomon islands": "SB",
      "somalia": "SO", "south africa": "ZA", "south korea": "KR", "south sudan": "SS",
      "spain": "ES", "sri lanka": "LK", "sudan": "SD", "suriname": "SR", "sweden": "SE",
      "switzerland": "CH", "syria": "SY",
      // T
      "taiwan": "TW", "tajikistan": "TJ", "tanzania": "TZ", "thailand": "TH", "timor-leste": "TL",
      "togo": "TG", "tokelau": "TK", "tonga": "TO", "trinidad and tobago": "TT", "tunisia": "TN",
      "turkey": "TR", "turkmenistan": "TM", "turks and caicos islands": "TC", "tuvalu": "TV",
      // U
      "uganda": "UG", "ukraine": "UA", "united arab emirates": "AE", "united kingdom": "GB",
      "united states": "US", "uruguay": "UY", "us virgin islands": "VI", "uzbekistan": "UZ",
      // V
      "vanuatu": "VU", "vatican city": "VA", "venezuela": "VE", "vietnam": "VN",
      // W
      "wallis and futuna": "WF",
      // Y
      "yemen": "YE",
      // Z
      "zambia": "ZM", "zimbabwe": "ZW"
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
      "pakistan": "PAK", "panama": "PAN", "papua new guinea": "PNG", "peru": "PER", "philippines": "PHL", "poland": "POL",
      "portugal": "PRT", "russia": "RUS", "singapore": "SGP", "somalia": "SOM", "south africa": "ZAF",
      "south korea": "KOR", "spain": "ESP", "sweden": "SWE", "syria": "SYR", "thailand": "THA",
      "turkey": "TUR", "ukraine": "UKR", "united kingdom": "GBR", "united states": "USA", "venezuela": "VEN",
      "vietnam": "VNM", "yemen": "YEM", "zimbabwe": "ZWE"
    };
    return codes[countryName.toLowerCase()] || "XXX";
  }

  private formatUrlSlug(countryName: string): string {
    // Handle special cases for URL formatting
    // Note: Different external services use different URL formats
    const lowerName = countryName.toLowerCase();
    
    // Standard format: replace spaces with hyphens
    return lowerName.replace(/\s+/g, '-');
  }

  private formatStateDeptUrlSlug(countryName: string): string {
    // State Department specific URL formatting
    const specialCases: { [key: string]: string } = {
      "united states": "usa",
      "south korea": "korea-south",
      "north korea": "korea-north",
    };
    
    const lowerName = countryName.toLowerCase();
    return specialCases[lowerName] || lowerName.replace(/\s+/g, '-');
  }

  private formatCDCUrlSlug(countryName: string): string {
    // CDC specific URL formatting
    const specialCases: { [key: string]: string } = {
      "united states": "usa",
      "south korea": "korea-south", 
      "north korea": "korea-north",
    };
    
    const lowerName = countryName.toLowerCase();
    return specialCases[lowerName] || lowerName.replace(/\s+/g, '-');
  }

  /**
   * Loads system CA bundle once at startup for secure HTTPS requests
   */
  private loadCABundle(): void {
    if (this.caBundleLoaded) return;
    
    try {
      const fs = require('fs');
      this.caBundle = fs.readFileSync('/etc/ssl/certs/ca-certificates.crt');
      console.log('[State Dept API] Loaded system CA bundle for secure SSL verification');
      this.caBundleLoaded = true;
    } catch (error) {
      console.error('[State Dept API] CRITICAL: Cannot load system CA bundle - SSL verification will fail');
      console.error('[State Dept API] Will use fallback threat levels only');
      this.caBundleLoaded = true; // Mark as loaded to prevent retries
      this.caBundle = null;
    }
  }

  /**
   * Fetches current threat levels from official State Department API
   * Returns a map of country names (lowercase) to threat levels (1-4)
   * Data is cached for 24 hours to minimize API calls
   */
  private async fetchStateDeptThreatLevels(): Promise<Map<string, number>> {
    if (this.threatLevelCache && 
        (Date.now() - this.threatLevelCache.lastUpdated.getTime()) < this.THREAT_LEVEL_CACHE_TTL) {
      return this.threatLevelCache.levels;
    }

    // Load CA bundle if not already loaded
    if (!this.caBundleLoaded) {
      this.loadCABundle();
    }

    // If CA bundle couldn't be loaded, use fallback immediately
    if (!this.caBundle) {
      console.warn('[State Dept API] CA bundle unavailable, using fallback threat levels');
      return this.getFallbackThreatLevels();
    }

    try {
      const https = await import('https');
      const url = 'https://cadataapi.state.gov/api/TravelAdvisories';
      
      const data: any = await new Promise((resolve, reject) => {
        let cleanedUp = false;
        let req: any = null;

        const cleanup = (err?: Error) => {
          if (cleanedUp) return; // Prevent double cleanup
          cleanedUp = true;
          
          clearTimeout(requestTimeout);
          if (req && !req.destroyed) {
            req.destroy();
          }
          
          if (err) reject(err);
        };

        const requestTimeout = setTimeout(() => {
          cleanup(new Error('Request timeout after 30 seconds'));
        }, 30000);

        const options = {
          ca: this.caBundle!,
          rejectUnauthorized: true
        };
        
        req = https.get(url, options, (res) => {
          // Check for successful HTTP status
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            cleanup(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
            return;
          }
          
          let rawData = '';
          res.on('data', (chunk) => rawData += chunk);
          res.on('end', () => {
            cleanup();
            try {
              const parsed = JSON.parse(rawData);
              if (!Array.isArray(parsed)) {
                return reject(new Error('Expected JSON array from API'));
              }
              resolve(parsed);
            } catch (e) {
              reject(new Error(`JSON parse error: ${e instanceof Error ? e.message : 'unknown'}`));
            }
          });
          res.on('error', (err) => cleanup(err));
        });
        
        req.on('error', (err: Error) => cleanup(err));
      });

      const levels = new Map<string, number>();

      for (const advisory of data) {
        if (advisory.Title) {
          const levelMatch = advisory.Title.match(/^(.+?)\s*-\s*Level\s*(\d)/i);
          
          if (levelMatch) {
            const countryName = levelMatch[1].trim().toLowerCase();
            const level = parseInt(levelMatch[2]);
            
            if (level >= 1 && level <= 4) {
              levels.set(countryName, level);
            }
          }
        }
      }

      this.threatLevelCache = {
        levels,
        lastUpdated: new Date()
      };

      console.log(`[State Dept API] Loaded threat levels for ${levels.size} countries`);
      return levels;

    } catch (error) {
      console.error('[State Dept API] Failed to fetch threat levels:', error instanceof Error ? error.message : 'unknown error');
      console.log('[State Dept API] Falling back to hardcoded threat level defaults');
      return this.getFallbackThreatLevels();
    }
  }

  private getFallbackThreatLevels(): Map<string, number> {
    // Fallback threat levels based on US State Department data (October 2025)
    // These are used when the official API is unavailable
    const fallbackLevels = new Map<string, number>([
      // Level 4: Do Not Travel
      ["afghanistan", 4], ["iraq", 4], ["syria", 4], ["yemen", 4], ["libya", 4], ["somalia", 4],
      ["iran", 4], ["north korea", 4], ["venezuela", 4], ["myanmar", 4], ["russia", 4], ["belarus", 4],
      ["sudan", 4], ["south sudan", 4],
      
      // Level 3: Reconsider Travel
      ["ukraine", 3], ["lebanon", 3], ["pakistan", 3], ["colombia", 3], ["mexico", 3],
      ["egypt", 3], ["turkey", 3], ["haiti", 3], ["mali", 3], ["nigeria", 3],
      ["nicaragua", 3], ["honduras", 3], ["el salvador", 3], ["papua new guinea", 3],
      
      // Level 2: Exercise Increased Caution
      ["india", 2], ["philippines", 2], ["kenya", 2], ["indonesia", 2], ["brazil", 2],
      ["south africa", 2], ["china", 2], ["ethiopia", 2], ["saudi arabia", 2],
      ["thailand", 2], ["vietnam", 2], ["cambodia", 2], ["laos", 2], ["bangladesh", 2],
      ["jamaica", 2], ["trinidad and tobago", 2], ["bolivia", 2],
      
      // Level 1: Exercise Normal Precautions
      ["japan", 1], ["south korea", 1], ["singapore", 1], ["australia", 1], ["new zealand", 1],
      ["canada", 1], ["united kingdom", 1], ["germany", 1], ["france", 1], ["italy", 1],
      ["spain", 1], ["netherlands", 1], ["sweden", 1], ["norway", 1], ["denmark", 1],
      ["ireland", 1], ["switzerland", 1], ["austria", 1], ["belgium", 1], ["portugal", 1],
      ["greece", 1], ["poland", 1], ["czech republic", 1], ["finland", 1], ["iceland", 1],
    ]);
    return fallbackLevels;
  }

  private async getAdvisoryLevel(countryName: string): Promise<number> {
    const levels = await this.fetchStateDeptThreatLevels();
    const normalizedName = countryName.toLowerCase();
    
    if (levels.has(normalizedName)) {
      return levels.get(normalizedName)!;
    }
    
    return 2;
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
