import { checkImage } from './product-form.component';

const file = (name: string, type: string, size = 1024) => new File([new Uint8Array(size)], name, { type });

describe('checkImage (client-side upload guard, UX only)', () => {
  it('accepts JPG, PNG and WebP under 5 MB', () => {
    expect(checkImage(file('a.jpg', 'image/jpeg'))).toBeNull();
    expect(checkImage(file('a.PNG', 'image/png'))).toBeNull();
    expect(checkImage(file('a.webp', 'image/webp'))).toBeNull();
  });

  it('rejects other types or mismatched extensions', () => {
    expect(checkImage(file('a.svg', 'image/svg+xml'))).toMatch(/JPG, PNG or WebP/);
    expect(checkImage(file('a.jpg.exe', 'image/jpeg'))).toMatch(/JPG, PNG or WebP/);
    expect(checkImage(file('a.gif', 'image/gif'))).toMatch(/JPG, PNG or WebP/);
  });

  it('rejects files over 5 MB', () => {
    expect(checkImage(file('big.jpg', 'image/jpeg', 5 * 1024 * 1024 + 1))).toMatch(/5 MB/);
  });
});
