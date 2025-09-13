import type { Express } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import { storage } from "./storage";
import { dataFetcher } from "./services/dataFetcher";
import { scheduler } from "./services/scheduler";
import { setupAuth, requireAuth, hashPassword } from "./auth";
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from "@shared/schema";
import { sendEmail, generatePasswordResetEmail, generatePasswordResetConfirmationEmail } from "./emailService";
import crypto from "crypto";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);

  // Authentication routes
  
  // Register endpoint
  app.post("/api/auth/register", async (req, res) => {
    try {
      const result = registerSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ 
          error: "Validation error", 
          details: result.error.errors 
        });
      }

      const { email, username, password, firstName, lastName } = result.data;

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "User already exists with this email" });
      }

      if (username) {
        const existingUsername = await storage.getUserByUsername(username);
        if (existingUsername) {
          return res.status(400).json({ error: "Username already taken" });
        }
      }

      // Hash password and create user
      const passwordHash = await hashPassword(password);
      const user = await storage.createUser({
        email,
        username: username || null,
        passwordHash,
        firstName: firstName || null,
        lastName: lastName || null,
        profileImageUrl: null,
        isEmailVerified: false,
        googleId: null,
      });

      // Log the user in automatically
      req.login(user, (err) => {
        if (err) {
          console.error("Login error after registration:", err);
          return res.status(500).json({ error: "Registration successful but login failed" });
        }
        
        res.json({ 
          message: "Registration successful", 
          user: { 
            id: user.id, 
            email: user.email, 
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl 
          } 
        });
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // Login endpoint
  app.post("/api/auth/login", (req, res, next) => {
    const result = loginSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ 
        error: "Validation error", 
        details: result.error.errors 
      });
    }

    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ error: "Login failed" });
      }
      
      if (!user) {
        return res.status(401).json({ error: info?.message || "Invalid credentials" });
      }

      req.login(user, (loginErr) => {
        if (loginErr) {
          return res.status(500).json({ error: "Login failed" });
        }
        
        res.json({ 
          message: "Login successful", 
          user: { 
            id: user.id, 
            email: user.email, 
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl 
          } 
        });
      });
    })(req, res, next);
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ message: "Logout successful" });
    });
  });

  // Get current user endpoint
  app.get("/api/auth/user", (req, res) => {
    if (req.isAuthenticated() && req.user) {
      const user = req.user as any;
      res.json({ 
        id: user.id, 
        email: user.email, 
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl 
      });
    } else {
      res.status(401).json({ error: "Not authenticated" });
    }
  });

  // Google OAuth routes
  app.get("/api/auth/google", 
    passport.authenticate("google", { scope: ["profile", "email"] })
  );

  app.get("/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/?error=auth_failed" }),
    (req, res) => {
      // Successful authentication, redirect to frontend
      res.redirect("/?auth=success");
    }
  );

  // Saved searches routes (protected)
  app.get("/api/saved-searches", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const savedSearches = await storage.getSavedSearchesByUserId(user.id);
      res.json({ savedSearches });
    } catch (error) {
      console.error("Error fetching saved searches:", error);
      res.status(500).json({ error: "Failed to fetch saved searches" });
    }
  });

  app.post("/api/saved-searches", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { name, countries } = req.body;
      
      if (!name || !countries || !Array.isArray(countries)) {
        return res.status(400).json({ error: "Name and countries array are required" });
      }

      const savedSearch = await storage.createSavedSearch({
        userId: user.id,
        name,
        countries,
      });

      res.json({ savedSearch });
    } catch (error) {
      console.error("Error creating saved search:", error);
      res.status(500).json({ error: "Failed to create saved search" });
    }
  });

  app.delete("/api/saved-searches/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteSavedSearch(id);
      res.json({ message: "Saved search deleted" });
    } catch (error) {
      console.error("Error deleting saved search:", error);
      res.status(500).json({ error: "Failed to delete saved search" });
    }
  });

  // Password reset endpoints
  
  // Rate limiting map for password reset requests
  const resetRequestLimits = new Map<string, { count: number; lastRequest: Date }>();
  
  // Helper function to check rate limiting
  const checkRateLimit = (identifier: string, maxRequests = 3, windowMs = 60 * 60 * 1000): boolean => {
    const now = new Date();
    const existing = resetRequestLimits.get(identifier);
    
    if (!existing) {
      resetRequestLimits.set(identifier, { count: 1, lastRequest: now });
      return true;
    }
    
    // Reset if window expired
    if (now.getTime() - existing.lastRequest.getTime() > windowMs) {
      resetRequestLimits.set(identifier, { count: 1, lastRequest: now });
      return true;
    }
    
    // Check if limit exceeded
    if (existing.count >= maxRequests) {
      return false;
    }
    
    // Increment count
    existing.count++;
    existing.lastRequest = now;
    return true;
  };

  // Forgot password endpoint
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const result = forgotPasswordSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ 
          error: "Validation error", 
          details: result.error.errors 
        });
      }

      const { email } = result.data;
      
      // Rate limiting by email
      if (!checkRateLimit(email)) {
        return res.status(429).json({ 
          error: "Too many password reset requests. Please try again later." 
        });
      }
      
      // Always respond with success to prevent email enumeration
      res.json({ 
        message: "If an account with that email exists, we've sent a password reset link." 
      });
      
      // Check if user exists (but don't reveal this in response)
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return; // Don't send email if user doesn't exist
      }
      
      // Generate secure reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      
      // Store token with 30 minute expiration
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      await storage.createPasswordResetToken({
        userId: user.id,
        tokenHash,
        expiresAt,
      });
      
      // Send reset email
      const emailParams = generatePasswordResetEmail(email, resetToken, user.firstName || undefined);
      const emailSent = await sendEmail(emailParams);
      
      if (!emailSent) {
        console.error('Failed to send password reset email to:', email);
      }
      
    } catch (error) {
      console.error("Password reset request error:", error);
      // Still return success to prevent information leakage
      res.json({ 
        message: "If an account with that email exists, we've sent a password reset link." 
      });
    }
  });

  // Reset password endpoint
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const result = resetPasswordSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ 
          error: "Validation error", 
          details: result.error.errors 
        });
      }

      const { token, password } = result.data;
      
      // Hash the token to find it in database
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      
      // Get and validate token
      const resetToken = await storage.getPasswordResetToken(tokenHash);
      if (!resetToken) {
        return res.status(400).json({ 
          error: "Invalid or expired reset token" 
        });
      }
      
      if (resetToken.used) {
        return res.status(400).json({ 
          error: "Reset token has already been used" 
        });
      }
      
      // Get user
      const user = await storage.getUserById(resetToken.userId);
      if (!user) {
        return res.status(400).json({ 
          error: "User not found" 
        });
      }
      
      // Hash new password and update user
      const passwordHash = await hashPassword(password);
      await storage.updateUser(user.id, { passwordHash });
      
      // Mark token as used
      await storage.markTokenAsUsed(tokenHash);
      
      // Send confirmation email
      const confirmationEmail = generatePasswordResetConfirmationEmail(
        user.email, 
        user.firstName || undefined
      );
      await sendEmail(confirmationEmail);
      
      // Clean up expired tokens
      await storage.cleanupExpiredTokens();
      
      res.json({ message: "Password reset successful" });
      
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

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
