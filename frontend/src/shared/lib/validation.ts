/**
 * Validates if the provided string is a syntactically correct email address.
 * It checks that the email is at least 8 characters long and matches a standard 
 * email pattern (containing @ and a domain with a dot).
 */
export function isValidEmail(email: string): boolean {
    const value = email?.trim();
    if (!value || value.length < 8) return false;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
}

/**
 * Validates if the provided string is a valid name.
 * It checks that the name is at least 3 characters long and matches a standard 
 * name pattern (containing only letters).
 */
export function isValidName(name: string): boolean {
    const value = name?.trim();
    if (!value || value.length < 3) return false;

    const nameRegex = /^[\p{L}\s]+$/u;
    return nameRegex.test(value);
}

/**
 * Validates if the provided string is a valid code.
 * It checks that the code is exactly 6 digits long.
 */
export function isValidCode(code: string): boolean {
    return /^\d{6}$/.test(code);
}

/**
 * Validates if the provided string is a strong password.
 * It checks that the password is at least 8 characters long,
 * contains at least one number, and at least one special character.
 */
export function isValidPassword(password: string): boolean {
    const value = password?.trim();
    if (!value || value.length < 8) return false;

    const hasNumber = /\d/.test(value);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value);

    return hasNumber && hasSpecialChar;
}
