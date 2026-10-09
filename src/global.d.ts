declare global {
  interface HTMLAudioElement {
    captureStream?(options?: { frameRequestRate?: number }): MediaStream;
  }
}

export {};
