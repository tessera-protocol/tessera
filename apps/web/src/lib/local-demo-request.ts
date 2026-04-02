const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isLoopbackHost(hostname: string | null | undefined) {
  if (!hostname) {
    return false;
  }

  return LOOPBACK_HOSTS.has(hostname.toLowerCase());
}

function extractHostname(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).hostname;
  } catch {
    return value.split(":")[0] ?? null;
  }
}

function isLoopbackAddress(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "::ffff:127.0.0.1" ||
    normalized === "localhost"
  );
}

function hasOnlyLoopbackAddresses(value: string | null) {
  if (!value) {
    return true;
  }

  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .every(isLoopbackAddress);
}

export function getLocalDemoRequestRejection(request: Request): string | null {
  const urlHost = extractHostname(request.url);
  const hostHeader = extractHostname(request.headers.get("host"));
  const originHost = extractHostname(request.headers.get("origin"));
  const forwardedHost = extractHostname(request.headers.get("x-forwarded-host"));
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  const hosts = [urlHost, hostHeader, originHost, forwardedHost].filter(
    (value): value is string => Boolean(value),
  );

  if (hosts.some((hostname) => !isLoopbackHost(hostname))) {
    return "Guard mutations are demo-only and require a loopback host/origin.";
  }

  if (!hasOnlyLoopbackAddresses(forwardedFor) || !hasOnlyLoopbackAddresses(realIp)) {
    return "Guard mutations are demo-only and reject non-loopback client addresses.";
  }

  return null;
}
