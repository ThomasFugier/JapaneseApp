import { emptySnapshot, snapshotsEqual, validateSnapshot, type Snapshot } from './model';
import { sampleContent } from './sample-content';

export function seedSnapshot(): Snapshot {
  return validateSnapshot({ ...emptySnapshot(), ...sampleContent() });
}

export function isUnmodifiedSample(snapshot: Snapshot): boolean {
  const expected = seedSnapshot();
  const data = validateSnapshot(snapshot);
  const originalTimes = <T extends { id: string; updatedAt: string }>(items: T[], defaults: T[]): T[] => {
    const times = new Map(defaults.map(item => [item.id, item.updatedAt]));
    return items.map(item => ({ ...item, updatedAt: times.get(item.id) ?? item.updatedAt }));
  };
  // A language migration changes timestamps, but does not make untouched examples personal data.
  return snapshotsEqual({ ...data, notes: originalTimes(data.notes, expected.notes), decks: originalTimes(data.decks, expected.decks), cards: originalTimes(data.cards, expected.cards) }, expected);
}
