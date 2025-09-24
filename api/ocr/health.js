module.exports = async function handler(req, res) {
  try {
    // Headers CORS complets
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    };

    // Ajouter les headers CORS à toutes les réponses
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    // Gérer les requêtes OPTIONS (preflight CORS)
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    // Vérifier que la méthode est GET
    if (req.method !== 'GET') {
      return res.status(405).json({ 
        error: 'Méthode non autorisée',
        code: 'METHOD_NOT_ALLOWED'
      });
    }

    // Vérifier la présence de la clé OpenAI
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
    
    return res.status(200).json({
      ok: true,
      service: 'OCR Text Extraction',
      engine: 'OpenAI Vision API',
      model: 'gpt-4o',
      status: hasOpenAIKey ? 'ready' : 'missing_api_key',
      timestamp: new Date().toISOString(),
      features: [
        'Handwritten text recognition',
        'Poor quality image support',
        'Multilingual support (French/English)',
        'High accuracy extraction'
      ]
    });

  } catch (error) {
    console.error('❌ OCR health check error:', error);
    
    return res.status(500).json({
      ok: false,
      error: 'Erreur lors de la vérification du service OCR',
      code: 'HEALTH_CHECK_ERROR',
      details: error.message
    });
  }
};
