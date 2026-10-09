import { useStore } from '../../core/store';
import { useT, type TKey } from '../../core/i18n';
import {
  MODES, PRESET_LIST, CAMERA_MODES, KICK_STYLES, QUALITY_OPTIONS,
  type SpectrumScale, type VisualMode
} from '../../core/types';
import { LOOK_PRESETS, applyLookPreset } from '../../core/lookPresets';
import { Slider, SelectBox, Toggle, PanelSection, ActionButton } from '../components/ui';
import { ModePicker } from '../components/ModePicker';

function randomOf<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function VisualsPanel() {
  const settings = useStore((s) => s.settings);
  const setSetting = useStore((s) => s.setSetting);
  const tr = useT();

  /* 🎲 Überraschung: zufällige Szene + Palette + Kamera */
  const randomize = (): void => {
    const modes = MODES.map((m) => m.id);
    const presets = PRESET_LIST.map((p) => p.id).filter((id) => id !== 'custom');
    const cams = CAMERA_MODES.map((c) => c.id);
    setSetting('mode', randomOf(modes));
    setSetting('preset', randomOf(presets));
    setSetting('cameraMode', randomOf(cams));
  };

  return (
    <>
      <PanelSection title={tr('visuals.look')}>
        <div className="look-grid">
          {LOOK_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`look-chip${settings.lookPreset === p.id ? ' active' : ''}`}
              onClick={() => {
                applyLookPreset(p.id);
                setSetting('lookPreset', p.id);
              }}
            >
              <span className="look-icon">{p.icon}</span>
              {p.name}
            </button>
          ))}
        </div>
      </PanelSection>

      <PanelSection title={tr('visuals.scene')}>
        <ModePicker
          value={settings.mode}
          favorites={settings.favoriteModes}
          onChange={(m) => setSetting('mode', m)}
          onToggleFavorite={(m: VisualMode) => {
            const has = settings.favoriteModes.includes(m);
            setSetting('favoriteModes', has ? settings.favoriteModes.filter((x) => x !== m) : [...settings.favoriteModes, m]);
          }}
        />
        <div className="button-row">
          <ActionButton variant="ghost" onClick={randomize}>
            {tr('visuals.surprise')}
          </ActionButton>
          <ActionButton
            variant="ghost"
            onClick={() => setSetting('autoCycle', !settings.autoCycle)}
            className={settings.autoCycle ? 'active-ghost' : ''}
            title={tr('visuals.autoCycleTitle')}
          >
            {settings.autoCycle ? tr('visuals.autoCycleOn') : tr('visuals.autoCycleOff')}
          </ActionButton>
        </div>
        {settings.autoCycle && (
          <Slider
            label={tr('visuals.autoCycleEvery')}
            value={settings.autoCycleSeconds}
            min={5}
            max={60}
            step={1}
            format={(v) => `${v} s`}
            onChange={(v) => setSetting('autoCycleSeconds', Math.round(v))}
          />
        )}
        <SelectBox
          label={tr('visuals.preset')}
          value={settings.preset}
          options={PRESET_LIST.map((p) => ({
            value: p.id,
            label: p.id === 'custom' ? tr('visuals.customPreset') : p.label
          }))}
          onChange={(v) => setSetting('preset', v as never)}
        />
        {settings.preset === 'custom' && (
          <div className="color-row">
            <label className="color-pick">
              <span>{tr('visuals.accent')}</span>
              <input
                type="color"
                name="customAccent"
                value={settings.customAccent}
                onChange={(e) => setSetting('customAccent', e.target.value)}
              />
            </label>
            <label className="color-pick">
              <span>{tr('visuals.accent2')}</span>
              <input
                type="color"
                name="customAccent2"
                value={settings.customAccent2}
                onChange={(e) => setSetting('customAccent2', e.target.value)}
              />
            </label>
          </div>
        )}
        <Slider
          label={tr('visuals.particles')}
          value={settings.particleCount}
          min={40}
          max={300}
          step={10}
          onChange={(v) => setSetting('particleCount', v)}
        />
      </PanelSection>

      <PanelSection title={tr('visuals.sceneParams')}>
        <Slider
          label={tr('visuals.tunnelSpeed')}
          value={settings.tunnelSpeed}
          min={0.25}
          max={3}
          step={0.05}
          onChange={(v) => setSetting('tunnelSpeed', v)}
        />
        <Slider
          label={tr('visuals.terrainAmp')}
          value={settings.terrainAmplitude}
          min={0.2}
          max={2.5}
          step={0.05}
          onChange={(v) => setSetting('terrainAmplitude', v)}
        />
        <Slider
          label={tr('visuals.particleRot')}
          value={settings.particleRotation}
          min={0.1}
          max={4}
          step={0.05}
          onChange={(v) => setSetting('particleRotation', v)}
        />
        <Slider
          label={tr('visuals.particleSym')}
          value={settings.particleSymmetry}
          min={1}
          max={8}
          step={1}
          format={(v) => `${v} ${tr('visuals.arms')}`}
          onChange={(v) => setSetting('particleSymmetry', v)}
        />
        <Slider
          label={tr('visuals.orbSize')}
          value={settings.orbSize}
          min={0.3}
          max={2.5}
          step={0.05}
          onChange={(v) => setSetting('orbSize', v)}
        />
      </PanelSection>

      <PanelSection title={tr('visuals.kick')}>
        <SelectBox
          label={tr('visuals.kickStyle')}
          value={settings.kickStyle}
          options={KICK_STYLES.map((k) => ({ value: k.id, label: tr(`kick.${k.id}` as TKey) }))}
          onChange={(v) => setSetting('kickStyle', v as never)}
        />
        <Slider
          label={tr('visuals.kickStrength')}
          value={settings.kickVisualStrength}
          min={0}
          max={1.2}
          step={0.05}
          onChange={(v) => setSetting('kickVisualStrength', v)}
        />
        <SelectBox
          label={tr('visuals.spectrumScale')}
          value={settings.spectrumScale}
          options={[
            { value: 'linear', label: tr('visuals.spectrumLinear') },
            { value: 'log', label: tr('visuals.spectrumLog') }
          ]}
          onChange={(v) => setSetting('spectrumScale', v as SpectrumScale)}
        />
      </PanelSection>

      <PanelSection title={tr('visuals.post')} icon="🌟">
        <Toggle label="Bloom" checked={settings.bloomEnabled} onChange={(v) => setSetting('bloomEnabled', v)} />
        <Slider
          label={tr('visuals.bloomStr')}
          value={settings.bloomStrength}
          min={0}
          max={3}
          step={0.05}
          disabled={!settings.bloomEnabled}
          onChange={(v) => setSetting('bloomStrength', v)}
        />
        <Slider
          label={tr('visuals.bloomRadius')}
          value={settings.bloomRadius}
          min={0}
          max={1}
          step={0.05}
          disabled={!settings.bloomEnabled}
          onChange={(v) => setSetting('bloomRadius', v)}
        />
        <Slider
          label={tr('visuals.bloomThresh')}
          value={settings.bloomThreshold}
          min={0}
          max={1}
          step={0.01}
          disabled={!settings.bloomEnabled}
          onChange={(v) => setSetting('bloomThreshold', v)}
        />
        <Toggle label={tr('visuals.vignette')} checked={settings.vignette} onChange={(v) => setSetting('vignette', v)} />
      </PanelSection>

      <PanelSection title={tr('visuals.fx')} icon="🎬">
        <Toggle label={tr('visuals.fxMaster')} checked={settings.fxEnabled} onChange={(v) => setSetting('fxEnabled', v)} />
        <Slider
          label={tr('visuals.fxIntensity')}
          value={settings.fxIntensity}
          min={0}
          max={1.5}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          disabled={!settings.fxEnabled}
          onChange={(v) => setSetting('fxIntensity', v)}
        />
        <div className="toggle-grid">
          <Toggle
            label={tr('visuals.fxChromatic')}
            checked={settings.fxChromatic}
            disabled={!settings.fxEnabled}
            onChange={(v) => setSetting('fxChromatic', v)}
          />
          <Toggle
            label={tr('visuals.fxGrain')}
            checked={settings.fxGrain}
            disabled={!settings.fxEnabled}
            onChange={(v) => setSetting('fxGrain', v)}
          />
          <Toggle
            label={tr('visuals.fxScanlines')}
            checked={settings.fxScanlines}
            disabled={!settings.fxEnabled}
            onChange={(v) => setSetting('fxScanlines', v)}
          />
          <Toggle
            label={tr('visuals.fxGrade')}
            checked={settings.fxGrade}
            disabled={!settings.fxEnabled}
            onChange={(v) => setSetting('fxGrade', v)}
          />
        </div>
        <p className="hint">{tr('visuals.fxHint')}</p>
      </PanelSection>

      <PanelSection title={tr('visuals.quality')}>
        <SelectBox
          label={tr('visuals.renderQuality')}
          value={settings.quality}
          options={QUALITY_OPTIONS.map((q) => ({ value: q.id, label: q.label }))}
          onChange={(v) => setSetting('quality', v as never)}
        />
        <Toggle label={tr('visuals.autoQuality')} checked={settings.autoQuality} onChange={(v) => setSetting('autoQuality', v)} />
      </PanelSection>
    </>
  );
}
