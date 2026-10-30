import { AssignmentService, haversineKm } from './assignment.service';

describe('haversineKm', () => {
  it('is zero for identical points', () => {
    expect(haversineKm({ lat: 19.99, lng: 73.79 }, { lat: 19.99, lng: 73.79 })).toBeCloseTo(0, 6);
  });
  it('matches a known distance (Nashik -> Mumbai ~ 150 km)', () => {
    const d = haversineKm({ lat: 19.9975, lng: 73.7898 }, { lat: 19.076, lng: 72.8777 });
    expect(d).toBeGreaterThan(130);
    expect(d).toBeLessThan(170);
  });
  it('is symmetric', () => {
    const a = { lat: 10, lng: 20 };
    const b = { lat: 11, lng: 22 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 9);
  });
  it('one degree of latitude is about 111 km', () => {
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.2, 0);
  });
});

describe('AssignmentService.rank', () => {
  const origin = { lat: 20, lng: 73 };
  // ~0.009 deg lat ~ 1 km
  const at = (km: number) => ({ lat: origin.lat + km / 111.2, lng: origin.lng });
  const partner = (id: string, km: number, over: Record<string, unknown> = {}) => ({
    id, ...at(km), availability: [], radiusKm: 10, ratingAvg: 4, acceptanceRate: 1, ...over,
  });
  const make = (partners: unknown[]) => {
    const prisma = { partner: { findMany: jest.fn().mockResolvedValue(partners) } };
    return { svc: new AssignmentService(prisma as any), prisma };
  };
  const q = { serviceId: 's', ...origin, at: new Date(), durationMin: 60 };

  it('excludes partners outside their own radius', async () => {
    const { svc } = make([partner('near', 2), partner('far', 12)]);
    const r = await svc.rank(q);
    expect(r.map((x) => x.partnerId)).toEqual(['near']);
  });

  it('ranks closer partners higher with equal quality', async () => {
    const { svc } = make([partner('b', 5), partner('a', 1)]);
    const r = await svc.rank(q);
    expect(r.map((x) => x.partnerId)).toEqual(['a', 'b']);
  });

  it('rating can outweigh a small distance difference', async () => {
    const { svc } = make([partner('close-low', 1, { ratingAvg: 1 }), partner('slightly-far-high', 2, { ratingAvg: 5 })]);
    const r = await svc.rank(q);
    expect(r[0].partnerId).toBe('slightly-far-high');
  });

  it('preferred partner gets a boost that can beat a closer partner', async () => {
    const { svc } = make([partner('closer', 1), partner('fav', 4)]);
    const without = await svc.rank(q);
    expect(without[0].partnerId).toBe('closer');
    const withPref = await svc.rank({ ...q, preferredPartnerId: 'fav' });
    expect(withPref[0].partnerId).toBe('fav');
  });

  it('the preferred boost does not resurrect out-of-radius partners', async () => {
    const { svc } = make([partner('fav', 20)]);
    expect(await svc.rank({ ...q, preferredPartnerId: 'fav' })).toEqual([]);
  });

  it('skips partners whose availability slots do not cover the booking time', async () => {
    const t = new Date(2026, 0, 5, 10, 0); // Monday 10:00
    const slot = (weekday: number) => ({ weekday, startMin: 540, endMin: 1140 });
    const { svc } = make([partner('open', 1, { availability: [slot(1)] }), partner('wrongDay', 1, { availability: [slot(2)] })]);
    const r = await svc.rank({ ...q, at: t });
    expect(r.map((x) => x.partnerId)).toEqual(['open']);
  });

  it('queries only approved, online partners offering the service', async () => {
    const { svc, prisma } = make([]);
    await svc.rank(q);
    const where = prisma.partner.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ kycStatus: 'APPROVED', isOnline: true, services: { some: { serviceId: 's' } } });
  });
});
