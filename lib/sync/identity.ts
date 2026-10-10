export function isAccountOwner(owner: unknown): owner is string {
  return typeof owner === 'string' && /^neon:[^\s:]{1,255}$/.test(owner);
}
export function accountOwner(userId: unknown): string | undefined {
  return typeof userId === 'string' && /^[^\s:]{1,255}$/.test(userId)
    ? `neon:${userId}`
    : undefined;
}

// The expected owner is an account-switch guard, never an authorization source.
// Authorization always comes from the server-verified session.
export function syncIdentityMatches(sessionOwner: unknown, expectedOwner: string) {
  return isAccountOwner(sessionOwner) && sessionOwner === expectedOwner;
}
