import { useStore } from '../../core/store';

export interface ShaderBundle {
  app: 'avp3';
  version: 1;
  name: string;
  code: string;
  preset: string;
  blend: number;
}

/** Aktuellen Shader als JSON-Datei herunterladen. */
export function exportShader(): void {
  const s = useStore.getState().settings;
  const bundle: ShaderBundle = {
    app: 'avp3',
    version: 1,
    name: `Shader-${Date.now()}`,
    code: s.shaderCode,
    preset: s.shaderPreset,
    blend: s.shaderBlend
  };
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${bundle.name}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  useStore.getState().setUi({ status: 'Shader exportiert (JSON)' });
}

/** Shader aus einer JSON-Datei laden und anwenden. */
export async function importShader(file: File): Promise<boolean> {
  try {
    const text = await file.text();
    const bundle = JSON.parse(text) as ShaderBundle;
    if (bundle.app !== 'avp3' || typeof bundle.code !== 'string') {
      useStore.getState().setUi({ status: 'Ungültige Shader-Datei' });
      return false;
    }
    const { setSetting } = useStore.getState();
    setSetting('shaderCode', bundle.code);
    setSetting('shaderPreset', bundle.preset && bundle.preset !== 'custom' ? bundle.preset : 'custom');
    setSetting('shaderBlend', typeof bundle.blend === 'number' ? bundle.blend : 0.65);
    useStore.getState().setUi({ status: `Shader „${bundle.name}“ importiert` });
    return true;
  } catch (e) {
    console.error('Shader-Import fehlgeschlagen:', e);
    useStore.getState().setUi({ status: 'Shader-Import fehlgeschlagen' });
    return false;
  }
}
