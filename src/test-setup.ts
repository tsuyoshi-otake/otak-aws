import { vi } from 'vitest';

// window.locationのモック
Object.defineProperty(window, 'location', {
  value: {
    origin: 'https://example.com',
    pathname: '/otak-aws',
    search: '',
    href: 'https://example.com/otak-aws'
  },
  writable: true
});

// navigator.clipboardのモック
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue('')
  },
  writable: true
});

// atoaとbtoaのグローバル関数を確保
global.atob = atob;
global.btoa = btoa;