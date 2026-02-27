/**
 * Validates if the provided string is a syntactically correct email address.
 * It checks that the email is at least 8 characters long and matches a standard 
 * email pattern (containing @ and a domain with a dot).
 */
export function isValidEmail(email: string): boolean {
    if (!email || email.length < 8) return false;

    // Standard email regex structure
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validates if the provided string is a valid name.
 * It checks that the name is at least 3 characters long and matches a standard 
 * name pattern (containing only letters).
 */
export function isValidName(name: string): boolean {
    if (!name || name.length < 3) return false;

    // Standard name regex structure
    const nameRegex = /^[a-zA-Z]+$/;
    return nameRegex.test(name);
}

/**
 * Validates if the provided string is a valid code.
 * It checks that the code is exactly 6 digits long.
 */
export function isValidCode(code: string): boolean {
    if (!code || code.length !== 6) return false;

    // Standard code regex structure
    const codeRegex = /^\d{6}$/;
    return codeRegex.test(code);
}

/**
 * Validates if the provided string is a strong password.
 * It checks that the password is at least 8 characters long,
 * contains at least one number, and at least one special character.
 */
export function isValidPassword(password: string): boolean {
    if (!password || password.length < 8) return false;

    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    return hasNumber && hasSpecialChar;
}
