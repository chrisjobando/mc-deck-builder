import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new pg.Pool({ 
  connectionString,
  ssl: { rejectUnauthorized: false }  // Required for Supabase
});
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Re-export types from Prisma
export type { Deck, DeckCard, HeroCard, HeroIdentity, RulesDocument, Session, SessionParticipant, User } from '@prisma/client';

// Type aliases for convenience
export type Aspect = 'Basic' | 'Aggression' | 'Justice' | 'Leadership' | 'Pool' | 'Protection';
export type SessionStatus = 'draft' | 'drafting' | 'building' | 'completed';
export type CollectionMode = 'single' | 'combined' | 'duplicates';

