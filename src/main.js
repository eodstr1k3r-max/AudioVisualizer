import { initUi } from './ui/uiManager.js';
import { renderVisualizer } from './visuals/visualizer.js';

window.addEventListener('DOMContentLoaded', () => {
  initUi();
  requestAnimationFrame(renderVisualizer);
});
