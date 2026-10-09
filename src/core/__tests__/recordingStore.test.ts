import { describe, it, expect, beforeEach } from 'vitest';
import { useRecordingStore } from '../recordingStore';

/** URL.revokeObjectURL mocken, um die Freigabe verifizieren zu können. */
const revoked: string[] = [];
beforeEach(() => {
  revoked.length = 0;
  (globalThis as Record<string, unknown>).URL = {
    ...globalThis.URL,
    createObjectURL: () => `blob:mock-${Math.random()}`,
    revokeObjectURL: (url: string) => void revoked.push(url)
  };
  useRecordingStore.setState({ recordings: [] });
});

function addSample(): string {
  const url = `blob:mock-${Math.random()}`;
  useRecordingStore.getState().add({
    url,
    blob: new Blob(['x'], { type: 'video/webm' }),
    filename: 'rec.webm',
    mode: 'nebula',
    modeLabel: 'Nebula Galaxy',
    timestamp: Date.now(),
    duration: 12,
    sizeBytes: 1024,
    extension: 'webm'
  });
  return url;
}

describe('recordingStore (Object-URL-Hygiene)', () => {
  it('remove(): gibt die Object-URL der entfernten Aufnahme frei', () => {
    const url = addSample();
    const id = useRecordingStore.getState().recordings[0].id;
    useRecordingStore.getState().remove(id);
    expect(revoked).toContain(url);
    expect(useRecordingStore.getState().recordings).toHaveLength(0);
  });

  it('clear(): gibt ALLE Object-URLs frei', () => {
    const a = addSample();
    const b = addSample();
    useRecordingStore.getState().clear();
    expect(revoked).toContain(a);
    expect(revoked).toContain(b);
    expect(useRecordingStore.getState().recordings).toHaveLength(0);
  });

  it('remove() mit unbekannter ID gibt nichts frei und lässt Bestand unverändert', () => {
    const a = addSample();
    useRecordingStore.getState().remove('gibibts-nicht');
    expect(revoked).toHaveLength(0);
    expect(useRecordingStore.getState().recordings[0].url).toBe(a);
  });
});
