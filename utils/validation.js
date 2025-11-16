import crypto from 'crypto';

export const checkPasswordStrength = (password) => {
    const errors = [];
    const strength = { score: 0, feedback: [] };

    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    } else {
        strength.score += 1;
    }

    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    } else {
        strength.score += 1;
    }

    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    } else {
        strength.score += 1;
    }

    if (!/\d/.test(password)) {
        errors.push('Password must contain at least one number');
    } else {
        strength.score += 1;
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('Password must contain at least one special character');
    } else {
        strength.score += 1;
    }

    if (strength.score < 3) {
        strength.level = 'weak';
        strength.feedback.push('Consider using a stronger password');
    } else if (strength.score < 5) {
        strength.level = 'medium';
        strength.feedback.push('Good password, but could be stronger');
    } else {
        strength.level = 'strong';
        strength.feedback.push('Strong password!');
    }

    return { isValid: errors.length === 0, errors, strength };
};

export const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { isValid: false, error: 'Please enter a valid email address' };
    }
    return { isValid: true };
};

export const validateName = (name) => {
    if (!name || name.trim().length === 0) {
        return { isValid: false, error: 'Name is required' };
    }

    if (name.length < 2) {
        return { isValid: false, error: 'Name must be at least 2 characters long' };
    }

    if (name.length > 50) {
        return { isValid: false, error: 'Name must be less than 50 characters long' };
    }

    if (!/^[a-zA-Z\s\-']+$/.test(name)) {
        return { isValid: false, error: 'Name can only contain letters, spaces, hyphens, and apostrophes' };
    }

    return { isValid: true, sanitizedName: name.trim() };
};

export const validatePasswordConfirmation = (password, confirmPassword) => {
    if (password !== confirmPassword) {
        return { isValid: false, error: 'Passwords do not match' };
    }
    return { isValid: true };
};

export const generateResetToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

export const hashResetToken = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

export const getClientIP = (req) => {
    return req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
};
