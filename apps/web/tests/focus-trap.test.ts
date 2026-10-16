import { describe, it, expect } from 'vitest';
import { trapTarget } from '@/lib/focus-trap';

const ring = ['menu', 'a', 'b', 'c'];
describe('trapTarget', () => {
  it('wraps forward from the last item to the first', () => expect(trapTarget(ring, 'c', false)).toBe('menu'));
  it('wraps backward from the first item to the last', () => expect(trapTarget(ring, 'menu', true)).toBe('c'));
  it('leaves normal movement to the browser', () => {
    expect(trapTarget(ring, 'a', false)).toBeNull();
    expect(trapTarget(ring, 'b', true)).toBeNull();
  });
  it('pulls focus in from outside the ring', () => {
    expect(trapTarget(ring, null, false)).toBe('menu');
    expect(trapTarget(ring, 'zzz', true)).toBe('c');
  });
  it('is inert for an empty ring', () => expect(trapTarget([], null, false)).toBeNull());
});
