import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function pageArgs(q: { page?: number; limit?: number }) {
  const limit = q.limit ?? 20;
  const page = q.page ?? 1;
  return { take: limit, skip: (page - 1) * limit, page, limit };
}

export function paged<T>(items: T[], total: number, p: { page: number; limit: number }) {
  return { items, total, page: p.page, limit: p.limit, pages: Math.ceil(total / p.limit) };
}

export function dateFilter(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  return { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) };
}

/** Runs a delete and converts FK violations into a readable 409. */
export async function safeDelete<T>(fn: () => Promise<T>, what: string): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      throw new ConflictException(`${what} is still referenced by other records; deactivate it instead`);
    }
    throw e;
  }
}

export const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
export const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

/** Converts bigint / Decimal values coming out of $queryRaw into plain numbers. */
export function normalizeRaw<T = Record<string, unknown>>(rows: unknown[]): T[] {
  return rows.map((r) => {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r as Record<string, unknown>)) {
      if (typeof v === 'bigint') o[k] = Number(v);
      else if (v instanceof Prisma.Decimal) o[k] = v.toNumber();
      else o[k] = v;
    }
    return o as T;
  });
}
