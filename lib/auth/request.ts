export function isSameOrigin(request: Request) {
  try {
    const url = new URL(request.url);
    // Next's internal URL can use the listening host in local development.
    // The HTTP Host is the public origin; browsers cannot override it.
    const host = request.headers.get('host');
    if (host) url.host = host;
    return request.headers.get('origin') === url.origin;
  } catch {
    return false;
  }
}
