import { describe, it, expect, vi } from 'vitest';
import { nextTrackIndex, prevTrackIndex, removeTrackIndex, nextIndexForMode, shuffleTrackIndex } from '../playlist';

describe('nextTrackIndex', () => {
  it('returns -1 for an empty list', () => {
    expect(nextTrackIndex(0, 0)).toBe(-1);
    expect(nextTrackIndex(-1, 0)).toBe(-1);
  });

  it('starts at 0 when nothing is selected', () => {
    expect(nextTrackIndex(-1, 3)).toBe(0);
  });

  it('wraps around at the end', () => {
    expect(nextTrackIndex(2, 3)).toBe(0);
  });

  it('advances within bounds', () => {
    expect(nextTrackIndex(0, 3)).toBe(1);
    expect(nextTrackIndex(1, 3)).toBe(2);
  });
});

describe('prevTrackIndex', () => {
  it('returns -1 for an empty list', () => {
    expect(prevTrackIndex(0, 0)).toBe(-1);
  });

  it('starts at the last track when nothing is selected', () => {
    expect(prevTrackIndex(-1, 3)).toBe(2);
  });

  it('wraps around at the beginning', () => {
    expect(prevTrackIndex(0, 3)).toBe(2);
  });

  it('steps back within bounds', () => {
    expect(prevTrackIndex(2, 3)).toBe(1);
  });
});

describe('removeTrackIndex', () => {
  it('returns -1 when the current track is removed', () => {
    expect(removeTrackIndex(2, 2)).toBe(-1);
  });

  it('shifts down when a track before the current one is removed', () => {
    expect(removeTrackIndex(3, 1)).toBe(2);
  });

  it('keeps the index when a track after the current one is removed', () => {
    expect(removeTrackIndex(1, 3)).toBe(1);
  });
});

describe('nextIndexForMode · Wiedergabe-Modi', () => {
  it('off stoppt immer (-1)', () => {
    expect(nextIndexForMode('off', 2, 5)).toBe(-1);
    expect(nextIndexForMode('off', 0, 1)).toBe(-1);
    expect(nextIndexForMode('off', 2, 0)).toBe(-1);
  });

  it('one wiederholt den aktuellen Track', () => {
    expect(nextIndexForMode('one', 2, 5)).toBe(2);
    expect(nextIndexForMode('one', -1, 5)).toBe(-1);
  });

  it('all geht zum nächsten (zyklisch)', () => {
    expect(nextIndexForMode('all', 2, 5)).toBe(3);
    expect(nextIndexForMode('all', 4, 5)).toBe(0);
  });

  it('shuffle wählt einen anderen Track (Re-Roll bei Treffer)', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.0) // Roll 1 → 0 === current → Re-Roll
      .mockReturnValueOnce(0.5); // Roll 2 → 2
    expect(nextIndexForMode('shuffle', 0, 5)).toBe(2);
    expect(nextIndexForMode('shuffle', 0, 1)).toBe(0);
    expect(nextIndexForMode('shuffle', 0, 0)).toBe(-1);
    vi.restoreAllMocks();
  });
});

describe('shuffleTrackIndex', () => {
  it('liefert nie den aktuellen Index (Re-Roll)', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.99) // → 4 === current
      .mockReturnValueOnce(0.5); // → 2
    expect(shuffleTrackIndex(4, 5)).toBe(2);
    vi.restoreAllMocks();
  });

  it('Ein-Track-Liste liefert 0', () => {
    expect(shuffleTrackIndex(0, 1)).toBe(0);
  });
});
