export function generateRandomEmail() {
  const random = Math.floor(Math.random() * 10000);
  return `testuser${random}@mailinator.com`;
}
