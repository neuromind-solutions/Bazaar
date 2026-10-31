import '@testing-library/jest-dom';

// Ensure in-memory localStorage for JSDOM if needed
const storageBackend = new Map<string, string>();
if (typeof globalThis.localStorage === 'undefined' || !globalThis.localStorage.clear) {
  (globalThis as any).localStorage = {
    getItem: (key: string) => storageBackend.get(key) || null,
    setItem: (key: string, val: string) => storageBackend.set(key, val),
    removeItem: (key: string) => storageBackend.delete(key),
    clear: () => storageBackend.clear(),
    key: (i: number) => Array.from(storageBackend.keys())[i] || null,
    get length() { return storageBackend.size; },
  };
}

// Polyfill window.matchMedia
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// Polyfill ResizeObserver
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
}

// Polyfill AudioContext for sound effects
if (typeof window !== 'undefined') {
  (window as any).AudioContext = class {
    createOscillator() {
      return {
        connect: () => {},
        start: () => {},
        stop: () => {},
        frequency: { setValueAtTime: () => {} },
      };
    }
    createGain() {
      return {
        connect: () => {},
        gain: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {} },
      };
    }
    get destination() { return {}; }
    get currentTime() { return 0; }
  };
}
