/**
 Generates a random numeric string of the specified length.
 It is used to generate random codes for password recovery.
 */
export function generateRandomNumber(length: number): string {
    let result = "";
    for (let i = 0; i < length; i++) {
        result += Math.floor(Math.random() * 10).toString();
    }
    return result;
}
