import { FormControl, FormGroup } from '@angular/forms';
import { httpsUrl, matchFields, notBlank, passwordStrength, safeReturnUrl } from './validators';

describe('form validators', () => {
  it('passwordStrength mirrors the backend rule', () => {
    expect(passwordStrength(new FormControl('password'))).not.toBeNull();
    expect(passwordStrength(new FormControl('Password1'))).toBeNull();
    expect(passwordStrength(new FormControl(''))).toBeNull();
  });

  it('matchFields flags the repeat control only', () => {
    const group = new FormGroup(
      { password: new FormControl('Password1'), repeat: new FormControl('Password2') },
      { validators: matchFields('password', 'repeat', 'Passwords do not match.') },
    );
    expect(group.controls.repeat.errors).toEqual({ mismatch: 'Passwords do not match.' });
    group.controls.repeat.setValue('Password1');
    expect(group.controls.repeat.errors).toBeNull();
  });

  it('notBlank rejects whitespace-only input', () => {
    expect(notBlank(new FormControl('   '))).toEqual({ required: true });
    expect(notBlank(new FormControl(' a '))).toBeNull();
  });

  it('httpsUrl accepts empty or https URLs only', () => {
    expect(httpsUrl(new FormControl(''))).toBeNull();
    expect(httpsUrl(new FormControl('https://track.example/1'))).toBeNull();
    expect(httpsUrl(new FormControl('http://track.example/1'))).not.toBeNull();
    expect(httpsUrl(new FormControl('javascript:alert(1)'))).not.toBeNull();
  });

  it('safeReturnUrl only allows in-app paths', () => {
    expect(safeReturnUrl('/account/orders')).toBe('/account/orders');
    expect(safeReturnUrl('//evil.example')).toBe('/');
    expect(safeReturnUrl('/\\evil.example')).toBe('/');
    expect(safeReturnUrl('https://evil.example')).toBe('/');
    expect(safeReturnUrl(undefined, '/products')).toBe('/products');
  });
});
