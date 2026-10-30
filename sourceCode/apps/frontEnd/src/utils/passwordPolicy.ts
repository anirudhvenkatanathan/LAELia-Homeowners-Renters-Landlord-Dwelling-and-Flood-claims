// Mirrors validatePasswordPolicy() in apps/api/graphQL/loginEntity.ts —
// keep both in sync if the policy ever changes.
export function validatePasswordPolicy(password: string): string | null {
  if (password.length < 6) return 'Password must be at least 6 characters.';
  if (!/\d/.test(password)) return 'Password must contain at least one number.';
  if (!/[!@#$%^&*()\-_=+[\]{};':"\\|,.<>/?`~]/.test(password)) return 'Password must contain at least one special character.';
  return null;
}
