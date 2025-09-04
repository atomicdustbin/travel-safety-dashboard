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

      // Validate each country name before processing
      const validationResults = countryNames.map(countryName => {
        const validation = dataFetcher.validateCountryName(countryName);
        return { originalName: countryName, ...validation };
      });

      // Check for invalid countries
      const invalidCountries = validationResults.filter(result => !result.isValid);
      
      if (invalidCountries.length > 0) {
        const errorMessages = invalidCountries.map(invalid => {
          const message = `'${invalid.originalName}' is not a recognized country name`;
          return invalid.suggestion 
            ? `${message}. Did you mean '${invalid.suggestion}'?`
            : message;
        });

        return res.status(400).json({ 
          error: "Invalid country names found",
          details: errorMessages,
          validCountries: validationResults.filter(r => r.isValid).map(r => r.normalizedName)
        });
      }

      // Process only valid countries
      const validCountryNames = validationResults.map(result => result.normalizedName!);
      
      const fetchPromises = validCountryNames.map(async (countryName) => {
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
      
      // Validate country name first
      const validation = dataFetcher.validateCountryName(name);
      if (!validation.isValid) {
        const message = `'${name}' is not a recognized country name`;
        const error = validation.suggestion 
          ? `${message}. Did you mean '${validation.suggestion}'?`
          : message;
        return res.status(404).json({ error });
      }

      const normalizedName = validation.normalizedName!;
      const countryData = await storage.getCountryData(normalizedName);
      
      if (!countryData) {
        // Try to fetch new data
        await dataFetcher.fetchAllCountryData(normalizedName);
        const newData = await storage.getCountryData(normalizedName);
        
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
