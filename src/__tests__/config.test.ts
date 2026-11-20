import { normalizeServerUrl, socketUrlFor } from '../net/config';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
}));

describe('server address', () => {
  it('accepts what people actually type', () => {
    expect(normalizeServerUrl('192.168.1.20:8787')).toBe('http://192.168.1.20:8787');
    expect(normalizeServerUrl('  http://192.168.1.20:8787/  ')).toBe('http://192.168.1.20:8787');
    expect(normalizeServerUrl('https://RPS.example.com')).toBe('https://rps.example.com');
    expect(normalizeServerUrl('my-pc.local:8787')).toBe('http://my-pc.local:8787');
    expect(normalizeServerUrl('http://[fe80::1]:8787')).toBe('http://[fe80::1]:8787');
  });

  it('rejects things that cannot be a server address', () => {
    for (const input of ['', '   ', 'ftp://host', 'http://', 'http://host/some/path', 'two words', 'http://host:port']) {
      expect(normalizeServerUrl(input)).toBeNull();
    }
  });

  it('derives the WebSocket address, keeping it secure when the server is', () => {
    expect(socketUrlFor('http://192.168.1.20:8787')).toBe('ws://192.168.1.20:8787/ws');
    expect(socketUrlFor('https://rps.example.com')).toBe('wss://rps.example.com/ws');
  });
});
