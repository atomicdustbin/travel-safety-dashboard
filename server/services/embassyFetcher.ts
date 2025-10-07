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
    'addr:street'?: string;
    'addr:city'?: string;
    'addr:country'?: string;
    'contact:phone'?: string;
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
    const query = `
      [out:json][timeout:120];
      (
        node["amenity"="embassy"]["country"="US"];
        way["amenity"="embassy"]["country"="US"];
        relation["amenity"="embassy"]["country"="US"];
      );
      out center;
    `;

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

      // Get coordinates (direct from node, or center from way/relation)
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;

      if (!lat || !lon) {
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

      const embassy: InsertEmbassyConsulate = {
        id: `osm-${element.type}-${element.id}`,
        countryCode: countryCode,
        name: tags.name || 'U.S. Embassy',
        type: type,
        latitude: lat.toString(),
        longitude: lon.toString(),
        streetAddress: tags['addr:street'] || null,
        city: tags['addr:city'] || null,
        phone: tags['contact:phone'] || tags.phone || null,
        website: tags.website || null,
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

    const addrCountry = tags['addr:country'];
    if (addrCountry) {
      return addrCountry.toUpperCase();
    }

    // If city is available, try to map it to a country code
    const city = tags['addr:city'];
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
      'paris': 'FR',
      'london': 'GB',
      'berlin': 'DE',
      'tokyo': 'JP',
      'beijing': 'CN',
      'moscow': 'RU',
      'rome': 'IT',
      'madrid': 'ES',
      'ottawa': 'CA',
      'mexico city': 'MX',
      'brasilia': 'BR',
      'new delhi': 'IN',
      'canberra': 'AU',
      'seoul': 'KR',
      'ankara': 'TR',
      'cairo': 'EG',
      'nairobi': 'KE',
      'tel aviv': 'IL',
      'riyadh': 'SA',
      'abu dhabi': 'AE',
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
