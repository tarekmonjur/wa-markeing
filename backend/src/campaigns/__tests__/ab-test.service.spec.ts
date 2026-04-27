import { AbTestService } from '../ab-test.service';

describe('AbTestService — splitContacts', () => {
  let service: AbTestService;

  beforeEach(() => {
    // Create service with null dependencies — only testing splitContacts (pure function)
    service = new AbTestService(null as any, null as any, null as any, null as any);
  });

  it('splits 100 contacts exactly 50/50 with 0.5 splitRatio', () => {
    const ids = Array.from({ length: 100 }, (_, i) => `contact-${i}`);
    const { a, b } = service.splitContacts(ids, 0.5, 'test-seed-1');

    expect(a.length).toBe(50);
    expect(b.length).toBe(50);
    // All contacts present
    expect([...a, ...b].sort()).toEqual(ids.sort());
  });

  it('deterministic shuffle: same inputs always produce same split', () => {
    const ids = Array.from({ length: 100 }, (_, i) => `c-${i}`);
    const seed = 'deterministic-seed-abc';

    const split1 = service.splitContacts(ids, 0.5, seed);
    const split2 = service.splitContacts(ids, 0.5, seed);

    expect(split1.a).toEqual(split2.a);
    expect(split1.b).toEqual(split2.b);
  });

  it('different seeds produce different splits', () => {
    const ids = Array.from({ length: 100 }, (_, i) => `c-${i}`);

    const split1 = service.splitContacts(ids, 0.5, 'seed-a');
    const split2 = service.splitContacts(ids, 0.5, 'seed-b');

    expect(split1.a).not.toEqual(split2.a);
  });

  it('splitRatio 0.3 produces 30 in group A and 70 in group B', () => {
    const ids = Array.from({ length: 100 }, (_, i) => `c-${i}`);
    const { a, b } = service.splitContacts(ids, 0.3, 'split-30-70');

    expect(a.length).toBe(30);
    expect(b.length).toBe(70);
  });

  it('splitRatio 0.7 produces 70 in group A and 30 in group B', () => {
    const ids = Array.from({ length: 100 }, (_, i) => `c-${i}`);
    const { a, b } = service.splitContacts(ids, 0.7, 'split-70-30');

    expect(a.length).toBe(70);
    expect(b.length).toBe(30);
  });

  it('handles empty contact list', () => {
    const { a, b } = service.splitContacts([], 0.5, 'empty');

    expect(a).toEqual([]);
    expect(b).toEqual([]);
  });

  it('handles single contact', () => {
    const { a, b } = service.splitContacts(['c-1'], 0.5, 'single');

    expect(a.length + b.length).toBe(1);
  });

  it('no contact appears in both groups', () => {
    const ids = Array.from({ length: 200 }, (_, i) => `c-${i}`);
    const { a, b } = service.splitContacts(ids, 0.5, 'no-overlap');

    const setA = new Set(a);
    const setB = new Set(b);
    const overlap = a.filter((id) => setB.has(id));

    expect(overlap.length).toBe(0);
    expect(setA.size + setB.size).toBe(200);
  });
});
