import {
  checkPasswordStrength,
  validateEmail,
  validateName,
  validatePasswordConfirmation,
  generateResetToken,
  hashResetToken,
  getClientIP,
} from '../../utils/validation.js';

describe('Validation Functions', () => {
  describe('checkPasswordStrength', () => {
    test('should return invalid for password less than 8 characters', () => {
      const result = checkPasswordStrength('short');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    test('should return valid for strong password', () => {
      const result = checkPasswordStrength('StrongPass123!');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.strength.level).toBe('strong');
    });

    test('should detect missing lowercase letter', () => {
      const result = checkPasswordStrength('STRONGPASS123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    test('should detect missing uppercase letter', () => {
      const result = checkPasswordStrength('strongpass123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    test('should detect missing number', () => {
      const result = checkPasswordStrength('StrongPass!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    test('should detect missing special character', () => {
      const result = checkPasswordStrength('StrongPass123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });
  });

  describe('validateEmail', () => {
    test('should return valid for correct email', () => {
      const result = validateEmail('test@example.com');
      expect(result.isValid).toBe(true);
    });

    test('should return invalid for incorrect email', () => {
      const result = validateEmail('invalid-email');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please enter a valid email address');
    });
  });

  describe('validateName', () => {
    test('should return valid for correct name', () => {
      const result = validateName('John Doe');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedName).toBe('John Doe');
    });

    test('should return invalid for empty name', () => {
      const result = validateName('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Name is required');
    });

    test('should return invalid for name too short', () => {
      const result = validateName('A');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Name must be at least 2 characters long');
    });

    test('should return invalid for name with invalid characters', () => {
      const result = validateName('John123');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Name can only contain letters, spaces, hyphens, and apostrophes');
    });
  });

  describe('validatePasswordConfirmation', () => {
    test('should return valid when passwords match', () => {
      const result = validatePasswordConfirmation('password123', 'password123');
      expect(result.isValid).toBe(true);
    });

    test('should return invalid when passwords do not match', () => {
      const result = validatePasswordConfirmation('password123', 'different123');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Passwords do not match');
    });
  });

  describe('generateResetToken', () => {
    test('should generate a string token', () => {
      const token = generateResetToken();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes * 2 hex chars per byte
    });
  });

  describe('hashResetToken', () => {
    test('should hash the token', () => {
      const token = 'testtoken';
      const hashed = hashResetToken(token);
      expect(typeof hashed).toBe('string');
      expect(hashed.length).toBe(64); // SHA256 produces 64 hex characters
      expect(hashed).not.toBe(token);
    });
  });

  describe('getClientIP', () => {
    test('should return IP from req.ip', () => {
      const req = { ip: '192.168.1.1' };
      const ip = getClientIP(req);
      expect(ip).toBe('192.168.1.1');
    });

    test('should fallback to connection.remoteAddress', () => {
      const req = { connection: { remoteAddress: '192.168.1.2' } };
      const ip = getClientIP(req);
      expect(ip).toBe('192.168.1.2');
    });

    test('should return unknown if no IP found', () => {
      const req = {};
      const ip = getClientIP(req);
      expect(ip).toBe('unknown');
    });
  });
});
