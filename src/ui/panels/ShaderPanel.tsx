import { useState } from 'react';
import { useStore } from '../../core/store';
import { useT, translateOrFallback } from '../../core/i18n';
import { shaderPresets, CUSTOM_GLSL_HEADER } from '../../engine/shaders/presets';
import { engine } from '../../engine/Engine';
import { Slider, SelectBox, ActionButton, PanelSection } from '../components/ui';

export function ShaderPanel() {
  const settings = useStore((s) => s.settings);
  const setSetting = useStore((s) => s.setSetting);
  const tr = useT();
  const [error, setError] = useState<string | null>(null);

  const presetOptions = [
    ...Object.entries(shaderPresets).map(([id, p]) => ({
      value: id,
      label: translateOrFallback(tr, `shader.preset.${id}`, p.name)
    })),
    { value: 'custom', label: tr('shader.customLabel') }
  ];

  /** Preset wählen: wechselt bei Bedarf automatisch in den Shader-Modus, damit die Änderung sichtbar ist. */
  const handlePresetChange = (v: string): void => {
    setSetting('shaderPreset', v);
    if (settings.mode !== 'shader' && settings.mode !== 'fusion') setSetting('mode', 'shader');
    setError(null);
    const res = engine.applyShader(v, undefined);
    if (!res.success && res.error) setError(res.error);
  };

  const handleCompile = (): void => {
    if (settings.mode !== 'shader' && settings.mode !== 'fusion') setSetting('mode', 'shader');
    const res = engine.applyShader('custom', settings.shaderCode);
    if (res.success) {
      setError(null);
      setSetting('shaderPreset', 'custom');
    } else {
      setError(res.error ?? tr('shader.unknownError'));
    }
  };

  return (
    <>
      <PanelSection title={tr('shader.studio')}>
        <SelectBox
          label={tr('shader.preset')}
          value={settings.shaderPreset}
          options={presetOptions}
          onChange={handlePresetChange}
        />
        <Slider
          label={tr('shader.blend')}
          value={settings.shaderBlend}
          min={0}
          max={1}
          step={0.05}
          disabled={settings.mode !== 'fusion'}
          onChange={(v) => setSetting('shaderBlend', v)}
        />
      </PanelSection>

      <PanelSection title={settings.shaderPreset === 'custom' ? tr('shader.customCode') : tr('shader.preview')}>
        <textarea
          className="code-input"
          spellCheck={false}
          value={settings.shaderCode}
          onChange={(e) => setSetting('shaderCode', e.target.value)}
          placeholder={`${CUSTOM_GLSL_HEADER} { … }`}
        />
        <div className="button-row">
          {/* Kompilieren ist von überall möglich – der Handler wechselt bei Bedarf automatisch in den Shader-Modus */}
          <ActionButton onClick={handleCompile}>
            {tr('shader.compile')}
          </ActionButton>
        </div>
        <p className="hint" dangerouslySetInnerHTML={{ __html: tr('shader.hint').replace('{tmpl}', CUSTOM_GLSL_HEADER) }} />
        {error && (
          <div className="error-box">
            <strong>{tr('shader.error')}</strong>
            <pre>{error}</pre>
          </div>
        )}
      </PanelSection>
    </>
  );
}
