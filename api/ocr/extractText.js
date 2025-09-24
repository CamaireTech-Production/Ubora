const OpenAI = require('openai');

// Configuration OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async function handler(req, res) {
  try {
    // Headers CORS complets
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400' // 24h cache preflight
    };

    // Ajouter les headers CORS à toutes les réponses
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    // Gérer les requêtes OPTIONS (preflight CORS)
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    // Vérifier que la méthode est POST
    if (req.method !== 'POST') {
      return res.status(405).json({ 
        error: 'Méthode non autorisée',
        code: 'METHOD_NOT_ALLOWED'
      });
    }

    // Validation du corps de la requête
    const { model, messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ 
        error: 'Messages manquants ou invalides',
        code: 'INVALID_MESSAGES'
      });
    }

    // Vérifier qu'il y a au moins une image dans les messages
    const hasImage = messages.some(msg => 
      msg.content && Array.isArray(msg.content) && msg.content.some(content => 
        content.type === 'image_url'
      )
    );

    if (!hasImage) {
      return res.status(400).json({ 
        error: 'Aucune image trouvée dans la requête',
        code: 'NO_IMAGE_FOUND'
      });
    }

    console.log('🔍 Processing image text extraction request...');
    
    // Appel à l'API OpenAI Vision
    const visionResponse = await openai.chat.completions.create({
      model: model || 'gpt-4o',
      messages: messages,
      max_tokens: 1000,
      temperature: 0.1
    });
    
    const extractedText = visionResponse.choices[0]?.message?.content || '';
    
    // Log des informations de coût (pour monitoring)
    const usage = visionResponse.usage;
    console.log('💰 OpenAI Vision API Usage:', {
      prompt_tokens: usage?.prompt_tokens || 0,
      completion_tokens: usage?.completion_tokens || 0,
      total_tokens: usage?.total_tokens || 0,
      model: model || 'gpt-4o'
    });
    
    return res.status(200).json({
      success: true,
      text: extractedText,
      extractedText: extractedText,
      confidence: 95, // OpenAI Vision a une très haute confiance
      engine: 'openai_vision',
      model: model || 'gpt-4o',
      usage: usage,
      meta: {
        timestamp: new Date().toISOString(),
        type: 'vision_extraction'
      }
    });

  } catch (error) {
    console.error('❌ Image text extraction error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'extraction de texte de l\'image',
      code: 'EXTRACTION_ERROR',
      details: error.message,
      engine: 'openai_vision'
    });
  }
};
