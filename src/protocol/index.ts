/**
 * Gateway Protocol System
 *
 * WebSocket-based control plane protocol.
 */

export { Gateway } from './gateway.js';
export type { GatewayConfig } from './gateway.js';

export {
  Frame,
  RequestFrame,
  ResponseFrame,
  EventFrame,
  FrameError,
  GatewayMethod,
  GatewayEvent,
  createRequestFrame,
  createResponseFrame,
  createEventFrame,
  createErrorFrame,
  createSuccessFrame,
  validateFrame,
} from './frames.js';

export { encode, decode, encodeNDJSON, decodeNDJSON, createMessageReader } from './codec.js';
export {
  PROTOCOL_VERSION,
  MIN_PROTOCOL_VERSION,
  MAX_PROTOCOL_VERSION,
  negotiate,
  compareVersions,
  isVersionSupported,
  getProtocolVersionInfo,
} from './negotiation.js';
export type { ProtocolVersionInfo, NegotiationResult, ClientVersionInfo } from './negotiation.js';
