import { describe, it, expect } from 'vitest';
import { validateName } from '../../src/utils/validation.js';
import { LoadoutError } from '../../src/utils/errors.js';

describe('validateName', () => {
  it('accepts simple alphanumeric names', () => {
    expect(() => {
      validateName('hello', 'skill');
    }).not.toThrow();
    expect(() => {
      validateName('skill123', 'skill');
    }).not.toThrow();
    expect(() => {
      validateName('vue-helper', 'preset');
    }).not.toThrow();
    expect(() => {
      validateName('my_preset.v2', 'preset');
    }).not.toThrow();
  });

  it('rejects names starting with non-alphanumeric', () => {
    expect(() => {
      validateName('-bad', 'skill');
    }).toThrow(LoadoutError);
    expect(() => {
      validateName('.hidden', 'skill');
    }).toThrow(LoadoutError);
    expect(() => {
      validateName('_private', 'skill');
    }).toThrow(LoadoutError);
  });

  it('rejects names with invalid characters', () => {
    expect(() => {
      validateName('bad/name', 'skill');
    }).toThrow(LoadoutError);
    expect(() => {
      validateName('bad name', 'skill');
    }).toThrow(LoadoutError);
    expect(() => {
      validateName('../../../etc/passwd', 'skill');
    }).toThrow(LoadoutError);
  });

  it('rejects names exceeding 128 characters', () => {
    const long = 'a'.repeat(129);
    expect(() => {
      validateName(long, 'skill');
    }).toThrow(LoadoutError);
  });

  it('accepts names exactly at 128 characters', () => {
    const max = 'a'.repeat(128);
    expect(() => {
      validateName(max, 'skill');
    }).not.toThrow();
  });
});
