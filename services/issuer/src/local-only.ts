const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const DEFAULT_ISSUER_HOST = '127.0.0.1';
const DEFAULT_CORS_ORIGINS = ['http://127.0.0.1:3000', 'http://localhost:3000'] as const;

function normalizeHost(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

function extractHostname(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).hostname;
  } catch {
    return value.split(':')[0] ?? null;
  }
}

function isLoopbackAddress(value: string) {
  const normalized = normalizeHost(value);
  return (
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === '::ffff:127.0.0.1' ||
    normalized === 'localhost'
  );
}

function hasOnlyLoopbackAddresses(value: string | null) {
  if (!value) {
    return true;
  }

  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .every(isLoopbackAddress);
}

export function isLoopbackHost(hostname: string | null | undefined) {
  return LOOPBACK_HOSTS.has(normalizeHost(hostname));
}

export function resolveIssuerBindHost(env: NodeJS.ProcessEnv = process.env) {
  const configuredHost = normalizeHost(env.ISSUER_HOST) || DEFAULT_ISSUER_HOST;

  if (!isLoopbackHost(configuredHost) && env.ISSUER_ALLOW_NON_LOCAL_BIND !== '1') {
    throw new Error(
      `Refusing to bind issuer to non-loopback host "${configuredHost}" without ISSUER_ALLOW_NON_LOCAL_BIND=1.`,
    );
  }

  return configuredHost;
}

export function getIssuerCorsOrigins(env: NodeJS.ProcessEnv = process.env) {
  const configured = env.ISSUER_CORS_ORIGINS;
  if (!configured || configured.trim().length === 0) {
    return [...DEFAULT_CORS_ORIGINS];
  }

  return configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function getLocalOnlyWriteRequestRejection(request: Request): string | null {
  const urlHost = extractHostname(request.url);
  const hostHeader = extractHostname(request.headers.get('host'));
  const originHost = extractHostname(request.headers.get('origin'));
  const forwardedHost = extractHostname(request.headers.get('x-forwarded-host'));
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');

  const hosts = [urlHost, hostHeader, originHost, forwardedHost].filter(
    (value): value is string => Boolean(value),
  );

  if (hosts.some((hostname) => !isLoopbackHost(hostname))) {
    return 'Issuer write routes are demo-only and require a loopback host/origin.';
  }

  if (!hasOnlyLoopbackAddresses(forwardedFor) || !hasOnlyLoopbackAddresses(realIp)) {
    return 'Issuer write routes are demo-only and reject non-loopback client addresses.';
  }

  return null;
}
