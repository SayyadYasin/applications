import { cancellationRefund } from './refund-policy';

describe('cancellationRefund', () => {
  const now = new Date('2026-01-01T10:00:00Z');
  const at = (h: number) => new Date(now.getTime() + h * 3600_000);

  it('refunds 100% when more than 2h ahead', () => {
    const r = cancellationRefund(590, at(3), now);
    expect(r.pct).toBe(100);
    expect(r.amount.toString()).toBe('590');
  });
  it('refunds 50% at exactly 2h and inside the window', () => {
    expect(cancellationRefund(590, at(2), now).pct).toBe(50);
    expect(cancellationRefund('590.00', at(0.5), now).amount.toString()).toBe('295');
  });
  it('refunds 50% for past schedule and rounds to 2dp', () => {
    expect(cancellationRefund(100.01, at(-1), now).amount.toString()).toBe('50.01');
  });
});
