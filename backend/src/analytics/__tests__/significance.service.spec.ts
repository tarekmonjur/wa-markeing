import { SignificanceService } from '../significance.service';

describe('SignificanceService', () => {
  let service: SignificanceService;

  beforeEach(() => {
    service = new SignificanceService();
  });

  it('returns INCONCLUSIVE when < 100 delivered per variant', () => {
    const result = service.computeSignificance(
      { delivered: 50, read: 30 },
      { delivered: 50, read: 20 },
    );

    expect(result.winner).toBe('INCONCLUSIVE');
    expect(result.isSignificant).toBe(false);
    expect(result.pValue).toBe(1);
    expect(result.message).toContain('Not enough data');
  });

  it('returns INCONCLUSIVE when only one variant has < 100', () => {
    const result = service.computeSignificance(
      { delivered: 200, read: 100 },
      { delivered: 50, read: 25 },
    );

    expect(result.winner).toBe('INCONCLUSIVE');
    expect(result.isSignificant).toBe(false);
  });

  it('returns INCONCLUSIVE when read rates are equal (p >= 0.05)', () => {
    const result = service.computeSignificance(
      { delivered: 200, read: 100 },
      { delivered: 200, read: 100 },
    );

    expect(result.winner).toBe('INCONCLUSIVE');
    expect(result.isSignificant).toBe(false);
    expect(result.message).toContain('No significant difference');
  });

  it('returns winner A when A read rate is significantly higher', () => {
    // A: 80% read rate, B: 50% read rate — large difference with 200+ samples
    const result = service.computeSignificance(
      { delivered: 200, read: 160 },
      { delivered: 200, read: 100 },
    );

    expect(result.winner).toBe('A');
    expect(result.isSignificant).toBe(true);
    expect(result.pValue).toBeLessThan(0.05);
    expect(result.message).toContain('Variant A');
  });

  it('returns winner B when B read rate is significantly higher', () => {
    // A: 40% read rate, B: 75% read rate
    const result = service.computeSignificance(
      { delivered: 200, read: 80 },
      { delivered: 200, read: 150 },
    );

    expect(result.winner).toBe('B');
    expect(result.isSignificant).toBe(true);
    expect(result.pValue).toBeLessThan(0.05);
    expect(result.message).toContain('Variant B');
  });

  it('handles zero reads correctly', () => {
    const result = service.computeSignificance(
      { delivered: 200, read: 0 },
      { delivered: 200, read: 0 },
    );

    expect(result.isSignificant).toBe(false);
    expect(result.winner).toBe('INCONCLUSIVE');
  });

  it('handles small differences as not significant', () => {
    // A: 52%, B: 50% — very close
    const result = service.computeSignificance(
      { delivered: 100, read: 52 },
      { delivered: 100, read: 50 },
    );

    expect(result.isSignificant).toBe(false);
    expect(result.winner).toBe('INCONCLUSIVE');
  });
});
