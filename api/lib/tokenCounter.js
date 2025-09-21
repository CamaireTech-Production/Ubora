/**
 * Token counting utility for API endpoints
 * Provides accurate token counting aligned with OpenAI's methodology
 */

class TokenCounter {
  /**
   * Estimate tokens using a simplified approach
   * This is a close approximation to tiktoken's gpt-4o encoding
   */
  static estimateTokens(text) {
    if (!text) return 0;
    
    // Simple estimation: ~4 characters per token for most languages
    // This is close to tiktoken's behavior for gpt-4o
    const baseTokens = Math.ceil(text.length / 4);
    
    // Add overhead for special characters, punctuation, etc.
    const specialChars = (text.match(/[^\w\s]/g) || []).length;
    const overhead = Math.ceil(specialChars * 0.5);
    
    return baseTokens + overhead;
  }

  /**
   * Count tokens in a message (system + user content)
   */
  static countTokens(systemPrompt, userPrompt) {
    const systemTokens = this.estimateTokens(systemPrompt);
    const userTokens = this.estimateTokens(userPrompt);
    
    // Add overhead for message formatting (role, etc.)
    const overheadTokens = 10;
    
    return systemTokens + userTokens + overheadTokens;
  }

  /**
   * Estimate output tokens based on max_tokens setting
   */
  static estimateOutputTokens(maxTokens = 800) {
    // Use 60% of max_tokens as realistic estimate (reduced from 80%)
    return Math.floor(maxTokens * 0.6);
  }

  /**
   * Get total estimated tokens for a request
   */
  static getTotalEstimatedTokens(systemPrompt, userPrompt, maxTokens = 800) {
    const inputTokens = this.countTokens(systemPrompt, userPrompt);
    const outputTokens = this.estimateOutputTokens(maxTokens);
    return inputTokens + outputTokens;
  }

  /**
   * Apply multiplier for user billing (1.5x for profitability - reduced from 2.5x)
   */
  static getUserTokensToCharge(actualTokens, multiplier = 1.5) {
    return Math.ceil(actualTokens * multiplier);
  }

  /**
   * Get token cost breakdown for display
   */
  static getTokenCostBreakdown(actualTokens, multiplier = 1.5) {
    const userTokens = this.getUserTokensToCharge(actualTokens, multiplier);
    const openAICost = actualTokens * 0.000003; // Approximate OpenAI cost per token
    const userCost = userTokens * 0.0000058; // Approximate user cost per token (based on package pricing)
    
    return {
      actualTokens,
      userTokens,
      multiplier,
      openAICost,
      userCost,
      profitMargin: ((userCost - openAICost) / openAICost) * 100
    };
  }
}

module.exports = { TokenCounter };
