/**
 * Session Transcript
 *
 * Manages conversation transcripts within sessions.
 */

import type { TranscriptEntry } from './store.js';

/**
 * Transcript manager for a session
 */
export class SessionTranscript {
  private entries: TranscriptEntry[] = [];
  private maxEntries: number;

  constructor(maxEntries = 1000) {
    this.maxEntries = maxEntries;
  }

  /**
   * Add an entry to the transcript
   */
  add(entry: Omit<TranscriptEntry, 'id' | 'timestamp'>): TranscriptEntry {
    const fullEntry: TranscriptEntry = {
      ...entry,
      id: `transcript_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };

    this.entries.push(fullEntry);

    // Trim if needed
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    return fullEntry;
  }

  /**
   * Get all entries
   */
  getAll(): TranscriptEntry[] {
    return [...this.entries];
  }

  /**
   * Get entries by role
   */
  getByRole(role: TranscriptEntry['role']): TranscriptEntry[] {
    return this.entries.filter((e) => e.role === role);
  }

  /**
   * Get recent entries
   */
  getRecent(count: number): TranscriptEntry[] {
    return this.entries.slice(-count);
  }

  /**
   * Get entry by ID
   */
  getById(id: string): TranscriptEntry | undefined {
    return this.entries.find((e) => e.id === id);
  }

  /**
   * Search entries by content
   */
  search(query: string): TranscriptEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.entries.filter((e) =>
      e.content.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get message count
   */
  get count(): number {
    return this.entries.length;
  }

  /**
   * Clear transcript
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Load entries from array
   */
  load(entries: TranscriptEntry[]): void {
    this.entries = [...entries];
  }

  /**
   * Export transcript as array
   */
  export(): TranscriptEntry[] {
    return this.entries.map((e) => ({ ...e }));
  }

  /**
   * Get total character count
   */
  get totalChars(): number {
    return this.entries.reduce((sum, e) => sum + e.content.length, 0);
  }

  /**
   * Summarize transcript stats
   */
  getStats(): {
    totalMessages: number;
    userMessages: number;
    assistantMessages: number;
    toolMessages: number;
    totalChars: number;
    firstMessageAt?: number;
    lastMessageAt?: number;
  } {
    const userMessages = this.entries.filter((e) => e.role === 'user').length;
    const assistantMessages = this.entries.filter((e) => e.role === 'assistant').length;
    const toolMessages = this.entries.filter((e) => e.role === 'tool').length;

    return {
      totalMessages: this.entries.length,
      userMessages,
      assistantMessages,
      toolMessages,
      totalChars: this.totalChars,
      firstMessageAt: this.entries[0]?.timestamp,
      lastMessageAt: this.entries[this.entries.length - 1]?.timestamp,
    };
  }
}
