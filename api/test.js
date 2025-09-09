module.exports = async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    
    return res.status(200).json({
      ok: true,
      message: "Basic test endpoint working",
      timestamp: Date.now(),
      method: req.method,
      nodeVersion: process.version
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
};
