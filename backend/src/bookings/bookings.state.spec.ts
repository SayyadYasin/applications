import { BookingStatus } from '@prisma/client';
import { TRANSITIONS } from './bookings.service';

const can = (a: BookingStatus, b: BookingStatus) => TRANSITIONS[a].includes(b);

describe('booking state machine', () => {
  it('defines every status', () => {
    expect(Object.keys(TRANSITIONS).sort()).toEqual(Object.keys(BookingStatus).sort());
  });

  it('allows the happy path', () => {
    const path: BookingStatus[] = ['PENDING_PAYMENT', 'CONFIRMED', 'ASSIGNED', 'PARTNER_EN_ROUTE', 'IN_PROGRESS', 'COMPLETED'];
    for (let i = 0; i < path.length - 1; i++) expect(can(path[i], path[i + 1])).toBe(true);
  });

  it('allows partner rejection to return to CONFIRMED', () => {
    expect(can('ASSIGNED', 'CONFIRMED')).toBe(true);
  });

  it('terminal states have no exits', () => {
    for (const s of ['COMPLETED', 'CANCELLED', 'REJECTED'] as const) expect(TRANSITIONS[s]).toEqual([]);
  });

  it('forbids skipping steps and going backwards', () => {
    expect(can('PENDING_PAYMENT', 'ASSIGNED')).toBe(false);
    expect(can('CONFIRMED', 'IN_PROGRESS')).toBe(false);
    expect(can('IN_PROGRESS', 'CANCELLED')).toBe(false);
    expect(can('IN_PROGRESS', 'ASSIGNED')).toBe(false);
    expect(can('COMPLETED', 'CANCELLED')).toBe(false);
  });

  it('cancellation is allowed until the job starts', () => {
    for (const s of ['PENDING_PAYMENT', 'CONFIRMED', 'ASSIGNED', 'PARTNER_EN_ROUTE'] as const) expect(can(s, 'CANCELLED')).toBe(true);
  });
});
