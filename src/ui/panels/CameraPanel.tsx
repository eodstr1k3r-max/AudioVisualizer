import { useState } from 'react';
import { useStore } from '../../core/store';
import { useT, type TKey } from '../../core/i18n';
import { CAMERA_MODES } from '../../core/types';
import {
  captureCameraPreset,
  loadCameraPresets,
  saveCameraPreset,
  clearCameraPreset,
  applyCameraPreset
} from '../../core/cameraPresets';
import { Slider, SelectBox, PanelSection, ActionButton } from '../components/ui';

export function CameraPanel() {
  const settings = useStore((s) => s.settings);
  const setSetting = useStore((s) => s.setSetting);
  const tr = useT();
  const [presets, setPresets] = useState(loadCameraPresets);
  const active = CAMERA_MODES.find((c) => c.id === settings.cameraMode);

  const refresh = (): void => setPresets(loadCameraPresets());

  return (
    <>
      <PanelSection title={tr('cam.mode')}>
        <SelectBox
          label={tr('cam.cam')}
          value={settings.cameraMode}
          options={CAMERA_MODES.map((c) => ({ value: c.id, label: c.label }))}
          onChange={(v) => setSetting('cameraMode', v as never)}
        />
        <div className="meta">
          <div>
            <strong>{tr('meta.mode')}</strong> {active?.label}
          </div>
          <div>
            <strong>{tr('meta.control')}</strong> {tr(`cam.hint.${settings.cameraMode}` as TKey)}
          </div>
        </div>
      </PanelSection>

      <PanelSection title={tr('cam.control')}>
        <Slider
          label={tr('cam.fov')}
          value={settings.cameraFov}
          min={35}
          max={110}
          step={1}
          format={(v) => `${v}°`}
          onChange={(v) => setSetting('cameraFov', v)}
        />
        {settings.cameraMode === 'auto' && (
          <>
            <Slider
              label={tr('cam.radius')}
              value={settings.cameraDistance}
              min={16}
              max={90}
              step={1}
              onChange={(v) => setSetting('cameraDistance', v)}
            />
            <Slider
              label={tr('cam.height')}
              value={settings.cameraHeight}
              min={4}
              max={50}
              step={1}
              onChange={(v) => setSetting('cameraHeight', v)}
            />
            <Slider
              label={tr('cam.flightSpeed')}
              value={settings.autoSpeed}
              min={0.2}
              max={4}
              step={0.05}
              onChange={(v) => setSetting('autoSpeed', v)}
            />
          </>
        )}
        {settings.cameraMode === 'orbit' && (
          <Slider
            label={tr('cam.orbitSpeed')}
            value={settings.orbitSpeed}
            min={0.2}
            max={3}
            step={0.05}
            onChange={(v) => setSetting('orbitSpeed', v)}
          />
        )}
      </PanelSection>

      <PanelSection title={tr('cam.presets')}>
        <p className="hint">{tr('cam.presetHint')}</p>
        <div className="preset-slot-grid">
          {[0, 1, 2].map((slot) => {
            const preset = presets[slot];
            return (
              <div key={slot} className="preset-slot">
                <span className="preset-slot-num">{slot + 1}</span>
                <div className="preset-slot-info">
                  <span className="preset-slot-name">
                    {preset ? `${preset.cameraFov}° · ${preset.cameraDistance.toFixed(0)}m` : tr('cam.slotEmpty')}
                  </span>
                  <span className="preset-slot-actions">
                    <ActionButton
                      variant="ghost"
                      onClick={() => {
                        saveCameraPreset(slot, captureCameraPreset());
                        refresh();
                      }}
                      title={tr('cam.save')}
                    >
                      {tr('cam.save')}
                    </ActionButton>
                    <ActionButton
                      variant="ghost"
                      disabled={!preset}
                      onClick={() => {
                        if (applyCameraPreset(slot)) refresh();
                      }}
                      title={tr('cam.load')}
                    >
                      {tr('cam.load')}
                    </ActionButton>
                    {preset && (
                      <ActionButton
                        variant="danger"
                        className="preset-slot-clear"
                        onClick={() => {
                          clearCameraPreset(slot);
                          refresh();
                        }}
                        title={tr('cam.clear')}
                      >
                        {tr('cam.clear')}
                      </ActionButton>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </PanelSection>

      <PanelSection title={tr('cam.shortcuts')}>
        <div className="shortcut-grid">
          <div className="shortcut-item">
            <span>{tr('cam.switchMode')}</span>
            <kbd>K</kbd>
          </div>
          <div className="shortcut-item">
            <span>{tr('cam.move')}</span>
            <kbd>WASD</kbd>
          </div>
          <div className="shortcut-item">
            <span>{tr('cam.updown')}</span>
            <kbd>Space / Shift</kbd>
          </div>
          <div className="shortcut-item">
            <span>{tr('cam.look')}</span>
            <kbd>{tr('cam.dragMouse')}</kbd>
          </div>
          <div className="shortcut-item">
            <span>{tr('cam.orbitView')}</span>
            <kbd>{tr('cam.mouseTouch')}</kbd>
          </div>
        </div>
      </PanelSection>
    </>
  );
}
