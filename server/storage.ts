import { type Country, type Alert, type BackgroundInfo, type User, type SavedSearch, type PasswordResetToken, type InsertCountry, type InsertAlert, type InsertBackgroundInfo, type InsertUser, type InsertSavedSearch, type InsertPasswordResetToken, type CountryData } from "@shared/schema";
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

  // User operations
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;

  // Saved searches
  getSavedSearchesByUserId(userId: string): Promise<SavedSearch[]>;
  createSavedSearch(savedSearch: InsertSavedSearch): Promise<SavedSearch>;
  deleteSavedSearch(id: string): Promise<void>;

  // Password reset tokens
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(tokenHash: string): Promise<PasswordResetToken | undefined>;
  markTokenAsUsed(tokenHash: string): Promise<void>;
  cleanupExpiredTokens(): Promise<void>;
}

export class MemStorage implements IStorage {
  private countries: Map<string, Country>;
  private alerts: Map<string, Alert>;
  private backgroundInfo: Map<string, BackgroundInfo>;
  private users: Map<string, User>;
  private savedSearches: Map<string, SavedSearch>;
  private passwordResetTokens: Map<string, PasswordResetToken>;

  constructor() {
    this.countries = new Map();
    this.alerts = new Map();
    this.backgroundInfo = new Map();
    this.users = new Map();
    this.savedSearches = new Map();
    this.passwordResetTokens = new Map();
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
        languages: Array.isArray(insertInfo.languages) ? insertInfo.languages : null,
        lastUpdated: new Date(),
      };
      this.backgroundInfo.set(existingInfo.id, updated);
      return updated;
    } else {
      const info: BackgroundInfo = {
        ...insertInfo,
        id: randomUUID(),
        languages: Array.isArray(insertInfo.languages) ? insertInfo.languages : null,
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

  // User operations
  async getUserById(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email.toLowerCase() === email.toLowerCase()
    );
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    if (!username) return undefined;
    return Array.from(this.users.values()).find(
      (user) => user.username?.toLowerCase() === username.toLowerCase()
    );
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.googleId === googleId
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const user: User = {
      ...insertUser,
      id: randomUUID(),
      isEmailVerified: insertUser.isEmailVerified || false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;

    const updated = { ...user, ...updates, updatedAt: new Date() };
    this.users.set(id, updated);
    return updated;
  }

  // Saved searches
  async getSavedSearchesByUserId(userId: string): Promise<SavedSearch[]> {
    return Array.from(this.savedSearches.values()).filter(
      (search) => search.userId === userId
    );
  }

  async createSavedSearch(insertSavedSearch: InsertSavedSearch): Promise<SavedSearch> {
    const savedSearch: SavedSearch = {
      ...insertSavedSearch,
      id: randomUUID(),
      createdAt: new Date(),
    };
    this.savedSearches.set(savedSearch.id, savedSearch);
    return savedSearch;
  }

  async deleteSavedSearch(id: string): Promise<void> {
    this.savedSearches.delete(id);
  }

  // Password reset tokens
  async createPasswordResetToken(insertToken: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const token: PasswordResetToken = {
      ...insertToken,
      id: randomUUID(),
      used: false,
      createdAt: new Date(),
    };
    this.passwordResetTokens.set(token.tokenHash, token);
    return token;
  }

  async getPasswordResetToken(tokenHash: string): Promise<PasswordResetToken | undefined> {
    const token = this.passwordResetTokens.get(tokenHash);
    if (!token) return undefined;
    
    // Check if token has expired
    if (token.expiresAt < new Date()) {
      this.passwordResetTokens.delete(tokenHash);
      return undefined;
    }
    
    return token;
  }

  async markTokenAsUsed(tokenHash: string): Promise<void> {
    const token = this.passwordResetTokens.get(tokenHash);
    if (token) {
      const updatedToken = { ...token, used: true };
      this.passwordResetTokens.set(tokenHash, updatedToken);
    }
  }

  async cleanupExpiredTokens(): Promise<void> {
    const now = new Date();
    const tokensToDelete: string[] = [];
    
    this.passwordResetTokens.forEach((token, tokenHash) => {
      if (token.expiresAt < now || token.used) {
        tokensToDelete.push(tokenHash);
      }
    });
    
    tokensToDelete.forEach(tokenHash => {
      this.passwordResetTokens.delete(tokenHash);
    });
  }
}

export const storage = new MemStorage();
