/**
 * Gateway Codec
 *
 * JSON encoding/decoding for frames.
 */

import type { Frame, RequestFrame, ResponseFrame, EventFrame } from './frames.js';
import { validateFrame } from './frames.js';

/**
 * Encode a frame to JSON string
 */
export function encode(frame: Frame): string {
  return JSON.stringify(frame);
}

/**
 * Decode a JSON string to frame
 */
export function decode(data: string): Frame | null {
  try {
    const parsed = JSON.parse(data);

    if (!validateFrame(parsed)) {
      console.warn('[GatewayCodec] Invalid frame structure:', parsed);
      return null;
    }

    return parsed;
  } catch (error) {
    console.error('[GatewayCodec] Failed to decode frame:', error);
    return null;
  }
}

/**
 * Encode multiple frames as NDJSON (newline-delimited JSON)
 */
export function encodeNDJSON(frames: Frame[]): string {
  return frames.map(encode).join('\n');
}

/**
 * Decode NDJSON string to frames
 */
export function decodeNDJSON(data: string): Frame[] {
  const lines = data.split('\n').filter(Boolean);
  const frames: Frame[] = [];

  for (const line of lines) {
    const frame = decode(line);
    if (frame) {
      frames.push(frame);
    }
  }

  return frames;
}

/**
 * Read a single frame from a chunk of data
 */
export function readFrame(buffer: string, expectedType?: Frame['type']): {
  frame: Frame | null;
  consumed: number;
} {
  // Try to parse as JSON object
  try {
    const parsed = JSON.parse(buffer);

    if (validateFrame(parsed)) {
      if (expectedType && parsed.type !== expectedType) {
        return { frame: null, consumed: 0 };
      }
      return { frame: parsed, consumed: buffer.length };
    }
  } catch {
    // Not complete JSON yet
  }

  return { frame: null, consumed: 0 };
}

/**
 * Create a framed message reader
 */
export function createMessageReader() {
  let buffer = '';
  let expectedLength = -1;

  return {
    /**
     * Feed data into the reader
     */
    feed(data: string): Frame[] {
      buffer += data;
      const frames: Frame[] = [];

      // Try to find complete JSON objects
      while (buffer.length > 0) {
        // Try to detect if we have a complete object
        const trimmed = buffer.trimStart();

        if (trimmed.startsWith('{')) {
          // Find matching closing brace
          let depth = 0;
          let endIndex = -1;

          for (let i = 0; i < trimmed.length; i++) {
            if (trimmed[i] === '{') depth++;
            else if (trimmed[i] === '}') {
              depth--;
              if (depth === 0) {
                endIndex = i + 1;
                break;
              }
            }
          }

          if (endIndex !== -1) {
            const jsonStr = trimmed.slice(0, endIndex);
            const frame = decode(jsonStr);

            if (frame) {
              frames.push(frame);
            }

            buffer = trimmed.slice(endIndex);
          } else {
            // Incomplete JSON
            break;
          }
        } else {
          // Skip non-JSON character
          buffer = trimmed.slice(1);
        }
      }

      return frames;
    },

    /**
     * Get current buffer state
     */
    getBuffer(): string {
      return buffer;
    },

    /**
     * Clear the buffer
     */
    clear(): void {
      buffer = '';
      expectedLength = -1;
    },
  };
}
