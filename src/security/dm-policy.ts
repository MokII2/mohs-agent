/**
 * DM Policy
 *
 * Direct message policy resolution.
 */

export type DMPolicy = 'allow' | 'block' | 'pairing';

/**
 * DM policy resolver
 */
export class DMPolicyResolver {
  private defaultPolicy: DMPolicy;
  private channelPolicies: Map<string, DMPolicy> = new Map();
  private userPolicies: Map<string, DMPolicy> = new Map();

  constructor(defaultPolicy: DMPolicy = 'pairing') {
    this.defaultPolicy = defaultPolicy;
  }

  /**
   * Set channel-specific policy
   */
  setChannelPolicy(channelId: string, policy: DMPolicy): void {
    this.channelPolicies.set(channelId, policy);
  }

  /**
   * Set user-specific policy
   */
  setUserPolicy(userId: string, policy: DMPolicy): void {
    this.userPolicies.set(userId, policy);
  }

  /**
   * Get effective policy for a DM
   */
  getPolicy(options: { channelId?: string; userId?: string; isPaired?: boolean }): DMPolicy {
    // Check user-specific policy first
    if (options.userId && this.userPolicies.has(options.userId)) {
      return this.userPolicies.get(options.userId)!;
    }

    // Check channel-specific policy
    if (options.channelId && this.channelPolicies.has(options.channelId)) {
      return this.channelPolicies.get(options.channelId)!;
    }

    // Handle pairing policy
    if (this.defaultPolicy === 'pairing') {
      // If paired, allow; otherwise block
      return options.isPaired ? 'allow' : 'block';
    }

    return this.defaultPolicy;
  }

  /**
   * Check if DM is allowed
   */
  isAllowed(options: { channelId?: string; userId?: string; isPaired?: boolean }): boolean {
    const policy = this.getPolicy(options);
    return policy === 'allow';
  }

  /**
   * Resolve policy with reason
   */
  resolve(options: { channelId?: string; userId?: string; isPaired?: boolean }): {
    policy: DMPolicy;
    allowed: boolean;
    reason: string;
  } {
    const policy = this.getPolicy(options);

    let reason: string;
    switch (policy) {
      case 'allow':
        reason = 'Messages are allowed';
        break;
      case 'block':
        reason = 'Messages are blocked by policy';
        break;
      case 'pairing':
        reason = options.isPaired ? 'User is paired' : 'User is not paired';
        break;
    }

    return { policy, allowed: policy === 'allow', reason };
  }

  /**
   * Get default policy
   */
  getDefaultPolicy(): DMPolicy {
    return this.defaultPolicy;
  }

  /**
   * Set default policy
   */
  setDefaultPolicy(policy: DMPolicy): void {
    this.defaultPolicy = policy;
  }

  /**
   * Clear all custom policies
   */
  clear(): void {
    this.channelPolicies.clear();
    this.userPolicies.clear();
  }

  /**
   * Export policies
   */
  export(): { defaultPolicy: DMPolicy; channelPolicies: Record<string, DMPolicy>; userPolicies: Record<string, DMPolicy> } {
    return {
      defaultPolicy: this.defaultPolicy,
      channelPolicies: Object.fromEntries(this.channelPolicies),
      userPolicies: Object.fromEntries(this.userPolicies),
    };
  }
}
