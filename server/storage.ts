import { type Country, type Alert, type BackgroundInfo, type InsertCountry, type InsertAlert, type InsertBackgroundInfo, type CountryData } from "@shared/schema";
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
}

export class MemStorage implements IStorage {
  private countries: Map<string, Country>;
  private alerts: Map<string, Alert>;
  private backgroundInfo: Map<string, BackgroundInfo>;

  constructor() {
    this.countries = new Map();
    this.alerts = new Map();
    this.backgroundInfo = new Map();
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
      createdAt: new Date(),
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
        lastUpdated: new Date(),
      };
      this.backgroundInfo.set(existingInfo.id, updated);
      return updated;
    } else {
      const info: BackgroundInfo = {
        ...insertInfo,
        id: randomUUID(),
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
      background,
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
}

export const storage = new MemStorage();
