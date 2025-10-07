import { sql } from "drizzle-orm";
import { pgTable, text, varchar, json, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const countries = pgTable("countries", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  flagUrl: text("flag_url"),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const alerts = pgTable("alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  countryId: varchar("country_id").notNull(),
  source: text("source").notNull(),
  title: text("title").notNull(),
  level: text("level"),
  severity: text("severity").notNull(), // 'high', 'medium', 'low', 'info'
  summary: text("summary").notNull(),
  link: text("link").notNull(),
  date: timestamp("date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  // AI-enhanced data (only populated for US State Dept advisories when AI is available)
  keyRisks: json("key_risks").$type<string[]>(),
  safetyRecommendations: json("safety_recommendations").$type<string[]>(),
  specificAreas: json("specific_areas").$type<string[]>(),
  aiEnhanced: timestamp("ai_enhanced"), // When AI enhancement was last performed
});

export const backgroundInfo = pgTable("background_info", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  countryId: varchar("country_id").notNull().unique(),
  languages: json("languages").$type<string[]>(),
  religion: text("religion"),
  gdpPerCapita: integer("gdp_per_capita"),
  population: text("population"),
  capital: text("capital"),
  currency: text("currency"),
  wikiLink: text("wiki_link"),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const bulkJobs = pgTable("bulk_jobs", {
  id: varchar("id").primaryKey(),
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),
  status: text("status").notNull(), // 'running', 'completed', 'failed', 'cancelled'
  totalCountries: integer("total_countries").notNull(),
  processedCountries: integer("processed_countries").notNull().default(0),
  failedCountries: integer("failed_countries").notNull().default(0),
  errorLog: json("error_log").$type<Array<{ country: string; error: string }>>(),
  lastRunDate: timestamp("last_run_date"), // For preventing duplicate daily runs
});

export const jobCountryProgress = pgTable("job_country_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull(),
  countryName: text("country_name").notNull(),
  status: text("status").notNull(), // 'pending', 'processing', 'completed', 'failed'
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  error: text("error"),
  retryCount: integer("retry_count").notNull().default(0),
});

export const embassiesConsulates = pgTable("embassies_consulates", {
  id: varchar("id").primaryKey(),
  countryCode: text("country_code").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'embassy', 'consulate', 'consulate_general'
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  streetAddress: text("street_address"),
  city: text("city"),
  phone: text("phone"),
  website: text("website"),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// Insert schemas
export const insertCountrySchema = createInsertSchema(countries).omit({
  lastUpdated: true,
});

export const insertAlertSchema = createInsertSchema(alerts).omit({
  id: true,
  createdAt: true,
});

export const insertBackgroundInfoSchema = createInsertSchema(backgroundInfo).omit({
  id: true,
  lastUpdated: true,
});

export const insertBulkJobSchema = createInsertSchema(bulkJobs);

export const insertJobCountryProgressSchema = createInsertSchema(jobCountryProgress).omit({
  id: true,
});

export const insertEmbassyConsulateSchema = createInsertSchema(embassiesConsulates).omit({
  lastUpdated: true,
});

// Types
export type Country = typeof countries.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type BackgroundInfo = typeof backgroundInfo.$inferSelect;
export type BulkJob = typeof bulkJobs.$inferSelect;
export type JobCountryProgress = typeof jobCountryProgress.$inferSelect;
export type EmbassyConsulate = typeof embassiesConsulates.$inferSelect;
export type InsertCountry = z.infer<typeof insertCountrySchema>;
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type InsertBackgroundInfo = z.infer<typeof insertBackgroundInfoSchema>;
export type InsertBulkJob = z.infer<typeof insertBulkJobSchema>;
export type InsertJobCountryProgress = z.infer<typeof insertJobCountryProgressSchema>;
export type InsertEmbassyConsulate = z.infer<typeof insertEmbassyConsulateSchema>;

// Combined types for API responses
export type CountryData = {
  country: Country;
  alerts: Alert[];
  background: BackgroundInfo | null;
  embassies: EmbassyConsulate[];
};

export type SearchResult = CountryData[];
