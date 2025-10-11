const { adminDb, admin } = require('../lib/firebaseAdmin');

/**
 * GET /api/files/download
 * Download file from Firestore storage
 */
async function downloadHandler(req, res) {
  try {
    // CORS headers
    const corsOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['*'];
    const origin = req.headers.origin;
    const allowedOrigin = corsOrigins.includes('*') ? '*' : 
                         (origin && corsOrigins.includes(origin)) ? origin : corsOrigins[0];
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    };

    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    // Handle OPTIONS requests
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    console.log('🔍 Download endpoint called with method:', req.method);
    console.log('🔍 Query params:', req.query);
    
    const { downloadUrl } = req.query;

    if (!downloadUrl) {
      return res.status(400).json({
        success: false,
        error: 'Missing downloadUrl parameter'
      });
    }

    // Parse the firestore:// URL
    if (!downloadUrl.startsWith('firestore://')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid download URL format'
      });
    }

    // Extract path from firestore://agencyId/formId/userId/fieldId_timestamp
    const path = downloadUrl.replace('firestore://', '');
    const pathParts = path.split('/');
    
    if (pathParts.length < 4) {
      return res.status(400).json({
        success: false,
        error: 'Invalid download URL path'
      });
    }

    const [agencyId, formId, userId, fileId] = pathParts;

    console.log('🔄 Looking for file:', { agencyId, formId, userId, fileId });

    // Find the file in the fileData collection
    const fileQuery = await adminDb
      .collection('fileData')
      .where('agencyId', '==', agencyId)
      .where('formId', '==', formId)
      .where('userId', '==', userId)
      .where('downloadUrl', '==', downloadUrl)
      .limit(1)
      .get();

    if (fileQuery.empty) {
      console.log('❌ File not found in Firestore');
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    const fileDoc = fileQuery.docs[0];
    const fileData = fileDoc.data();

    console.log('✅ File found:', {
      fileName: fileData.fileName,
      fileType: fileData.fileType,
      fileSize: fileData.fileSize
    });

    // Set appropriate headers
    res.setHeader('Content-Type', fileData.fileType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileData.fileName}"`);
    res.setHeader('Content-Length', fileData.fileSize);

    // Convert base64 to buffer and send
    const fileBuffer = Buffer.from(fileData.base64Data, 'base64');
    res.send(fileBuffer);

  } catch (error) {
    console.error('❌ Error in download endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

module.exports = { downloadHandler };
