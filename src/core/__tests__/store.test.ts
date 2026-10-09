import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../store';

// localStorage wird in src/test/setup.ts gemockt (läuft vor dem Import)

beforeEach(() => {
  globalThis.localStorage.clear();
  useStore.setState({
    settings: {
      ...useStore.getState().settings,
      mode: 'nebula',
      sensitivity: 1.45,
      particleCount: 140
    }
  });
});

describe('settings store', () => {
  it('has sane defaults', () => {
    const s = useStore.getState().settings;
    expect(s.mode).toBe('nebula');
    expect(s.sensitivity).toBeGreaterThan(0);
    expect(s.particleCount).toBeGreaterThan(0);
    expect(s.shaderCode.length).toBeGreaterThan(10);
  });

  it('setSetting updates a single key immutably', () => {
    const before = useStore.getState().settings;
    useStore.getState().setSetting('mode', 'spectrum');
    const after = useStore.getState().settings;
    expect(after.mode).toBe('spectrum');
    expect(before).not.toBe(after);
    expect(before.mode).toBe('nebula');
  });

  it('persists settings to localStorage', () => {
    useStore.getState().setSetting('sensitivity', 2.0);
    const raw = globalThis.localStorage.getItem('avp3-settings-v1');
    expect(raw).toBeTruthy();
    expect(raw).toContain('"sensitivity":2');
  });

  it('resetSettings restores defaults', () => {
    useStore.getState().setSetting('particleCount', 999);
    expect(useStore.getState().settings.particleCount).toBe(999);
    useStore.getState().resetSettings();
    expect(useStore.getState().settings.particleCount).toBe(140);
  });
});
