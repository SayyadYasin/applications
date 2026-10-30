/** Pure, deterministic recommendation scoring. No I/O, so it is trivially unit-testable. */

export interface CandidateService {
  serviceId: string;
  name: string;
  categoryId: string;
  categorySlug: string;
}

export interface PastBooking {
  serviceId: string;
  categoryId: string;
  at: Date;
}

export interface SeasonalRule {
  match: RegExp; // tested against the category slug
  months: number[]; // 0 = January
  label: string;
}

export const SEASONAL_RULES: SeasonalRule[] = [
  { match: /ac|air-?cond|cooling/, months: [2, 3, 4, 5, 8], label: 'summer' },
  { match: /painter|paint/, months: [9, 10], label: 'festive season' },
  { match: /clean/, months: [9, 10], label: 'festive season' },
  { match: /appliance/, months: [3, 4, 5], label: 'summer' },
  { match: /plumb/, months: [5, 6, 7], label: 'monsoon' },
  { match: /electric/, months: [5, 6, 7], label: 'monsoon' },
];

export const WEIGHTS = { category: 0.4, popularity: 0.25, rebook: 0.2, seasonal: 0.15 } as const;
const REBOOK_DAYS = 60;
const DAY = 86_400_000;

export interface ScoreInput {
  candidates: CandidateService[];
  history: PastBooking[];
  /** serviceId -> bookings in the customer's town over the last 30 days */
  townPopularity: Record<string, number>;
  now: Date;
  limit?: number;
}

export interface Recommendation {
  serviceId: string;
  name: string;
  score: number;
  reason: string;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

export function seasonalMatch(categorySlug: string, now: Date): SeasonalRule | undefined {
  return SEASONAL_RULES.find((r) => r.match.test(categorySlug) && r.months.includes(now.getMonth()));
}

export function scoreServices(input: ScoreInput): Recommendation[] {
  const { candidates, history, townPopularity, now } = input;

  const catCount = new Map<string, number>();
  const lastByService = new Map<string, Date>();
  for (const h of history) {
    catCount.set(h.categoryId, (catCount.get(h.categoryId) ?? 0) + 1);
    const prev = lastByService.get(h.serviceId);
    if (!prev || prev < h.at) lastByService.set(h.serviceId, h.at);
  }
  const maxCat = Math.max(1, ...catCount.values());
  const maxPop = Math.max(1, ...Object.values(townPopularity));

  const scored = candidates.map((c) => {
    const category = (catCount.get(c.categoryId) ?? 0) / maxCat;
    const popularity = (townPopularity[c.serviceId] ?? 0) / maxPop;
    const last = lastByService.get(c.serviceId);
    const daysSince = last ? Math.floor((now.getTime() - last.getTime()) / DAY) : null;
    // Ramps from 0 at booking day to 1 at REBOOK_DAYS and stays there.
    const rebook = daysSince == null ? 0 : Math.min(1, daysSince / REBOOK_DAYS);
    const season = seasonalMatch(c.categorySlug, now);
    const seasonal = season ? 1 : 0;

    const parts = {
      category: WEIGHTS.category * category,
      popularity: WEIGHTS.popularity * popularity,
      rebook: WEIGHTS.rebook * rebook,
      seasonal: WEIGHTS.seasonal * seasonal,
    };
    const score = parts.category + parts.popularity + parts.rebook + parts.seasonal;

    // Reason is driven by the largest contributing signal; ties resolve in this fixed order.
    const order: (keyof typeof parts)[] = ['rebook', 'category', 'seasonal', 'popularity'];
    const top = order.reduce((best, k) => (parts[k] > parts[best] ? k : best), order[0]);
    let reason = 'Popular with customers near you';
    if (score === 0) reason = 'Suggested for you';
    else if (top === 'rebook') reason = `Time to book ${c.name} again - last booked ${daysSince} days ago`;
    else if (top === 'category') reason = 'Because you often book similar services';
    else if (top === 'seasonal') reason = `Popular this ${season!.label}`;

    return { serviceId: c.serviceId, name: c.name, score: round(score), reason };
  });

  return scored
    .sort((a, b) => b.score - a.score || a.serviceId.localeCompare(b.serviceId))
    .slice(0, input.limit ?? 10);
}
