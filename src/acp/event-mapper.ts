/**
 * ACP Event Mapper
 *
 * Maps between ACP events and Gateway protocol events.
 */

import type { Frame, EventFrame } from '../protocol/frames.js';
import { createEventFrame } from '../protocol/frames.js';

/**
 * ACP event types
 */
export type ACPEventType =
  | 'text_delta'
  | 'status'
  | 'tool_call'
  | 'tool_result'
  | 'done'
  | 'error'
  | 'waiting';

/**
 * ACP event
 */
export interface ACPEvent {
  type: ACPEventType;
  text?: string;
  stream?: 'output' | 'thought';
  tag?: string;
  toolCallId?: string;
  toolName?: string;
  status?: string;
  title?: string;
  stopReason?: string;
  message?: string;
  code?: string;
  retryable?: boolean;
  used?: number;
  size?: number;
}

/**
 * ACP to Gateway event mapping
 */
export function mapACPToGateway(acpEvent: ACPEvent, sessionId: string): EventFrame {
  switch (acpEvent.type) {
    case 'text_delta':
      return createEventFrame('agent.text_delta', {
        sessionId,
        text: acpEvent.text,
        stream: acpEvent.stream,
        tag: acpEvent.tag,
      });

    case 'status':
      return createEventFrame('agent.status', {
        sessionId,
        text: acpEvent.text,
        tag: acpEvent.tag,
        used: acpEvent.used,
        size: acpEvent.size,
      });

    case 'tool_call':
      return createEventFrame('agent.tool_call', {
        sessionId,
        toolCallId: acpEvent.toolCallId,
        toolName: acpEvent.toolName,
        title: acpEvent.title,
        text: acpEvent.text,
      });

    case 'done':
      return createEventFrame('agent.done', {
        sessionId,
        stopReason: acpEvent.stopReason,
      });

    case 'error':
      return createEventFrame('error', {
        sessionId,
        message: acpEvent.message,
        code: acpEvent.code,
        retryable: acpEvent.retryable,
      });

    case 'waiting':
      return createEventFrame('agent.waiting', {
        sessionId,
        text: acpEvent.text,
      });

    default:
      return createEventFrame('agent.event', {
        sessionId,
        event: acpEvent,
      });
  }
}

/**
 * Gateway to ACP event mapping
 */
export function mapGatewayToACP(frame: Frame): ACPEvent | null {
  if (frame.type !== 'event') return null;

  const payload = (frame as EventFrame).payload as Record<string, unknown>;

  switch ((frame as EventFrame).event) {
    case 'session.start':
      return {
        type: 'status',
        text: 'Session started',
        tag: 'session',
      };

    case 'session.end':
      return {
        type: 'done',
        stopReason: 'session_end',
      };

    case 'agent.text_delta':
      return {
        type: 'text_delta',
        text: payload.text as string,
        stream: payload.stream as 'output' | 'thought' | undefined,
        tag: payload.tag as string | undefined,
      };

    case 'agent.status':
      return {
        type: 'status',
        text: payload.text as string,
        tag: payload.tag as string | undefined,
      };

    case 'agent.done':
      return {
        type: 'done',
        stopReason: payload.stopReason as string | undefined,
      };

    case 'error':
      return {
        type: 'error',
        message: payload.message as string,
        code: payload.code as string | undefined,
        retryable: payload.retryable as boolean | undefined,
      };

    default:
      return {
        type: 'status',
        text: `Event: ${(frame as EventFrame).event}`,
      };
  }
}

/**
 * Create ACP event
 */
export function createACPEvent(
  type: ACPEventType,
  data?: Partial<ACPEvent>
): ACPEvent {
  return {
    type,
    ...data,
  } as ACPEvent;
}
