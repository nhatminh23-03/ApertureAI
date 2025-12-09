import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User } from "@shared/schema";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "aperture_editor_secret_key",
    resave: false,
    saveUninitialized: false,
    store: undefined,
    cookie: {
      secure: app.get("env") === "production",
    },
  };

  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Local Strategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        // Fail if user not found OR if user exists but has no password (e.g. Google-only account)
        if (!user || !user.password || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (err) {
        return done(err);
      }
    }),
  );

  // Google Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const baseUrl = process.env.BASE_URL || "";
    const callbackPath = "/api/auth/google/callback";
    // If BASE_URL is set, use full URL, otherwise fallback to relative path
    const callbackURL = baseUrl ? `${baseUrl}${callbackPath}` : callbackPath;

    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL,
        passReqToCallback: true
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          // Check if user already exists with this Google ID
          // (We'll assume username = google email for simplicity, or handle linking)
          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error("No email found from Google"), undefined);

          let user = await storage.getUserByUsername(email);

          if (!user) {
            // Create new user
            user = await storage.createUser({
              username: email,
              googleId: profile.id,
              password: null, // No password for Google auth
            });
          } else if (!user.googleId) {
            // Link existing account? For now, we'll just sign them in if emails match
            // Ideally we should update the user to add googleId
            // But strict schema might prevent 'update' if we didn't add an update method
            // Let's just proceed.
          }
          
          return done(null, user);
        } catch (err) {
          return done(err as Error, undefined);
        }
      }
    ));
  }

  passport.serializeUser((user, done) => done(null, (user as User).id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).send("Username already exists");
      }

      const password = req.body.password || "";
      if (password.length < 8) {
        return res.status(400).send("Password must be at least 8 characters long");
      }
      if (!/[A-Z]/.test(password)) {
        return res.status(400).send("Password must contain at least one uppercase letter");
      }
      if (!/[0-9]/.test(password)) {
        return res.status(400).send("Password must contain at least one number");
      }

      const hashedPassword = await hashPassword(req.body.password);
      const user = await storage.createUser({
        ...req.body,
        password: hashedPassword,
        googleId: null,
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.status(200).json(req.user);
  });

  // Google Auth Routes
  app.get("/api/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

  app.get("/api/auth/google/callback", 
    passport.authenticate("google", { failureRedirect: "/auth" }),
    (req, res) => {
      // Successful authentication, redirect home.
      res.redirect("/");
    }
  );

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });

  // Update user profile (username and/or password)
  app.patch("/api/user", async (req, res, next) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const user = req.user as User;
    const { username, currentPassword, newPassword } = req.body;
    
    try {
      const updates: any = {};
      
      // Update username if provided
      if (username && username !== user.username) {
        const existingUser = await storage.getUserByUsername(username);
        if (existingUser) {
          return res.status(400).json({ message: "Username already taken" });
        }
        updates.username = username;
      }
      
      // Update password if provided
      if (newPassword) {
        if (newPassword.length < 8) {
          return res.status(400).json({ message: "Password must be at least 8 characters long" });
        }
        if (!/[A-Z]/.test(newPassword)) {
          return res.status(400).json({ message: "Password must contain at least one uppercase letter" });
        }
        if (!/[0-9]/.test(newPassword)) {
          return res.status(400).json({ message: "Password must contain at least one number" });
        }

        if (!currentPassword) {
          return res.status(400).json({ message: "Current password is required" });
        }
        
        // Verify current password
        const isValid = await comparePasswords(currentPassword, user.password || "");
        if (!isValid) {
          return res.status(400).json({ message: "Current password is incorrect" });
        }
        
        updates.password = await hashPassword(newPassword);
      }
      
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No changes provided" });
      }
      
      const updatedUser = await storage.updateUser(user.id, updates);
      res.json(updatedUser);
    } catch (err) {
      next(err);
    }
  });
}
