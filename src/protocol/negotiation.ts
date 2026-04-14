/**
 * Protocol Version Negotiation
 *
 * Handles protocol version negotiation between client and server.
 */

export const PROTOCOL_VERSION = '1.0';
export const MIN_PROTOCOL_VERSION = '1.0';
export const MAX_PROTOCOL_VERSION = '1.0';

/**
 * Protocol version info
 */
export interface ProtocolVersionInfo {
  version: string;
  minVersion: string;
  maxVersion: string;
}

/**
 * Negotiation result
 */
export interface NegotiationResult {
  success: boolean;
  version?: string;
  error?: string;
}

/**
 * Client version info sent during connect
 */
export interface ClientVersionInfo {
  id: string;
  version: string;
  platform: string;
  displayName?: string;
}

/**
 * Negotiate protocol version
 */
export function negotiate(
  clientMin: string,
  clientMax: string,
  serverMin: string = MIN_PROTOCOL_VERSION,
  serverMax: string = MAX_PROTOCOL_VERSION
): NegotiationResult {
  // Simple version matching - must be exact match for now
  const clientMinParts = clientMin.split('.').map(Number);
  const clientMaxParts = clientMax.split('.').map(Number);
  const serverMinParts = serverMin.split('.').map(Number);
  const serverMaxParts = serverMax.split('.').map(Number);

  // Check if versions are compatible
  // For now, just check if client max >= server min and client min <= server max
  if (compareVersions(clientMax, serverMin) >= 0 && compareVersions(clientMin, serverMax) <= 0) {
    // Return server's version as the negotiated version
    return { success: true, version: PROTOCOL_VERSION };
  }

  return {
    success: false,
    error: `Version mismatch: client supports ${clientMin}-${clientMax}, server supports ${serverMin}-${serverMax}`,
  };
}

/**
 * Compare two version strings
 */
export function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || 0;
    const bPart = bParts[i] || 0;

    if (aPart > bPart) return 1;
    if (aPart < bPart) return -1;
  }

  return 0;
}

/**
 * Check if version is supported
 */
export function isVersionSupported(version: string): boolean {
  return compareVersions(version, MIN_PROTOCOL_VERSION) >= 0 &&
         compareVersions(version, MAX_PROTOCOL_VERSION) <= 0;
}

/**
 * Get protocol version info
 */
export function getProtocolVersionInfo(): ProtocolVersionInfo {
  return {
    version: PROTOCOL_VERSION,
    minVersion: MIN_PROTOCOL_VERSION,
    maxVersion: MAX_PROTOCOL_VERSION,
  };
}
