import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { dataFetcher } from "./services/dataFetcher";
import { scheduler } from "./services/scheduler";
import { bulkDownloadService } from "./services/bulkDownloadService";
import { generatePDFReport } from "./pdfService";
import { type SearchResult } from "@shared/schema";
import { z } from "zod";

// Validation schemas
const pdfExportSchema = z.object({
  countries: z.string().min(1, "Countries parameter is required").transform(str => 
    str.split(",").map(name => name.trim()).filter(name => name)
  ).refine(arr => arr.length > 0, {
    message: "At least one country name is required"
  })
});

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
        
        // Check if we have cached data, if not fetch it
        let countryData = await storage.getCountryData(countryName);
        if (!countryData) {
          await dataFetcher.fetchAllCountryData(countryName);
          countryData = await storage.getCountryData(countryName);
        }
        
        return countryData;
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

  // PDF Export endpoint
  app.post("/api/export/pdf", async (req, res) => {
    try {
      // Validate input using Zod schema
      const validation = pdfExportSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid input parameters",
          details: validation.error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
        });
      }

      const countryNames = validation.data.countries;
      const searchQuery = countryNames.join(", ");

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

      // Process only valid countries - reconstruct search results server-side
      const validCountryNames = validationResults.map(result => result.normalizedName!);
      
      const fetchPromises = validCountryNames.map(async (countryName) => {
        // Add to scheduler refresh list
        scheduler.addCountryToRefresh(countryName);
        
        // Check if we have cached data, if not fetch it
        let countryData = await storage.getCountryData(countryName);
        if (!countryData) {
          await dataFetcher.fetchAllCountryData(countryName);
          countryData = await storage.getCountryData(countryName);
        }
        
        return countryData;
      });

      const results = await Promise.all(fetchPromises);
      const searchResults = results.filter(result => result !== undefined) as SearchResult;

      if (searchResults.length === 0) {
        return res.status(404).json({ error: "No data found for the specified countries" });
      }
      
      // Generate PDF using server-side data
      const pdfBuffer = await generatePDFReport(searchResults, searchQuery);
      
      // Set response headers for PDF download
      const filename = `travel-advisory-report-${new Date().toISOString().split('T')[0]}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      res.send(pdfBuffer);
    } catch (error) {
      console.error("PDF export error:", error);
      res.status(500).json({ error: "Failed to generate PDF report" });
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
      weeklyBulkDownload: "Sundays at 1 AM",
    });
  });

  // Start bulk refresh of all US State Dept advisories
  app.post("/api/refresh-advisories", async (req, res) => {
    try {
      const jobId = await bulkDownloadService.downloadAllStateDeptAdvisories();
      
      res.json({
        message: "Bulk download started successfully",
        jobId,
        status: "running",
      });
    } catch (error) {
      console.error("Bulk download error:", error);
      res.status(500).json({ error: "Failed to start bulk download" });
    }
  });

  // Get progress of a bulk download job
  app.get("/api/refresh-status/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params;
      
      // First check in-memory progress
      const memoryProgress = bulkDownloadService.getJobProgress(jobId);
      if (memoryProgress) {
        return res.json(memoryProgress);
      }

      // If not in memory, check database
      const dbJob = await storage.getBulkJob(jobId);
      if (!dbJob) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Convert database job to progress format
      const progress = {
        jobId: dbJob.id,
        status: dbJob.status as 'running' | 'completed' | 'failed' | 'cancelled',
        totalCountries: dbJob.totalCountries,
        processedCountries: dbJob.processedCountries,
        failedCountries: dbJob.failedCountries,
        currentCountry: null,
        startedAt: dbJob.startedAt,
        completedAt: dbJob.completedAt,
        errors: dbJob.errorLog || [],
      };

      res.json(progress);
    } catch (error) {
      console.error("Get job progress error:", error);
      res.status(500).json({ error: "Failed to get job progress" });
    }
  });

  // Get recent bulk download jobs
  app.get("/api/refresh-history", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const jobs = await storage.getAllBulkJobs(limit);
      
      res.json({
        jobs,
        total: jobs.length,
      });
    } catch (error) {
      console.error("Get job history error:", error);
      res.status(500).json({ error: "Failed to get job history" });
    }
  });

  // Cancel a running bulk download job
  app.post("/api/refresh-cancel/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params;
      const cancelled = await bulkDownloadService.cancelJob(jobId);
      
      if (!cancelled) {
        return res.status(404).json({ error: "Job not found or not running" });
      }

      res.json({
        message: "Job cancelled successfully",
        jobId,
      });
    } catch (error) {
      console.error("Cancel job error:", error);
      res.status(500).json({ error: "Failed to cancel job" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
