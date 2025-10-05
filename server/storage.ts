import { type Country, type Alert, type BackgroundInfo, type BulkJob, type InsertCountry, type InsertAlert, type InsertBackgroundInfo, type InsertBulkJob, type CountryData, countries, alerts, backgroundInfo, bulkJobs } from "@shared/schema";
import { randomUUID } from "crypto";
import { waitForDb, getDatabaseStatus } from "./db";
import { eq, inArray } from "drizzle-orm";

export interface IStorage {
  // Countries
  getCountry(id: string): Promise<Country | undefined>;
  getCountryByName(name: string): Promise<Country | undefined>;
  createCountry(country: InsertCountry): Promise<Country>;
  updateCountry(id: string, country: Partial<Country>): Promise<Country | undefined>;

  // Alerts
  getAlertsByCountryId(countryId: string): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  deleteAlertsByCountryId(countryId: string): Promise<void>;

  // Background Info
  getBackgroundInfoByCountryId(countryId: string): Promise<BackgroundInfo | undefined>;
  createOrUpdateBackgroundInfo(info: InsertBackgroundInfo): Promise<BackgroundInfo>;

  // Combined operations
  getCountryData(countryName: string): Promise<CountryData | undefined>;
  searchCountries(countryNames: string[]): Promise<CountryData[]>;
  getAllCountriesWithData(): Promise<CountryData[]>;

  // Bulk Jobs
  getBulkJob(id: string): Promise<BulkJob | undefined>;
  createBulkJob(job: InsertBulkJob): Promise<BulkJob>;
  updateBulkJob(id: string, updates: Partial<BulkJob>): Promise<BulkJob | undefined>;
  getAllBulkJobs(limit?: number): Promise<BulkJob[]>;
}

export class MemStorage implements IStorage {
  private countries: Map<string, Country>;
  private alerts: Map<string, Alert>;
  private backgroundInfo: Map<string, BackgroundInfo>;
  private bulkJobs: Map<string, BulkJob>;

  constructor() {
    this.countries = new Map();
    this.alerts = new Map();
    this.backgroundInfo = new Map();
    this.bulkJobs = new Map();
  }

  // Helper to normalize arrays for type safety
  private toStringArray(v: unknown): string[] | null {
    return Array.isArray(v) ? (v as unknown[]).map(String) : null;
  }

  async getCountry(id: string): Promise<Country | undefined> {
    return this.countries.get(id);
  }

  async getCountryByName(name: string): Promise<Country | undefined> {
    return Array.from(this.countries.values()).find(
      (country) => country.name.toLowerCase() === name.toLowerCase()
    );
  }

  async createCountry(insertCountry: InsertCountry): Promise<Country> {
    const country: Country = {
      ...insertCountry,
      flagUrl: insertCountry.flagUrl || null,
      lastUpdated: new Date(),
    };
    this.countries.set(country.id, country);
    return country;
  }

  async updateCountry(id: string, updates: Partial<Country>): Promise<Country | undefined> {
    const country = this.countries.get(id);
    if (!country) return undefined;

    const updated = { ...country, ...updates, lastUpdated: new Date() };
    this.countries.set(id, updated);
    return updated;
  }

  async getAlertsByCountryId(countryId: string): Promise<Alert[]> {
    return Array.from(this.alerts.values()).filter(
      (alert) => alert.countryId === countryId
    );
  }

  async createAlert(insertAlert: InsertAlert): Promise<Alert> {
    const alert: Alert = {
      ...insertAlert,
      id: randomUUID(),
      level: insertAlert.level || null,
      createdAt: new Date(),
      // Handle AI enhancement fields with proper typing
      keyRisks: this.toStringArray(insertAlert.keyRisks),
      safetyRecommendations: this.toStringArray(insertAlert.safetyRecommendations),
      specificAreas: this.toStringArray(insertAlert.specificAreas),
      aiEnhanced: insertAlert.aiEnhanced || null,
    };
    this.alerts.set(alert.id, alert);
    return alert;
  }

  async deleteAlertsByCountryId(countryId: string): Promise<void> {
    const alertsToDelete = Array.from(this.alerts.entries()).filter(
      ([_, alert]) => alert.countryId === countryId
    );
    
    for (const [alertId] of alertsToDelete) {
      this.alerts.delete(alertId);
    }
  }

  async getBackgroundInfoByCountryId(countryId: string): Promise<BackgroundInfo | undefined> {
    return Array.from(this.backgroundInfo.values()).find(
      (info) => info.countryId === countryId
    );
  }

  async createOrUpdateBackgroundInfo(insertInfo: InsertBackgroundInfo): Promise<BackgroundInfo> {
    const existingInfo = await this.getBackgroundInfoByCountryId(insertInfo.countryId);
    
    if (existingInfo) {
      const updated: BackgroundInfo = {
        ...existingInfo,
        ...insertInfo,
        languages: this.toStringArray(insertInfo.languages),
        religion: insertInfo.religion ?? null,
        gdpPerCapita: insertInfo.gdpPerCapita ?? null,
        population: insertInfo.population ?? null,
        capital: insertInfo.capital ?? null,
        currency: insertInfo.currency ?? null,
        wikiLink: insertInfo.wikiLink ?? null,
        lastUpdated: new Date(),
      };
      this.backgroundInfo.set(existingInfo.id, updated);
      return updated;
    } else {
      const info: BackgroundInfo = {
        ...insertInfo,
        id: randomUUID(),
        languages: this.toStringArray(insertInfo.languages),
        religion: insertInfo.religion ?? null,
        gdpPerCapita: insertInfo.gdpPerCapita ?? null,
        population: insertInfo.population ?? null,
        capital: insertInfo.capital ?? null,
        currency: insertInfo.currency ?? null,
        wikiLink: insertInfo.wikiLink ?? null,
        lastUpdated: new Date(),
      };
      this.backgroundInfo.set(info.id, info);
      return info;
    }
  }

  async getCountryData(countryName: string): Promise<CountryData | undefined> {
    const country = await this.getCountryByName(countryName);
    if (!country) return undefined;

    const alerts = await this.getAlertsByCountryId(country.id);
    const background = await this.getBackgroundInfoByCountryId(country.id);

    return {
      country,
      alerts,
      background: background || null,
    };
  }

  async searchCountries(countryNames: string[]): Promise<CountryData[]> {
    const results: CountryData[] = [];
    
    for (const name of countryNames) {
      const countryData = await this.getCountryData(name.trim());
      if (countryData) {
        results.push(countryData);
      }
    }
    
    return results;
  }

  async getAllCountriesWithData(): Promise<CountryData[]> {
    const results: CountryData[] = [];
    
    for (const country of Array.from(this.countries.values())) {
      const alerts = await this.getAlertsByCountryId(country.id);
      const background = await this.getBackgroundInfoByCountryId(country.id);
      
      // Only include countries that have alerts (meaning they have cached data)
      if (alerts.length > 0) {
        results.push({
          country,
          alerts,
          background: background || null,
        });
      }
    }
    
    return results;
  }

  async getBulkJob(id: string): Promise<BulkJob | undefined> {
    return this.bulkJobs.get(id);
  }

  async createBulkJob(insertJob: InsertBulkJob): Promise<BulkJob> {
    const job: BulkJob = {
      ...insertJob,
      processedCountries: insertJob.processedCountries || 0,
      failedCountries: insertJob.failedCountries || 0,
      completedAt: insertJob.completedAt || null,
      errorLog: (insertJob.errorLog || null) as { country: string; error: string; }[] | null,
    };
    this.bulkJobs.set(job.id, job);
    return job;
  }

  async updateBulkJob(id: string, updates: Partial<BulkJob>): Promise<BulkJob | undefined> {
    const job = this.bulkJobs.get(id);
    if (!job) return undefined;

    const updated = { ...job, ...updates };
    this.bulkJobs.set(id, updated);
    return updated;
  }

  async getAllBulkJobs(limit?: number): Promise<BulkJob[]> {
    const jobs = Array.from(this.bulkJobs.values());
    // Sort by startedAt descending (most recent first)
    jobs.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    return limit ? jobs.slice(0, limit) : jobs;
  }
}

export class DBStorage implements IStorage {
  private db: NonNullable<Awaited<ReturnType<typeof waitForDb>>>;

  constructor(dbInstance: NonNullable<Awaited<ReturnType<typeof waitForDb>>>) {
    this.db = dbInstance;
  }

  async getCountry(id: string): Promise<Country | undefined> {
    const result = await this.db.select().from(countries).where(eq(countries.id, id)).limit(1);
    return result[0];
  }

  async getCountryByName(name: string): Promise<Country | undefined> {
    const result = await this.db.select().from(countries).where(eq(countries.name, name)).limit(1);
    return result[0];
  }

  async createCountry(insertCountry: InsertCountry): Promise<Country> {
    const country: Country = {
      ...insertCountry,
      flagUrl: insertCountry.flagUrl || null,
      lastUpdated: new Date(),
    };
    await this.db.insert(countries).values(country).onConflictDoUpdate({
      target: countries.id,
      set: { ...country, lastUpdated: new Date() }
    });
    return country;
  }

  async updateCountry(id: string, updates: Partial<Country>): Promise<Country | undefined> {
    const result = await this.db.update(countries)
      .set({ ...updates, lastUpdated: new Date() })
      .where(eq(countries.id, id))
      .returning();
    return result[0];
  }

  async getAlertsByCountryId(countryId: string): Promise<Alert[]> {
    return await this.db.select().from(alerts).where(eq(alerts.countryId, countryId));
  }

  async createAlert(insertAlert: InsertAlert): Promise<Alert> {
    const result = await this.db.insert(alerts).values([insertAlert as any]).returning();
    return result[0];
  }

  async deleteAlertsByCountryId(countryId: string): Promise<void> {
    await this.db.delete(alerts).where(eq(alerts.countryId, countryId));
  }

  async getBackgroundInfoByCountryId(countryId: string): Promise<BackgroundInfo | undefined> {
    const result = await this.db.select().from(backgroundInfo).where(eq(backgroundInfo.countryId, countryId)).limit(1);
    return result[0];
  }

  async createOrUpdateBackgroundInfo(insertInfo: InsertBackgroundInfo): Promise<BackgroundInfo> {
    const result = await this.db.insert(backgroundInfo).values([insertInfo as any]).onConflictDoUpdate({
      target: backgroundInfo.countryId,
      set: insertInfo as any
    }).returning();
    return result[0];
  }

  async getCountryData(countryName: string): Promise<CountryData | undefined> {
    const country = await this.getCountryByName(countryName);
    if (!country) return undefined;

    const [countryAlerts, background] = await Promise.all([
      this.getAlertsByCountryId(country.id),
      this.getBackgroundInfoByCountryId(country.id),
    ]);

    return {
      country,
      alerts: countryAlerts,
      background: background || null,
    };
  }

  async searchCountries(countryNames: string[]): Promise<CountryData[]> {
    const uniqueNames = Array.from(new Set(countryNames));
    const countriesResults = await this.db.select().from(countries).where(
      inArray(countries.name, uniqueNames)
    );

    const results: CountryData[] = [];
    for (const country of countriesResults) {
      const [countryAlerts, background] = await Promise.all([
        this.getAlertsByCountryId(country.id),
        this.getBackgroundInfoByCountryId(country.id),
      ]);

      results.push({
        country,
        alerts: countryAlerts,
        background: background || null,
      });
    }

    return results;
  }

  async getAllCountriesWithData(): Promise<CountryData[]> {
    const allCountries = await this.db.select().from(countries);
    const results: CountryData[] = [];

    for (const country of allCountries) {
      const [countryAlerts, background] = await Promise.all([
        this.getAlertsByCountryId(country.id),
        this.getBackgroundInfoByCountryId(country.id),
      ]);

      results.push({
        country,
        alerts: countryAlerts,
        background: background || null,
      });
    }

    return results;
  }

  async getBulkJob(id: string): Promise<BulkJob | undefined> {
    const result = await this.db.select().from(bulkJobs).where(eq(bulkJobs.id, id)).limit(1);
    return result[0];
  }

  async createBulkJob(insertJob: InsertBulkJob): Promise<BulkJob> {
    const result = await this.db.insert(bulkJobs).values([insertJob as any]).returning();
    return result[0];
  }

  async updateBulkJob(id: string, updates: Partial<BulkJob>): Promise<BulkJob | undefined> {
    const result = await this.db.update(bulkJobs)
      .set(updates)
      .where(eq(bulkJobs.id, id))
      .returning();
    return result[0];
  }

  async getAllBulkJobs(limit?: number): Promise<BulkJob[]> {
    const query = this.db.select().from(bulkJobs).orderBy(bulkJobs.startedAt);
    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }
}

// Initialize storage with database status check
async function initializeStorage(): Promise<IStorage> {
  const db = await waitForDb();
  const dbStatus = getDatabaseStatus();
  
  if (dbStatus.hasConnection && db) {
    console.log('💾 Using PostgreSQL database storage');
    return new DBStorage(db);
  } else {
    if (dbStatus.status === 'failed') {
      console.warn('⚠️  Database connection failed, falling back to in-memory storage');
      console.warn('⚠️  Error:', dbStatus.error);
    }
    console.log('💾 Using in-memory storage (data will be lost on restart)');
    return new MemStorage();
  }
}

// Storage instance that will be initialized asynchronously
let storageInstance: IStorage | null = null;
const storagePromise = initializeStorage().then(s => {
  storageInstance = s;
  return s;
});

// Export a getter that ensures storage is initialized
export const storage: IStorage = new Proxy({} as IStorage, {
  get(target, prop) {
    if (!storageInstance) {
      throw new Error('Storage not yet initialized. Ensure you await server startup.');
    }
    return (storageInstance as any)[prop];
  }
});

// Export function to wait for storage initialization
export async function waitForStorage() {
  return storagePromise;
}
