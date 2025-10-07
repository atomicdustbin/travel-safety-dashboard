import type { InsertEmbassyConsulate } from "@shared/schema";

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: {
    name?: string;
    amenity?: string;
    country?: string;
    diplomatic?: string;
    target?: string;
    'addr:street'?: string;
    'addr:city'?: string;
    'addr:country'?: string;
    'addr:housenumber'?: string;
    'contact:street'?: string;
    'contact:city'?: string;
    'contact:housenumber'?: string;
    'contact:phone'?: string;
    'contact:website'?: string;
    phone?: string;
    website?: string;
  };
}

interface OverpassResponse {
  elements: OverpassElement[];
}

export class EmbassyDataFetcher {
  private readonly overpassApiUrl = 'https://overpass-api.de/api/interpreter';
  
  /**
   * Fetch all US embassies and consulates from OpenStreetMap
   */
  async fetchAllUSEmbassies(): Promise<InsertEmbassyConsulate[]> {
    // Query for US diplomatic facilities using multiple tagging schemes
    // - office=diplomatic with country=US (modern tagging)
    // - office=diplomatic with target=* (embassies TO other countries, we filter for US later)
    // - amenity=embassy with country=US (legacy tagging)
    const query = `[out:json][timeout:120];
      (
        node["office"="diplomatic"]["country"="US"];
        way["office"="diplomatic"]["country"="US"];
        node["office"="diplomatic"]["target"];
        way["office"="diplomatic"]["target"];
        node["amenity"="embassy"]["country"="US"];
        way["amenity"="embassy"]["country"="US"];
      );
      out body center;`;

    try {
      console.log('[EmbassyFetcher] Fetching US embassy/consulate data from OpenStreetMap...');
      
      const response = await fetch(this.overpassApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!response.ok) {
        throw new Error(`Overpass API returned ${response.status}: ${response.statusText}`);
      }

      const data: OverpassResponse = await response.json();
      console.log(`[EmbassyFetcher] Retrieved ${data.elements.length} diplomatic facilities from OSM`);

      const embassies = this.processOverpassData(data.elements);
      console.log(`[EmbassyFetcher] Processed ${embassies.length} valid embassies/consulates`);

      return embassies;
    } catch (error) {
      console.error('[EmbassyFetcher] Error fetching embassy data:', error);
      throw error;
    }
  }

  /**
   * Process Overpass API response and convert to embassy objects
   */
  private processOverpassData(elements: OverpassElement[]): InsertEmbassyConsulate[] {
    const embassies: InsertEmbassyConsulate[] = [];

    for (const element of elements) {
      const tags = element.tags;
      if (!tags) continue;

      // Filter to ensure this is a US embassy (not a foreign embassy)
      // Primary check: country=US tag
      // Secondary check: name contains "United States" or "U.S." as safeguard
      if (tags.country && tags.country !== 'US') {
        continue;
      }
      
      // If no country tag, verify it's a US embassy by name
      if (!tags.country && tags.name) {
        const nameContainsUS = /united\s+states|u\.?s\.?/i.test(tags.name);
        if (!nameContainsUS) {
          continue;
        }
      }

      // Get coordinates (direct from node, or center from way/relation)
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;

      if (lat === undefined || lon === undefined) {
        console.warn(`[EmbassyFetcher] Skipping element ${element.id}: missing coordinates`);
        continue;
      }

      // Extract country code from address or use a mapping
      const countryCode = this.extractCountryCode(tags);
      if (!countryCode) {
        console.warn(`[EmbassyFetcher] Skipping element ${element.id}: cannot determine country`);
        continue;
      }

      // Determine type (embassy, consulate, consulate_general)
      const type = this.determineType(tags);

      // Build full street address with house number (check both addr: and contact: tags)
      const streetParts = [];
      const houseNumber = tags['addr:housenumber'] || tags['contact:housenumber'];
      const street = tags['addr:street'] || tags['contact:street'];
      
      if (houseNumber) {
        streetParts.push(houseNumber);
      }
      if (street) {
        streetParts.push(street);
      }
      const fullAddress = streetParts.length > 0 ? streetParts.join(' ') : null;

      const embassy: InsertEmbassyConsulate = {
        id: `osm-${element.type}-${element.id}`,
        countryCode: countryCode,
        name: tags.name || 'U.S. Embassy',
        type: type,
        latitude: lat.toString(),
        longitude: lon.toString(),
        streetAddress: fullAddress,
        city: tags['addr:city'] || tags['contact:city'] || null,
        phone: tags['contact:phone'] || tags.phone || null,
        website: tags['contact:website'] || tags.website || null,
      };

      embassies.push(embassy);
    }

    return embassies;
  }

  /**
   * Extract country code from address tags
   */
  private extractCountryCode(tags: OverpassElement['tags']): string | null {
    if (!tags) return null;

    // Try addr:country first
    const addrCountry = tags['addr:country'];
    if (addrCountry) {
      return addrCountry.toUpperCase();
    }

    // Try target tag (indicates the country the embassy is located in)
    const target = tags['target'];
    if (target) {
      return target.toUpperCase();
    }

    // Try to map city to country code (check both addr:city and contact:city)
    const city = tags['addr:city'] || tags['contact:city'];
    if (city) {
      return this.cityToCountryCode(city);
    }

    return null;
  }

  /**
   * Map city names to country codes (common embassy locations)
   */
  private cityToCountryCode(city: string): string | null {
    const cityMap: Record<string, string> = {
      // Western Europe
      'paris': 'FR',
      'london': 'GB',
      'berlin': 'DE',
      'rome': 'IT',
      'madrid': 'ES',
      'amsterdam': 'NL',
      'brussels': 'BE',
      'vienna': 'AT',
      'stockholm': 'SE',
      'copenhagen': 'DK',
      'oslo': 'NO',
      'helsinki': 'FI',
      'dublin': 'IE',
      'lisbon': 'PT',
      'athens': 'GR',
      'bern': 'CH',
      'luxembourg': 'LU',
      // Eastern Europe
      'moscow': 'RU',
      'kyiv': 'UA',
      'kiev': 'UA',
      'warsaw': 'PL',
      'prague': 'CZ',
      'praha': 'CZ',
      'budapest': 'HU',
      'bucharest': 'RO',
      'sofia': 'BG',
      'zagreb': 'HR',
      'belgrade': 'RS',
      // Asia
      'tokyo': 'JP',
      'beijing': 'CN',
      'seoul': 'KR',
      'new delhi': 'IN',
      'delhi': 'IN',
      'bangkok': 'TH',
      'jakarta': 'ID',
      'manila': 'PH',
      'singapore': 'SG',
      'kuala lumpur': 'MY',
      'hanoi': 'VN',
      'islamabad': 'PK',
      'kabul': 'AF',
      'dhaka': 'BD',
      'colombo': 'LK',
      // Middle East
      'ankara': 'TR',
      'istanbul': 'TR',
      'riyadh': 'SA',
      'abu dhabi': 'AE',
      'dubai': 'AE',
      'doha': 'QA',
      'kuwait city': 'KW',
      'manama': 'BH',
      'muscat': 'OM',
      'sanaa': 'YE',
      'baghdad': 'IQ',
      'damascus': 'SY',
      'beirut': 'LB',
      'amman': 'JO',
      'jerusalem': 'IL',
      'tel aviv': 'IL',
      'cairo': 'EG',
      // Africa
      'nairobi': 'KE',
      'addis ababa': 'ET',
      'accra': 'GH',
      'abuja': 'NG',
      'lagos': 'NG',
      'dakar': 'SN',
      'pretoria': 'ZA',
      'johannesburg': 'ZA',
      'cape town': 'ZA',
      'algiers': 'DZ',
      'tunis': 'TN',
      'rabat': 'MA',
      'casablanca': 'MA',
      // Americas
      'ottawa': 'CA',
      'mexico city': 'MX',
      'brasilia': 'BR',
      'buenos aires': 'AR',
      'santiago': 'CL',
      'bogota': 'CO',
      'lima': 'PE',
      'caracas': 'VE',
      'quito': 'EC',
      'la paz': 'BO',
      'asuncion': 'PY',
      'montevideo': 'UY',
      // Oceania
      'canberra': 'AU',
      'sydney': 'AU',
      'wellington': 'NZ',
    };

    const normalizedCity = city.toLowerCase().trim();
    return cityMap[normalizedCity] || null;
  }

  /**
   * Determine embassy type from tags
   */
  private determineType(tags: OverpassElement['tags']): string {
    if (!tags) return 'embassy';

    const diplomatic = tags.diplomatic?.toLowerCase();
    
    if (diplomatic === 'consulate_general') return 'consulate_general';
    if (diplomatic === 'consulate') return 'consulate';
    if (diplomatic === 'embassy') return 'embassy';

    // Default to embassy if not specified
    const name = tags.name?.toLowerCase() || '';
    if (name.includes('consulate general')) return 'consulate_general';
    if (name.includes('consulate')) return 'consulate';
    
    return 'embassy';
  }
}

export const embassyDataFetcher = new EmbassyDataFetcher();
