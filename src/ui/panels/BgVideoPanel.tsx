import { useRef, useState } from 'react';
import { useStore } from '../../core/store';
import { useT } from '../../core/i18n';
import { engine } from '../../engine/Engine';
import { Slider, SelectBox, ActionButton, PanelSection } from '../components/ui';

export function BgVideoPanel() {
  const settings = useStore((s) => s.settings);
  const setSetting = useStore((s) => s.setSetting);
  const tr = useT();
  const bgRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [bgUrl, setBgUrl] = useState('');

  return (
    <>
      <PanelSection title={tr('bg.title')}>
        <input
          ref={bgRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) engine.setBackgroundImage(f);
            e.target.value = '';
          }}
        />
        <div className="button-row">
          <ActionButton variant="ghost" onClick={() => bgRef.current?.click()}>
            {tr('bg.choose')}
          </ActionButton>
          <ActionButton variant="ghost" onClick={() => engine.clearBackground()}>
            {tr('bg.remove')}
          </ActionButton>
        </div>
        <div className="url-row">
          <input
            type="url"
            name="bg-url"
            className="url-input"
            placeholder={tr('bg.urlPlaceholder')}
            value={bgUrl}
            onChange={(e) => setBgUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && bgUrl.trim()) {
                engine.setBackgroundImageUrl(bgUrl.trim());
                setBgUrl('');
              }
            }}
          />
          <ActionButton
            variant="ghost"
            disabled={!bgUrl.trim()}
            onClick={() => {
              engine.setBackgroundImageUrl(bgUrl.trim());
              setBgUrl('');
            }}
          >
            {tr('audio.loadBtn')}
          </ActionButton>
        </div>
        <Slider label={tr('bg.opacity')} value={settings.bgOpacity} min={0} max={1} step={0.05} onChange={(v) => setSetting('bgOpacity', v)} />
        <Slider label={tr('bg.contrast')} value={settings.bgContrast} min={0.25} max={1.2} step={0.05} onChange={(v) => setSetting('bgContrast', v)} />
        <SelectBox
          label={tr('bg.fit')}
          value={settings.bgFitMode}
          options={[
            { value: 'cover', label: tr('bg.fitCover') },
            { value: 'contain', label: tr('bg.fitContain') }
          ]}
          onChange={(v) => setSetting('bgFitMode', v as never)}
        />
        <Slider label={tr('bg.zoom')} value={settings.bgScale} min={0.5} max={2.5} step={0.05} onChange={(v) => setSetting('bgScale', v)} />
        <Slider label={tr('bg.posX')} value={settings.bgPosX} min={-1} max={1} step={0.05} onChange={(v) => setSetting('bgPosX', v)} />
        <Slider label={tr('bg.posY')} value={settings.bgPosY} min={-1} max={1} step={0.05} onChange={(v) => setSetting('bgPosY', v)} />
      </PanelSection>

      <PanelSection title={tr('bg.overlay')}>
        <input
          type="text"
          name="overlay-text"
          className="url-input"
          placeholder={tr('bg.overlayPlaceholder')}
          value={settings.overlayText}
          onChange={(e) => setSetting('overlayText', e.target.value)}
        />
        <Slider
          label={tr('bg.textSize')}
          value={settings.overlaySize}
          min={0.5}
          max={2.5}
          step={0.05}
          disabled={!settings.overlayText.trim()}
          onChange={(v) => setSetting('overlaySize', v)}
        />
        <SelectBox
          label={tr('bg.position')}
          value={settings.overlayPosition}
          options={[
            { value: 'top', label: tr('bg.top') },
            { value: 'bottom', label: tr('bg.bottom') }
          ]}
          disabled={!settings.overlayText.trim()}
          onChange={(v) => setSetting('overlayPosition', v as never)}
        />
        <label className="color-pick" style={{ marginTop: 4 }}>
          <span>{tr('bg.textColor')}</span>
          <input
            type="color"
            name="overlay-color"
            value={settings.overlayColor}
            onChange={(e) => setSetting('overlayColor', e.target.value)}
          />
        </label>
        <p className="hint">{tr('bg.overlayHint')}</p>
      </PanelSection>

      <PanelSection title={tr('bg.video')}>
        <input
          ref={videoRef}
          type="file"
          accept="video/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) engine.setOverlayVideo(f);
            e.target.value = '';
          }}
        />
        <div className="button-row">
          <ActionButton variant="ghost" onClick={() => videoRef.current?.click()}>
            {tr('bg.chooseVideo')}
          </ActionButton>
          <ActionButton variant="ghost" onClick={() => engine.clearOverlayVideo()}>
            {tr('bg.remove')}
          </ActionButton>
        </div>
        <Slider label={tr('bg.videoSize')} value={settings.overlayVideoScale} min={0.2} max={1.4} step={0.05} onChange={(v) => setSetting('overlayVideoScale', v)} />
        <Slider label={tr('bg.keyThreshold')} value={settings.overlayKeyThreshold} min={160} max={255} step={1} onChange={(v) => setSetting('overlayKeyThreshold', v)} />
        <Slider label={tr('bg.keySoftness')} value={settings.overlayKeySoftness} min={0} max={80} step={1} onChange={(v) => setSetting('overlayKeySoftness', v)} />
        <Slider label={tr('bg.videoSpeed')} value={settings.overlayVideoSpeed} min={0.25} max={2} step={0.05} onChange={(v) => setSetting('overlayVideoSpeed', v)} />
      </PanelSection>
    </>
  );
}
