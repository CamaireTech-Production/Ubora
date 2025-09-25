/**
 * Token counting service using OpenAI's tiktoken library
 * Provides accurate token counting aligned with OpenAI's methodology
 */

// Note: In a real implementation, you would install tiktoken:
// npm install tiktoken
// For now, we'll use a simplified estimation that's close to tiktoken

export class TokenCounter {
  /**
   * Estimate tokens using a simplified approach
   * This is a close approximation to tiktoken's gpt-4.1 encoding
   */
  private static estimateTokens(text: string): number {
    if (!text) return 0;
    
    // Simple estimation: ~4 characters per token for most languages
    // This is close to tiktoken's behavior for gpt-4.1
    const baseTokens = Math.ceil(text.length / 4);
    
    // Add overhead for special characters, punctuation, etc.
    const specialChars = (text.match(/[^\w\s]/g) || []).length;
    const overhead = Math.ceil(specialChars * 0.5);
    
    return baseTokens + overhead;
  }

  /**
   * Count tokens in a message (system + user content)
   */
  static countTokens(systemPrompt: string, userPrompt: string): number {
    const systemTokens = this.estimateTokens(systemPrompt);
    const userTokens = this.estimateTokens(userPrompt);
    
    // Add overhead for message formatting (role, etc.)
    const overheadTokens = 10;
    
    return systemTokens + userTokens + overheadTokens;
  }

  /**
   * Estimate output tokens based on max_tokens setting
   */
  static estimateOutputTokens(maxTokens: number = 800): number {
    // Use 60% of max_tokens as realistic estimate (reduced from 80%)
    return Math.floor(maxTokens * 0.6);
  }

  /**
   * Get total estimated tokens for a request
   */
  static getTotalEstimatedTokens(systemPrompt: string, userPrompt: string, maxTokens: number = 800): number {
    const inputTokens = this.countTokens(systemPrompt, userPrompt);
    const outputTokens = this.estimateOutputTokens(maxTokens);
    return inputTokens + outputTokens;
  }

  /**
   * Apply division for user billing (divide by 1000 for profitability)
   */
  static getUserTokensToCharge(actualTokens: number, divisor: number = 1000): number {
    return Math.ceil(actualTokens / divisor);
  }

  /**
   * Get token cost breakdown for display
   */
  static getTokenCostBreakdown(actualTokens: number, divisor: number = 1000) {
    const userTokens = this.getUserTokensToCharge(actualTokens, divisor);
    const openAICost = actualTokens * 0.000003; // Approximate OpenAI cost per token
    const userCost = userTokens * 0.0000058; // Approximate user cost per token (based on package pricing)
    
    return {
      actualTokens,
      userTokens,
      divisor,
      openAICost,
      userCost,
      profitMargin: ((userCost - openAICost) / openAICost) * 100
    };
  }
}

// For production, replace the estimateTokens method with actual tiktoken:
/*
import { encoding_for_model } from 'tiktoken';

export class TokenCounter {
  private static encoder = encoding_for_model('gpt-4.1');

  private static estimateTokens(text: string): number {
    return this.encoder.encode(text).length;
  }
  
  // ... rest of the methods remain the same
}
*/
