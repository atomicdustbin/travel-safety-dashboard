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
});

export const backgroundInfo = pgTable("background_info", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  countryId: varchar("country_id").notNull(),
  languages: json("languages").$type<string[]>(),
  religion: text("religion"),
  gdpPerCapita: integer("gdp_per_capita"),
  population: text("population"),
  capital: text("capital"),
  currency: text("currency"),
  wikiLink: text("wiki_link"),
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

// Types
export type Country = typeof countries.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type BackgroundInfo = typeof backgroundInfo.$inferSelect;
export type InsertCountry = z.infer<typeof insertCountrySchema>;
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type InsertBackgroundInfo = z.infer<typeof insertBackgroundInfoSchema>;

// Combined types for API responses
export type CountryData = {
  country: Country;
  alerts: Alert[];
  background: BackgroundInfo | null;
};

export type SearchResult = CountryData[];
