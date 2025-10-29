/**
 * Token counting utility for API endpoints
 * Provides accurate token counting aligned with OpenAI's methodology
 */

class TokenCounter {
  /**
   * Estimate tokens using a simplified approach
   * This is a close approximation to tiktoken's gpt-4.1 encoding
   */
  static estimateTokens(text) {
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
   * Apply division for user billing (divide by 1000 for profitability)
   */
  static getUserTokensToCharge(actualTokens, divisor = 1000) {
    const userTokens = Math.ceil(actualTokens / divisor);
    return userTokens;
  }

  /**
   * Get token cost breakdown for display
   */
  static getTokenCostBreakdown(actualTokens, divisor = 1000) {
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

  /**
   * Estimate tokens for PDF/image extraction based on file size
   */
  static estimateExtractionTokens(fileSize, fileType) {
    const sizeInMB = fileSize / (1024 * 1024);
    
    // Base tokens for extraction request
    const baseTokens = fileType === 'pdf' ? 200 : 150;
    
    // Size-based multiplier
    let sizeMultiplier = 1;
    if (sizeInMB > 5) sizeMultiplier = 2;
    else if (sizeInMB > 2) sizeMultiplier = 1.5;
    else if (sizeInMB > 1) sizeMultiplier = 1.2;
    
    // Estimate based on file size (larger files = more content to process)
    const contentEstimate = Math.ceil(sizeInMB * 50); // ~50 tokens per MB
    
    const estimatedTokens = Math.ceil((baseTokens + contentEstimate) * sizeMultiplier);
    
    return estimatedTokens;
  }

  /**
   * Calculate actual tokens from OpenAI response for extraction
   */
  static calculateActualTokens(openaiResponse) {
    if (!openaiResponse || !openaiResponse.usage) {
      return 0;
    }
    
    const actualTokens = openaiResponse.usage.total_tokens || 0;
    // Use same formula as chat system: (actualTokens * 2.5) / 100
    const userTokensToCharge = Math.ceil((actualTokens * 2.5) / 100);
    
    return userTokensToCharge;
  }
}

module.exports = { TokenCounter };
