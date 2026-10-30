import { scoreServices, seasonalMatch, CandidateService } from './recommendation.scoring';

const cands: CandidateService[] = [
  { serviceId: 'ac1', name: 'AC Service', categoryId: 'cAC', categorySlug: 'ac-repair' },
  { serviceId: 'el1', name: 'Switch Repair', categoryId: 'cEL', categorySlug: 'electrician' },
  { serviceId: 'bt1', name: 'Facial', categoryId: 'cBT', categorySlug: 'beauty' },
];
const jan = new Date(2026, 0, 15);
const may = new Date(2026, 4, 15);
const daysBefore = (d: Date, n: number) => new Date(d.getTime() - n * 86_400_000);

describe('seasonalMatch', () => {
  it('matches AC in summer only', () => {
    expect(seasonalMatch('ac-repair', may)?.label).toBe('summer');
    expect(seasonalMatch('ac-repair', jan)).toBeUndefined();
    expect(seasonalMatch('beauty', may)).toBeUndefined();
  });
});

describe('scoreServices', () => {
  it('is deterministic', () => {
    const input = { candidates: cands, history: [], townPopularity: { el1: 3 }, now: jan };
    expect(scoreServices(input)).toEqual(scoreServices(input));
  });

  it('boosts AC service in summer with a seasonal reason', () => {
    const r = scoreServices({ candidates: cands, history: [], townPopularity: {}, now: may });
    expect(r[0].serviceId).toBe('ac1');
    expect(r[0].reason).toContain('summer');
    const winter = scoreServices({ candidates: cands, history: [], townPopularity: {}, now: jan });
    expect(winter.find((x) => x.serviceId === 'ac1')!.score).toBe(0);
  });

  it('weights past booking categories', () => {
    const history = [1, 2, 3].map((i) => ({ serviceId: 'x' + i, categoryId: 'cEL', at: daysBefore(jan, 5) }));
    const r = scoreServices({ candidates: cands, history, townPopularity: {}, now: jan });
    expect(r[0].serviceId).toBe('el1');
    expect(r[0].reason).toMatch(/similar/);
  });

  it('suggests rebooking a service last booked long ago', () => {
    const history = [
      { serviceId: 'bt1', categoryId: 'cBT', at: daysBefore(jan, 90) },
      ...[1, 2, 3].map((i) => ({ serviceId: 'x' + i, categoryId: 'cEL', at: daysBefore(jan, 3) })),
    ];
    const r = scoreServices({ candidates: cands, history, townPopularity: {}, now: jan });
    expect(r.find((x) => x.serviceId === 'bt1')!.reason).toContain('90 days ago');
  });

  it('a just-booked service gets less rebook push than one booked long ago', () => {
    const recent = scoreServices({ candidates: cands, history: [{ serviceId: 'bt1', categoryId: 'cBT', at: daysBefore(jan, 2) }], townPopularity: {}, now: jan });
    const old = scoreServices({ candidates: cands, history: [{ serviceId: 'bt1', categoryId: 'cBT', at: daysBefore(jan, 60) }], townPopularity: {}, now: jan });
    expect(old.find((x) => x.serviceId === 'bt1')!.score).toBeGreaterThan(recent.find((x) => x.serviceId === 'bt1')!.score);
  });

  it('uses town popularity for new customers', () => {
    const r = scoreServices({ candidates: cands, history: [], townPopularity: { bt1: 20, el1: 5 }, now: jan });
    expect(r.map((x) => x.serviceId)).toEqual(['bt1', 'el1', 'ac1']);
    expect(r[0].reason).toMatch(/near you/);
  });

  it('respects limit and breaks ties by id', () => {
    const r = scoreServices({ candidates: cands, history: [], townPopularity: {}, now: jan, limit: 2 });
    expect(r).toHaveLength(2);
    expect(r.map((x) => x.serviceId)).toEqual(['ac1', 'bt1']);
    expect(r[0].reason).toBe('Suggested for you');
  });
});
