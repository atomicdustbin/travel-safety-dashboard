import { sql } from "drizzle-orm";
import { pgTable, text, varchar, json, timestamp, integer, boolean } from "drizzle-orm/pg-core";
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

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 50 }).unique(),
  passwordHash: text("password_hash"),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  profileImageUrl: text("profile_image_url"),
  isEmailVerified: boolean("is_email_verified").default(false),
  // OAuth fields
  googleId: varchar("google_id", { length: 100 }).unique(),
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const savedSearches = pgTable("saved_searches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  countries: json("countries").$type<string[]>().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
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

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSavedSearchSchema = createInsertSchema(savedSearches).omit({
  id: true,
  createdAt: true,
});

// Registration schema with validation
export const registerSchema = insertUserSchema.omit({ passwordHash: true }).extend({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Login schema
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Types
export type Country = typeof countries.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type BackgroundInfo = typeof backgroundInfo.$inferSelect;
export type User = typeof users.$inferSelect;
export type SavedSearch = typeof savedSearches.$inferSelect;
export type InsertCountry = z.infer<typeof insertCountrySchema>;
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type InsertBackgroundInfo = z.infer<typeof insertBackgroundInfoSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertSavedSearch = z.infer<typeof insertSavedSearchSchema>;
export type RegisterData = z.infer<typeof registerSchema>;
export type LoginData = z.infer<typeof loginSchema>;

// Combined types for API responses
export type CountryData = {
  country: Country;
  alerts: Alert[];
  background: BackgroundInfo | null;
};

export type SearchResult = CountryData[];
