// Patikrina, kad Jest, TypeScript ir „@/“ kelio trumpinys veikia kartu.
import { APP_NAME } from '@/appInfo';

describe('testų aplinka', () => {
  it('paleidžia TypeScript testą ir randa modulį per @/ trumpinį', () => {
    expect(APP_NAME).toBe('AutoRent');
  });
});