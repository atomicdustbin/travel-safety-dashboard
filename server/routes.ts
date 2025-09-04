import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { dataFetcher } from "./services/dataFetcher";
import { scheduler } from "./services/scheduler";

export async function registerRoutes(app: Express): Promise<Server> {
  // Search countries endpoint
  app.get("/api/search", async (req, res) => {
    try {
      const { countries } = req.query;
      
      if (!countries || typeof countries !== "string") {
        return res.status(400).json({ error: "Countries parameter is required" });
      }

      const countryNames = countries.split(",").map(name => name.trim()).filter(name => name);
      
      if (countryNames.length === 0) {
        return res.status(400).json({ error: "At least one country name is required" });
      }

      // Fetch fresh data for each country
      const fetchPromises = countryNames.map(async (countryName) => {
        // Add to scheduler refresh list
        scheduler.addCountryToRefresh(countryName);
        
        // Check if we have recent data, if not fetch it
        const existingData = await storage.getCountryData(countryName);
        if (!existingData) {
          await dataFetcher.fetchAllCountryData(countryName);
        }
        
        return storage.getCountryData(countryName);
      });

      const results = await Promise.all(fetchPromises);
      const validResults = results.filter(result => result !== undefined);

      res.json({
        results: validResults,
        totalFound: validResults.length,
        totalRequested: countryNames.length,
      });

    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ error: "Failed to search countries" });
    }
  });

  // Get specific country data
  app.get("/api/country/:name", async (req, res) => {
    try {
      const { name } = req.params;
      const countryData = await storage.getCountryData(name);
      
      if (!countryData) {
        // Try to fetch new data
        await dataFetcher.fetchAllCountryData(name);
        const newData = await storage.getCountryData(name);
        
        if (!newData) {
          return res.status(404).json({ error: "Country not found" });
        }
        
        return res.json(newData);
      }

      res.json(countryData);
    } catch (error) {
      console.error("Country fetch error:", error);
      res.status(500).json({ error: "Failed to fetch country data" });
    }
  });

  // Force refresh country data
  app.post("/api/refresh/:name", async (req, res) => {
    try {
      const { name } = req.params;
      await scheduler.forceRefresh(name);
      
      const updatedData = await storage.getCountryData(name);
      res.json({
        message: "Data refreshed successfully",
        data: updatedData,
      });
    } catch (error) {
      console.error("Refresh error:", error);
      res.status(500).json({ error: "Failed to refresh country data" });
    }
  });

  // Get system status
  app.get("/api/status", async (req, res) => {
    res.json({
      status: "online",
      lastUpdated: new Date().toISOString(),
      alertRefreshInterval: "6 hours",
      backgroundRefreshInterval: "7 days",
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}
