import { resolveApiUrl } from './env';

describe('resolveApiUrl', () => {
  it('kūrimo režime be reikšmės grąžina emuliatoriaus adresą', () => {
    expect(resolveApiUrl(undefined, false)).toBe(
      'http://10.0.2.2:8000',
    );
  });

  it('nuima tarpus ir pasvirus brūkšnius gale', () => {
    expect(
      resolveApiUrl('  http://192.168.1.10:8000// ', false),
    ).toBe('http://192.168.1.10:8000');
  });

  it('production režime atmeta http adresą', () => {
    expect(() =>
      resolveApiUrl('http://api.autorent.lt', true),
    ).toThrow('https://');
  });

  it('production režime priima https adresą', () => {
    expect(
      resolveApiUrl('https://api.autorent.lt/', true),
    ).toBe('https://api.autorent.lt');
  });

  it('production režime reikalauja nurodyto adreso', () => {
    expect(() => resolveApiUrl('', true)).toThrow(
      'EXPO_PUBLIC_API_URL',
    );
  });

  it('atmeta adresą be protokolo', () => {
    expect(() =>
      resolveApiUrl('api.autorent.lt', false),
    ).toThrow('http://');
  });
});