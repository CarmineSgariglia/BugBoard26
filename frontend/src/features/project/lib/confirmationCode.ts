export function generateConfirmationCode(length: number): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10).toString();
  }
  return result;
}
