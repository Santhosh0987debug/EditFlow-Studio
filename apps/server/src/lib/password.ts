import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/**
 * Used when an email does not exist so login timing does not reveal whether
 * an account is registered.
 */
export const DUMMY_PASSWORD_HASH =
  "$2b$12$XgBuNBsd8wyA6CAC5HY.euZoGt4ZrDFFT69OHa2dFhK1NM0b/BUoW";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
