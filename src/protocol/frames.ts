/**
 * Gateway Protocol Frames
 *
 * Frame types for the gateway control plane protocol.
 */

export type ProtocolVersion = '1.0';

export type FrameType = 'request' | 'response' | 'event';

/**
 * Base frame
 */
export interface BaseFrame {
  version: ProtocolVersion;
  type: FrameType;
  id: string;
  timestamp: number;
}

/**
 * Request frame
 */
export interface RequestFrame extends BaseFrame {
  type: 'request';
  method: string;
  requestId: string;
  payload?: unknown;
}

/**
 * Response frame
 */
export interface ResponseFrame extends BaseFrame {
  type: 'response';
  requestId: string;
  status: number;
  result?: unknown;
  error?: FrameError;
}

/**
 * Event frame
 */
export interface EventFrame extends BaseFrame {
  type: 'event';
  event: string;
  payload?: unknown;
  seq?: number;
}

/**
 * Frame error
 */
export interface FrameError {
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
  retryAfterMs?: number;
}

/**
 * Union frame type
 */
export type Frame = RequestFrame | ResponseFrame | EventFrame;

/**
 * Standard method names
 */
export type GatewayMethod =
  | 'connect'
  | 'disconnect'
  | 'ping'
  | 'pong'
  | 'session.create'
  | 'session.get'
  | 'session.list'
  | 'session.delete'
  | 'session.patch'
  | 'session.reset'
  | 'config.get'
  | 'config.set'
  | 'config.patch'
  | 'channel.list'
  | 'channel.status'
  | 'channel.send'
  | 'agent.invoke'
  | 'agent.wait'
  | 'nodes.list'
  | 'nodes.pair'
  | 'cron.add'
  | 'cron.list'
  | 'cron.remove'
  | 'secrets.resolve'
  | 'skills.list'
  | 'tools.list'
  | 'exec.run';

/**
 * Event names
 */
export type GatewayEvent =
  | 'connect.challenge'
  | 'connect.hello'
  | 'connect.error'
  | 'session.start'
  | 'session.end'
  | 'session.message'
  | 'channel.event'
  | 'agent.event'
  | 'node.pair.request'
  | 'node.pair.approve'
  | 'node.pair.reject'
  | 'error';

/**
 * Create a request frame
 */
export function createRequestFrame(
  method: string,
  payload?: unknown,
  requestId?: string
): RequestFrame {
  return {
    version: '1.0',
    type: 'request',
    id: requestId || generateId(),
    timestamp: Date.now(),
    method,
    requestId: requestId || generateId(),
    payload,
  };
}

/**
 * Create a response frame
 */
export function createResponseFrame(
  requestId: string,
  status: number,
  result?: unknown,
  error?: FrameError
): ResponseFrame {
  return {
    version: '1.0',
    type: 'response',
    id: generateId(),
    timestamp: Date.now(),
    requestId,
    status,
    result,
    error,
  };
}

/**
 * Create an event frame
 */
export function createEventFrame(
  event: string,
  payload?: unknown,
  seq?: number
): EventFrame {
  return {
    version: '1.0',
    type: 'event',
    id: generateId(),
    timestamp: Date.now(),
    event,
    payload,
    seq,
  };
}

/**
 * Create error response
 */
export function createErrorFrame(
  requestId: string,
  code: string,
  message: string,
  details?: unknown
): ResponseFrame {
  return createResponseFrame(requestId, 500, undefined, {
    code,
    message,
    details,
  });
}

/**
 * Create success response
 */
export function createSuccessFrame(
  requestId: string,
  result?: unknown
): ResponseFrame {
  return createResponseFrame(requestId, 200, result);
}

/**
 * Validate a frame
 */
export function validateFrame(frame: unknown): frame is Frame {
  if (!frame || typeof frame !== 'object') return false;

  const f = frame as Record<string, unknown>;

  if (f.version !== '1.0') return false;
  if (!['request', 'response', 'event'].includes(f.type as string)) return false;
  if (typeof f.id !== 'string') return false;
  if (typeof f.timestamp !== 'number') return false;

  return true;
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
