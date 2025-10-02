# Method 2: Embeddings + Vector Search Implementation Guide

## Overview
This guide outlines the implementation steps for Method 2: Embeddings + Vector Search to create intelligent conversation memory for the director chat system. This method uses semantic similarity to find relevant past conversations and provide context-aware responses.

## Prerequisites
- Existing conversation summary system (Method 3) already implemented
- OpenAI API access for embeddings
- Vector database service (recommended: Pinecone, Weaviate, or Chroma)
- Firebase Firestore for conversation storage

## Implementation Steps

### Step 1: Choose and Setup Vector Database

#### Option A: Pinecone (Recommended - Managed Service)
```bash
# Install Pinecone client
npm install @pinecone-database/pinecone

# Environment variables needed
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_ENVIRONMENT=your_environment
PINECONE_INDEX_NAME=conversation-embeddings
```

#### Option B: Weaviate (Self-hosted or Cloud)
```bash
# Install Weaviate client
npm install weaviate-ts-client

# Environment variables needed
WEAVIATE_URL=your_weaviate_url
WEAVIATE_API_KEY=your_api_key (if using cloud)
```

#### Option C: Chroma (Open Source)
```bash
# Install Chroma client
npm install chromadb

# Environment variables needed
CHROMA_URL=your_chroma_url
```

### Step 2: Create Vector Database Schema

#### For Pinecone:
```javascript
// Vector dimensions for OpenAI text-embedding-ada-002
const vectorDimensions = 1536;
const metric = 'cosine'; // For semantic similarity

// Index configuration
const indexConfig = {
  name: 'conversation-embeddings',
  dimension: vectorDimensions,
  metric: metric,
  metadata_config: {
    indexed: ['conversationId', 'directorId', 'agencyId', 'timestamp', 'messageType']
  }
};
```

#### For Weaviate:
```javascript
// Schema definition
const conversationSchema = {
  class: 'Conversation',
  properties: [
    { name: 'conversationId', dataType: ['string'] },
    { name: 'directorId', dataType: ['string'] },
    { name: 'agencyId', dataType: ['string'] },
    { name: 'content', dataType: ['text'] },
    { name: 'messageType', dataType: ['string'] },
    { name: 'timestamp', dataType: ['date'] },
    { name: 'metadata', dataType: ['object'] }
  ]
};
```

### Step 3: Create Embedding Generation Functions

#### File: `api/lib/embeddingService.js`
```javascript
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Generate embeddings for conversation content
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

// Process conversation for embedding
function prepareConversationForEmbedding(conversation) {
  // Combine conversation summary + recent messages
  const content = [
    conversation.summary?.content || '',
    ...conversation.recentMessages.map(msg => 
      `${msg.type}: ${msg.content}`
    )
  ].join('\n');
  
  return content;
}

module.exports = {
  generateEmbedding,
  prepareConversationForEmbedding
};
```

### Step 4: Create Vector Database Service

#### File: `api/lib/vectorDatabase.js`
```javascript
// Example for Pinecone
const { Pinecone } = require('@pinecone-database/pinecone');

class VectorDatabaseService {
  constructor() {
    this.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
    this.index = this.pinecone.index(process.env.PINECONE_INDEX_NAME);
  }

  // Store conversation embedding
  async storeConversationEmbedding(conversationId, embedding, metadata) {
    try {
      await this.index.upsert([{
        id: conversationId,
        values: embedding,
        metadata: {
          conversationId,
          directorId: metadata.directorId,
          agencyId: metadata.agencyId,
          timestamp: metadata.timestamp,
          messageCount: metadata.messageCount,
          ...metadata
        }
      }]);
    } catch (error) {
      console.error('Error storing embedding:', error);
      throw error;
    }
  }

  // Search for similar conversations
  async searchSimilarConversations(embedding, directorId, agencyId, limit = 5) {
    try {
      const searchResponse = await this.index.query({
        vector: embedding,
        filter: {
          directorId: { $eq: directorId },
          agencyId: { $eq: agencyId }
        },
        topK: limit,
        includeMetadata: true
      });

      return searchResponse.matches.map(match => ({
        conversationId: match.metadata.conversationId,
        similarity: match.score,
        metadata: match.metadata
      }));
    } catch (error) {
      console.error('Error searching similar conversations:', error);
      throw error;
    }
  }

  // Delete conversation embedding
  async deleteConversationEmbedding(conversationId) {
    try {
      await this.index.deleteOne(conversationId);
    } catch (error) {
      console.error('Error deleting embedding:', error);
      throw error;
    }
  }
}

module.exports = VectorDatabaseService;
```

### Step 5: Update TypeScript Types

#### File: `src/types/index.ts` (Additions)
```typescript
// Add to existing types
export interface ConversationEmbedding {
  conversationId: string;
  directorId: string;
  agencyId: string;
  embedding: number[];
  metadata: {
    timestamp: Date;
    messageCount: number;
    keyTopics: string[];
    summary: string;
  };
}

export interface SimilarConversation {
  conversationId: string;
  similarity: number;
  metadata: {
    timestamp: Date;
    messageCount: number;
    keyTopics: string[];
    summary: string;
  };
}
```

### Step 6: Create Vector Search Service

#### File: `api/lib/vectorSearchService.js`
```javascript
const VectorDatabaseService = require('./vectorDatabase');
const { generateEmbedding, prepareConversationForEmbedding } = require('./embeddingService');
const { adminDb } = require('./firebaseAdmin');

class VectorSearchService {
  constructor() {
    this.vectorDb = new VectorDatabaseService();
  }

  // Index a conversation for vector search
  async indexConversation(conversationId) {
    try {
      // Get conversation data
      const conversationDoc = await adminDb.collection('conversations').doc(conversationId).get();
      if (!conversationDoc.exists) {
        throw new Error('Conversation not found');
      }

      const conversation = conversationDoc.data();
      
      // Get recent messages
      const messagesSnapshot = await adminDb
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get();

      const recentMessages = messagesSnapshot.docs.map(doc => ({
        type: doc.data().type,
        content: doc.data().content,
        timestamp: doc.data().timestamp?.toDate()
      })).reverse();

      // Prepare content for embedding
      const content = prepareConversationForEmbedding({
        summary: conversation.summary,
        recentMessages
      });

      // Generate embedding
      const embedding = await generateEmbedding(content);

      // Store in vector database
      await this.vectorDb.storeConversationEmbedding(conversationId, embedding, {
        directorId: conversation.directorId,
        agencyId: conversation.agencyId,
        timestamp: conversation.lastMessageAt?.toDate() || new Date(),
        messageCount: conversation.messageCount || 0,
        keyTopics: conversation.summary?.keyTopics || [],
        summary: conversation.summary?.content || ''
      });

      console.log('✅ Indexed conversation for vector search:', conversationId);
    } catch (error) {
      console.error('❌ Failed to index conversation:', error);
      throw error;
    }
  }

  // Search for similar conversations
  async findSimilarConversations(currentQuestion, directorId, agencyId, limit = 3) {
    try {
      // Generate embedding for current question
      const questionEmbedding = await generateEmbedding(currentQuestion);

      // Search for similar conversations
      const similarConversations = await this.vectorDb.searchSimilarConversations(
        questionEmbedding,
        directorId,
        agencyId,
        limit
      );

      // Filter out very low similarity scores
      return similarConversations.filter(conv => conv.similarity > 0.7);
    } catch (error) {
      console.error('❌ Failed to find similar conversations:', error);
      return [];
    }
  }

  // Get context from similar conversations
  async getContextFromSimilarConversations(similarConversations) {
    try {
      const contextPromises = similarConversations.map(async (similar) => {
        const conversationDoc = await adminDb
          .collection('conversations')
          .doc(similar.conversationId)
          .get();

        if (conversationDoc.exists) {
          const conversation = conversationDoc.data();
          return {
            conversationId: similar.conversationId,
            similarity: similar.similarity,
            summary: conversation.summary?.content || '',
            keyTopics: conversation.summary?.keyTopics || [],
            timestamp: conversation.lastMessageAt?.toDate()
          };
        }
        return null;
      });

      const contexts = await Promise.all(contextPromises);
      return contexts.filter(context => context !== null);
    } catch (error) {
      console.error('❌ Failed to get context from similar conversations:', error);
      return [];
    }
  }
}

module.exports = VectorSearchService;
```

### Step 7: Integrate Vector Search into AI System

#### File: `api/ai/ask.js` (Modifications)
```javascript
// Add imports
const VectorSearchService = require('../lib/vectorSearchService');

// Initialize vector search service
const vectorSearchService = new VectorSearchService();

// Modify the main handler function
module.exports = async function handler(req, res) {
  // ... existing code ...

  try {
    // ... existing conversation context retrieval ...

    // NEW: Vector search for similar conversations
    let similarConversationsContext = [];
    if (conversationId && question) {
      try {
        const similarConversations = await vectorSearchService.findSimilarConversations(
          question,
          uid,
          userData.agencyId,
          3 // Limit to 3 most similar conversations
        );

        if (similarConversations.length > 0) {
          similarConversationsContext = await vectorSearchService.getContextFromSimilarConversations(
            similarConversations
          );
        }
      } catch (vectorError) {
        console.error('❌ Vector search failed:', vectorError);
        // Continue without vector context
      }
    }

    // ... existing system prompt building ...

    // Modify buildSystemMessage to include vector search context
    const buildSystemMessage = (conversationContext, similarConversationsContext) => {
      // ... existing system prompt code ...

      // ADD: Similar conversations context section
      const similarConversationsSection = similarConversationsContext.length > 0 ? `

CONVERSATIONS SIMILAIRES TROUVÉES :
${similarConversationsContext.map((similar, index) => `
📋 Conversation Similaire ${index + 1} (Similarité: ${(similar.similarity * 100).toFixed(1)}%) :
${similar.summary}

Sujets clés : ${similar.keyTopics.join(', ')}
Date : ${similar.timestamp.toLocaleDateString()}
`).join('\n')}

IMPORTANT : Utilise ces conversations similaires comme référence pour fournir des réponses cohérentes et éviter de répéter les mêmes analyses.` : '';

      return `${baseRole}${coreRules}${formatInstructions}${jsonValidationInstructions}${conversationContextSection}${similarConversationsSection}${contextInfo}`;
    };

    // Update system prompt call
    const systemPrompt = buildSystemMessage(conversationContext, similarConversationsContext);

    // ... rest of existing AI call code ...

    // NEW: Index current conversation after successful response
    if (conversationId && answer) {
      try {
        // Index conversation for future vector searches
        await vectorSearchService.indexConversation(conversationId);
      } catch (indexError) {
        console.error('❌ Failed to index conversation:', indexError);
        // Don't fail the main request
      }
    }

    // ... rest of existing response code ...
  } catch (error) {
    // ... existing error handling ...
  }
};
```

### Step 8: Create Vector Database Management Scripts

#### File: `scripts/manage-vector-database.js`
```javascript
const VectorSearchService = require('../api/lib/vectorSearchService');
const { adminDb } = require('../api/lib/firebaseAdmin');

class VectorDatabaseManager {
  constructor() {
    this.vectorSearchService = new VectorSearchService();
  }

  // Index all existing conversations
  async indexAllConversations() {
    try {
      console.log('🔄 Starting to index all conversations...');
      
      const conversationsSnapshot = await adminDb.collection('conversations').get();
      let indexed = 0;
      let failed = 0;

      for (const doc of conversationsSnapshot.docs) {
        try {
          await this.vectorSearchService.indexConversation(doc.id);
          indexed++;
          console.log(`✅ Indexed conversation ${indexed}/${conversationsSnapshot.docs.length}: ${doc.id}`);
        } catch (error) {
          failed++;
          console.error(`❌ Failed to index conversation ${doc.id}:`, error.message);
        }
      }

      console.log(`🎉 Indexing complete! Indexed: ${indexed}, Failed: ${failed}`);
    } catch (error) {
      console.error('❌ Failed to index conversations:', error);
    }
  }

  // Clean up orphaned embeddings
  async cleanupOrphanedEmbeddings() {
    // Implementation depends on vector database choice
    console.log('🧹 Cleanup functionality to be implemented based on vector database choice');
  }
}

// CLI usage
if (require.main === module) {
  const manager = new VectorDatabaseManager();
  const command = process.argv[2];

  switch (command) {
    case 'index-all':
      manager.indexAllConversations();
      break;
    case 'cleanup':
      manager.cleanupOrphanedEmbeddings();
      break;
    default:
      console.log('Usage: node manage-vector-database.js [index-all|cleanup]');
  }
}

module.exports = VectorDatabaseManager;
```

### Step 9: Environment Configuration

#### File: `.env` (Additions)
```bash
# Vector Database Configuration
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_ENVIRONMENT=your_environment
PINECONE_INDEX_NAME=conversation-embeddings

# Alternative: Weaviate
# WEAVIATE_URL=your_weaviate_url
# WEAVIATE_API_KEY=your_api_key

# Alternative: Chroma
# CHROMA_URL=your_chroma_url
```

### Step 10: Testing and Validation

#### File: `scripts/test-vector-search.js`
```javascript
const VectorSearchService = require('../api/lib/vectorSearchService');

async function testVectorSearch() {
  const vectorSearchService = new VectorSearchService();
  
  // Test embedding generation
  console.log('🧪 Testing embedding generation...');
  const testQuestion = "Montre-moi les performances des employés ce mois-ci";
  const similarConversations = await vectorSearchService.findSimilarConversations(
    testQuestion,
    'test-director-id',
    'test-agency-id',
    3
  );
  
  console.log('📊 Similar conversations found:', similarConversations);
}

testVectorSearch().catch(console.error);
```

## Implementation Timeline

### Phase 1: Setup (1-2 days)
1. Choose and setup vector database service
2. Create embedding service
3. Create vector database service wrapper

### Phase 2: Core Implementation (2-3 days)
1. Implement vector search service
2. Integrate with existing AI system
3. Update TypeScript types

### Phase 3: Testing & Optimization (1-2 days)
1. Create management scripts
2. Test with existing conversations
3. Optimize similarity thresholds
4. Performance testing

### Phase 4: Deployment (1 day)
1. Index existing conversations
2. Deploy to production
3. Monitor performance

## Cost Considerations

### Vector Database Costs
- **Pinecone**: ~$70/month for 1M vectors
- **Weaviate Cloud**: ~$25/month for starter plan
- **Chroma**: Free (self-hosted)

### Embedding Generation Costs
- **OpenAI text-embedding-ada-002**: ~$0.0001 per 1K tokens
- **Estimated cost**: ~$0.01 per conversation indexed

### Total Additional Monthly Cost
- **Small Agency (1-5 directors)**: ~$80-100/month
- **Medium Agency (10-20 directors)**: ~$150-200/month
- **Large Agency (50+ directors)**: ~$500-600/month

## Benefits of Method 2

1. **Semantic Understanding**: Finds relevant conversations even with different wording
2. **Cross-Conversation Learning**: Learns from all past conversations, not just current session
3. **Scalable**: Handles large numbers of conversations efficiently
4. **Language Agnostic**: Works well with French language content
5. **Future-Proof**: Can be extended to other types of content (documents, forms, etc.)

## Integration with Method 3

Method 2 can work alongside Method 3:
- **Method 3**: Provides immediate conversation context and summaries
- **Method 2**: Provides cross-conversation semantic search and learning
- **Combined**: Maximum intelligence with both immediate and historical context

## Monitoring and Maintenance

1. **Performance Monitoring**: Track embedding generation and search times
2. **Quality Monitoring**: Monitor similarity scores and user feedback
3. **Regular Cleanup**: Remove embeddings for deleted conversations
4. **Index Optimization**: Periodically reindex for better performance

This implementation will provide the most advanced conversation memory system, enabling truly intelligent, context-aware responses that learn from all past interactions.
