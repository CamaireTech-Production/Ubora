/**
 * Image Text Extraction Service using OpenAI Vision API
 * Provides excellent OCR for handwritten text and poor quality images
 */

export interface ImageTextExtractionResult {
  text: string;
  confidence: number;
  success: boolean;
  engine?: string;
  error?: string;
  info?: {
    title: string;
    originalFileName: string;
    fileSize: number;
    fileType: string;
    extractionStatus: string;
    confidence?: number;
    extractionMethod: string;
    engine: string;
    error?: string;
  };
}

export class ImageTextExtractionService {
  /**
   * Check if a file is an image
   */
  static isImage(file: File): boolean {
    return file.type.startsWith('image/');
  }

  /**
   * Extract text from an image file using OpenAI Vision API
   */
  static async extractTextFromImage(file: File): Promise<ImageTextExtractionResult> {
    try {
      console.log('🔍 Starting image text extraction for:', file.name);
      
      // Try OpenAI Vision API for excellent handwritten text recognition
      const openaiResult = await this.tryOpenAIVision(file);
      if (openaiResult.success) {
        console.log('✅ OpenAI Vision extraction successful!');
        console.log('🎯 Engine used:', openaiResult.engine);
        console.log('📊 Confidence score:', openaiResult.confidence);
        return openaiResult;
      }
      
      // If OpenAI Vision fails, try Tesseract.js as fallback
      console.log('⚠️ OpenAI Vision failed, trying Tesseract.js fallback...');
      const tesseractResult = await this.tryTesseractJS(file);
      if (tesseractResult.success) {
        console.log('✅ Tesseract.js extraction successful!');
        console.log('🎯 Engine used:', tesseractResult.engine);
        console.log('📊 Confidence score:', tesseractResult.confidence);
        return tesseractResult;
      }
      
      // If both fail, return fallback text
      console.log('⚠️ Both OCR methods failed, using fallback text...');
      const fallbackResult = this.getFallbackText(file);
      console.log('📝 Fallback text prepared for debugging modal');
      console.log('🔍 Fallback result:', fallbackResult);
      return fallbackResult;
      
    } catch (error) {
      console.error('❌ Error extracting text from image:', error);
      console.error('🖼️ File details:', {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      });
      
      // Fallback to error message if extraction fails
      console.log('🔄 Falling back to error message...');
      return this.getFallbackText(file);
    }
  }

  /**
   * Try OpenAI Vision API for excellent handwritten text recognition
   */
  private static async tryOpenAIVision(file: File): Promise<ImageTextExtractionResult> {
    try {
      console.log('🔍 Trying OpenAI Vision API...');
      
      // Convert file to base64
      const base64Image = await this.fileToBase64(file);
      
      // Get the OCR endpoint from environment
      const ocrEndpoint = this.getOCREndpoint();
      
      // Prepare the request payload
      const payload = {
        model: "gpt-4o", // Use GPT-4o for vision capabilities
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all text from this image. If the text is handwritten, transcribe it exactly as written. If the text is printed, extract it accurately. Return only the extracted text without any additional commentary or formatting."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${file.type};base64,${base64Image}`,
                  detail: "high" // High detail for better accuracy
                }
              }
            ]
          }
        ]
      };
      
      // Make API request to the dedicated OCR endpoint
      const response = await fetch(`${ocrEndpoint}/api/ocr/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`OpenAI Vision API error: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('🔍 OpenAI Vision API response:', result);
      
      if (!result.success) {
        throw new Error(result.error || 'OCR extraction failed');
      }
      
      // Extract text from the response
      const extractedText = result.text || result.extractedText || '';
      
      // Clean and format the extracted text
      const cleanedText = this.cleanExtractedText(extractedText);
      
      if (cleanedText && cleanedText.length > 3) {
        return {
          text: cleanedText,
          confidence: result.confidence || 95,
          success: true,
          engine: result.engine || 'openai_vision',
          info: {
            title: file.name.replace(/\.[^/.]+$/, ''),
            originalFileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            extractionStatus: 'success',
            confidence: result.confidence || 95,
            extractionMethod: 'openai_vision_api',
            engine: result.engine || 'openai_vision'
          }
        };
      } else {
        throw new Error('OpenAI Vision returned insufficient text');
      }
      
    } catch (error) {
      console.warn('⚠️ OpenAI Vision API failed:', error);
      return {
        text: '',
        confidence: 0,
        success: false,
        engine: 'openai_vision',
        error: error instanceof Error ? error.message : 'OpenAI Vision API failed'
      };
    }
  }

  /**
   * Try Tesseract.js as fallback OCR
   */
  private static async tryTesseractJS(file: File): Promise<ImageTextExtractionResult> {
    try {
      console.log('🔍 Trying Tesseract.js OCR...');
      
      // Import Tesseract.js dynamically
      const Tesseract = await import('tesseract.js');
      
      // Convert File to image data URL for Tesseract
      const imageDataUrl = await this.fileToDataURL(file);
      
      // Perform OCR with Tesseract.js
      const { data: { text, confidence } } = await Tesseract.recognize(
        imageDataUrl,
        'fra+eng', // French and English languages
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              console.log(`Tesseract.js OCR Progress: ${Math.round(m.progress * 100)}%`);
            }
          }
        }
      );
      
      // Clean and format the extracted text
      const cleanedText = this.cleanExtractedText(text);
      
      if (cleanedText && cleanedText.length > 10) {
        return {
          text: cleanedText,
          confidence: confidence,
          success: true,
          engine: 'tesseract_js',
          info: {
            title: file.name.replace(/\.[^/.]+$/, ''),
            originalFileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            extractionStatus: 'success',
            confidence: confidence,
            extractionMethod: 'tesseract_js',
            engine: 'tesseract_js'
          }
        };
      } else {
        throw new Error('Tesseract.js returned insufficient text');
      }
      
    } catch (error) {
      console.warn('⚠️ Tesseract.js OCR failed:', error);
      return {
        text: '',
        confidence: 0,
        success: false,
        engine: 'tesseract_js',
        error: error instanceof Error ? error.message : 'Tesseract.js OCR failed'
      };
    }
  }

  /**
   * Get the OCR endpoint URL
   */
  private static getOCREndpoint(): string {
    if (import.meta.env.VITE_AI_ENDPOINT) {
      // Extract base URL from AI endpoint (remove /api/ai/ask)
      return import.meta.env.VITE_AI_ENDPOINT.replace('/api/ai/ask', '');
    }
    
    if (import.meta.env.DEV) {
      return 'http://localhost:3000';
    }
    
    // Fallback for production
    return 'https://api.ubora-app.com';
  }

  /**
   * Convert File to base64 string
   */
  private static fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix to get just the base64 string
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Convert File to data URL for Tesseract.js
   */
  private static fileToDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Clean and format extracted text
   */
  static cleanExtractedText(text: string): string {
    if (!text) return '';
    
    return text
      .trim()
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
      .replace(/[ \t]+/g, ' ') // Normalize spaces
      .trim();
  }

  /**
   * Fallback method that returns clear error message if image parsing fails
   */
  private static getFallbackText(file: File): ImageTextExtractionResult {
    const errorMessage = `Erreur lors de l'extraction du texte de l'image "${file.name}". L'image a été uploadée mais le texte n'a pas pu être extrait automatiquement.`;
    
    return {
      text: errorMessage,
      success: true, // Set to true so the debugging modal shows
      confidence: 0,
      engine: 'fallback',
      error: 'OCR extraction failed',
      info: {
        title: file.name.replace(/\.[^/.]+$/, ''),
        originalFileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        extractionStatus: 'failed',
        extractionMethod: 'fallback',
        engine: 'fallback',
        error: 'OCR extraction failed'
      }
    };
  }
}