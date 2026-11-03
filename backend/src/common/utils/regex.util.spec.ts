import { escapeRegex, createSafeRegex } from './regex.util';

describe('RegexUtil', () => {
  describe('escapeRegex', () => {
    it('should return empty string for null, undefined, or empty input', () => {
      expect(escapeRegex(null)).toBe('');
      expect(escapeRegex(undefined)).toBe('');
      expect(escapeRegex('')).toBe('');
    });

    it('should escape all special regex characters', () => {
      const malicious = '.*+?^${}()|[]\\/';
      const escaped = escapeRegex(malicious);
      expect(escaped).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\\\/');
      expect(() => new RegExp(escaped)).not.toThrow();
    });

    it('should preserve alphanumeric characters and spaces', () => {
      const normal = 'Áo dài cưới truyền thống 2026';
      expect(escapeRegex(normal)).toBe(normal);
    });
  });

  describe('createSafeRegex', () => {
    it('should return null for invalid, empty, or whitespace inputs', () => {
      expect(createSafeRegex(null)).toBeNull();
      expect(createSafeRegex(undefined)).toBeNull();
      expect(createSafeRegex('')).toBeNull();
      expect(createSafeRegex('   ')).toBeNull();
    });

    it('should safely compile malformed regex inputs without throwing SyntaxError', () => {
      const payloads = ['(', '[', '{', '\\', '(?=.*)', '(((((', '*+?'];
      for (const payload of payloads) {
        expect(() => {
          const regex = createSafeRegex(payload);
          expect(regex).toBeInstanceOf(RegExp);
          expect(regex?.test(payload)).toBe(true);
        }).not.toThrow();
      }
    });

    it('should truncate input exceeding maxLength to prevent ReDoS', () => {
      const longString = 'a'.repeat(200);
      const regex = createSafeRegex(longString, 'i', 50);
      expect(regex).not.toBeNull();
      expect(regex?.source.length).toBe(50);
    });
  });
});
