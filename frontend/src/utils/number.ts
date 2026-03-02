/**
 * Generates a random numeric string of the specified length.
 * @param length The length of the numeric string to generate.
 * @returns A string of random digits.
 */
export function generateRandomNumber(length: number): string {
    let result = "";
    for (let i = 0; i < length; i++) {
        result += Math.floor(Math.random() * 10).toString();
    }
    return result;
}
