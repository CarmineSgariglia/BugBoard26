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
