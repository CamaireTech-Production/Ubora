module.exports = async function handler(req, res) {
  // Headers CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  // Ajouter les headers CORS à toutes les réponses
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Gérer les requêtes OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Seules les requêtes GET sont autorisées
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Méthode non autorisée',
      allowed: ['GET', 'OPTIONS']
    });
  }

  // Réponse de santé
  return res.status(200).json({
    ok: true,
    ts: Date.now(),
    service: 'Multi-Agency AI Backend',
    version: '1.0.0'
  });
}