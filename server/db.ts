import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import * as schema from "@shared/schema";

// Configure WebSocket for local development
neonConfig.webSocketConstructor = ws;

let db: ReturnType<typeof drizzle>;
let dbConnectionStatus: 'connected' | 'failed' | 'no_url' = 'no_url';
let dbError: Error | null = null;

// Initialize database connection with proper error handling
async function initializeDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl || databaseUrl.trim() === '') {
    console.log('ℹ️  No DATABASE_URL found - using in-memory storage');
    dbConnectionStatus = 'no_url';
    return null;
  }

  try {
    console.log('🔌 Attempting to connect to PostgreSQL database...');
    const pool = new Pool({ connectionString: databaseUrl });
    const drizzleDb = drizzle(pool, { schema });
    
    // Test the connection with a simple query (with timeout)
    try {
      await Promise.race([
        pool.query('SELECT 1'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 5000)
        )
      ]);
      console.log('✅ Database connection successful');
      dbConnectionStatus = 'connected';
      return drizzleDb;
    } catch (err) {
      console.error('❌ Database connection test failed:', err instanceof Error ? err.message : String(err));
      dbConnectionStatus = 'failed';
      dbError = err instanceof Error ? err : new Error(String(err));
      return null;
    }
  } catch (error) {
    console.error('❌ Failed to initialize database:', error instanceof Error ? error.message : String(error));
    dbConnectionStatus = 'failed';
    dbError = error instanceof Error ? error : new Error(String(error));
    return null;
  }
}

// Initialize on module load - will be resolved when storage is initialized
let dbInitPromise: Promise<ReturnType<typeof drizzle> | null> = initializeDatabase();
let initializedDb: ReturnType<typeof drizzle> | null = null;

// Export a promise that resolves when db is ready
export async function waitForDb() {
  if (initializedDb === null) {
    initializedDb = await dbInitPromise;
  }
  return initializedDb;
}

// Export db (will be null if initialization failed)
export { initializedDb as db };

// Export connection status for monitoring
export function getDatabaseStatus() {
  return {
    status: dbConnectionStatus,
    error: dbError?.message || null,
    hasConnection: dbConnectionStatus === 'connected',
  };
}
