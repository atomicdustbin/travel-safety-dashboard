import { type Country, type Alert, type BackgroundInfo, type BulkJob, type InsertCountry, type InsertAlert, type InsertBackgroundInfo, type InsertBulkJob, type CountryData } from "@shared/schema";
import { randomUUID } from "crypto";

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

  async getBulkJob(id: string): Promise<BulkJob | undefined> {
    return this.bulkJobs.get(id);
  }

  async createBulkJob(insertJob: InsertBulkJob): Promise<BulkJob> {
    const job: BulkJob = {
      ...insertJob,
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

export const storage = new MemStorage();
