import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import bcrypt from "bcryptjs";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import { storage } from "./storage";
import type { User } from "@shared/schema";

// Session configuration
export function configureSession() {
  return session({
    secret: process.env.SESSION_SECRET || "dev-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  });
}

// Configure Passport strategies
export function configurePassport() {
  // Local Strategy (username/password)
  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
      },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user) {
            return done(null, false, { message: "User not found" });
          }

          if (!user.passwordHash) {
            return done(null, false, { message: "Invalid login method" });
          }

          const isValidPassword = await bcrypt.compare(password, user.passwordHash);
          if (!isValidPassword) {
            return done(null, false, { message: "Invalid password" });
          }

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  // Google OAuth Strategy
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: "/api/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user already exists with this Google ID
          let user = await storage.getUserByGoogleId(profile.id);
          
          if (user) {
            return done(null, user);
          }

          // Check if user exists with this email
          const email = profile.emails?.[0]?.value;
          if (email) {
            user = await storage.getUserByEmail(email);
            if (user) {
              // Link Google account to existing user
              const updatedUser = await storage.updateUser(user.id, {
                googleId: profile.id,
                profileImageUrl: user.profileImageUrl || profile.photos?.[0]?.value,
              });
              return done(null, updatedUser || user);
            }
          }

          // Create new user
          if (!email) {
            return done(new Error("No email provided by Google"));
          }

          const newUser = await storage.createUser({
            email,
            googleId: profile.id,
            firstName: profile.name?.givenName || null,
            lastName: profile.name?.familyName || null,
            profileImageUrl: profile.photos?.[0]?.value || null,
            isEmailVerified: true, // Google emails are verified
            passwordHash: null,
            username: null,
          });

          return done(null, newUser);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  // Serialize/deserialize user for session
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUserById(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });
}

// Authentication middleware
export const requireAuth: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Authentication required" });
};

// Optional auth middleware (doesn't block if not authenticated)
export const optionalAuth: RequestHandler = (req, res, next) => {
  // Always proceed, but user info will be available if authenticated
  next();
};

// Setup authentication for Express app
export function setupAuth(app: Express) {
  // Configure session
  app.use(configureSession());
  
  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());
  
  // Configure strategies
  configurePassport();
}

// Utility functions
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}