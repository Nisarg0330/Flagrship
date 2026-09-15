import { PrismaClient } from '@prisma/client';

// Singleton. `tsx --watch` re-evaluates this module on every save, and a fresh
// PrismaClient per reload leaks a connection pool each time — Postgres starts
// refusing connections within a minute of active editing.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
