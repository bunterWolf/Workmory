import nextPhraseIndex from './nextPhraseIndex';

describe('nextPhraseIndex', () => {
  it('never repeats the current phrase and stays in range', () => {
    for (let current = 0; current < 9; current++) {
      for (let random = 0; random < 1; random += 0.01) {
        const next = nextPhraseIndex(current, 9, () => random);
        expect(next).not.toBe(current);
        expect(next).toBeGreaterThanOrEqual(0);
        expect(next).toBeLessThan(9);
      }
    }
  });

  it('can reach every other phrase', () => {
    const reached = new Set();
    for (let random = 0; random < 1; random += 0.01) {
      reached.add(nextPhraseIndex(3, 9, () => random));
    }
    expect([...reached].sort()).toEqual([0, 1, 2, 4, 5, 6, 7, 8]);
  });

  it('keeps the only phrase when there is nothing to change to', () => {
    expect(nextPhraseIndex(0, 1, () => 0.5)).toBe(0);
  });
});
