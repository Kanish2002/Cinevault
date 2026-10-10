export function isGoogleOwner(owner: unknown): owner is string {
  return typeof owner === 'string' && /^google:[^\s:]{1,255}$/.test(owner);
}

// The expected owner is an account-switch guard, never an authorization source.
// Authorization always comes from the server-verified session.
export function syncIdentityMatches(sessionOwner: unknown, expectedOwner: string) {
  return isGoogleOwner(sessionOwner) && sessionOwner === expectedOwner;
}
