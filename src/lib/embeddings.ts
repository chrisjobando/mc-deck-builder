import { google } from '@ai-sdk/google';
import { embed, embedMany } from 'ai';
import { prisma } from './db';

// Embedding configuration
const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768;
const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;
const BATCH_SIZE = 50;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 20000; // 20 seconds base delay

interface SearchResult {
  id: string;
  content: string;
  document_id: string;
  similarity: number;
}

/**
 * Split text into overlapping chunks for embedding
 */
export function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + CHUNK_SIZE;

    // Try to break at sentence boundary
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('.', end);
      const lastNewline = text.lastIndexOf('\n', end);
      const breakPoint = Math.max(lastPeriod, lastNewline);
      if (breakPoint > start + CHUNK_SIZE / 2) {
        end = breakPoint + 1;
      }
    }

    chunks.push(text.slice(start, end).trim());
    start = end - CHUNK_OVERLAP;
  }

  return chunks.filter((c) => c.length > 50); // Skip tiny chunks
}

/**
 * Generate embeddings for text chunks using Google's embedding model
 * Includes retry logic for rate limiting
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const { embeddings } = await embedMany({
        model: google.embedding(EMBEDDING_MODEL),
        values: texts,
        providerOptions: {
          google: { outputDimensionality: EMBEDDING_DIMENSIONS },
        },
      });
      return embeddings;
    } catch (error) {
      lastError = error as Error;
      const isRateLimit = lastError.message?.includes('quota') || lastError.message?.includes('rate');
      if (isRateLimit && attempt < MAX_RETRIES - 1) {
        const waitTime = (attempt + 1) * RETRY_DELAY_MS;
        console.log(`Rate limited, waiting ${waitTime / 1000}s before retry...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      } else {
        throw error;
      }
    }
  }
  throw lastError;
}

/**
 * Generate a single embedding for query text
 */
export async function generateQueryEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: google.embedding(EMBEDDING_MODEL),
    value: text,
    providerOptions: {
      google: { outputDimensionality: EMBEDDING_DIMENSIONS },
    },
  });

  return embedding;
}

/**
 * Process and store a rules document with embeddings
 */
export async function processDocument(
  title: string,
  content: string,
  section?: string
): Promise<string> {
  // Create the document record
  const document = await prisma.rulesDocument.create({
    data: {
      title,
      section,
      content,
    },
  });

  try {
    // Split into chunks
    const chunks = chunkText(content);

    if (chunks.length === 0) {
      throw new Error('No valid chunks extracted from content');
    }

    // Generate embeddings in batches
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const embeddings = await generateEmbeddings(batch);

      // Insert chunks with embeddings using raw SQL (Prisma doesn't support vector type)
      for (let j = 0; j < batch.length; j++) {
        const chunkIndex = i + j;
        const embedding = embeddings[j];
        const embeddingStr = `[${embedding.join(',')}]`;

        await prisma.$executeRaw`
          INSERT INTO document_chunks (id, content, chunk_index, document_id, embedding, created_at)
          VALUES (
            gen_random_uuid(),
            ${batch[j]},
            ${chunkIndex},
            ${document.id}::uuid,
            ${embeddingStr}::vector,
            NOW()
          )
        `;
      }
    }

    return document.id;
  } catch (error) {
    // Cleanup: delete the document if chunking/embedding failed
    await prisma.rulesDocument.delete({ where: { id: document.id } });
    throw error;
  }
}

/**
 * Search for relevant document chunks using vector similarity
 */
export async function searchDocuments(
  query: string,
  limit = 5,
  threshold = 0.6
): Promise<{ content: string; similarity: number; documentId: string }[]> {
  const queryEmbedding = await generateQueryEmbedding(query);
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  const results = await prisma.$queryRaw<SearchResult[]>`
    SELECT 
      id,
      content,
      document_id,
      1 - (embedding <=> ${embeddingStr}::vector) as similarity
    FROM document_chunks
    WHERE embedding IS NOT NULL
      AND 1 - (embedding <=> ${embeddingStr}::vector) > ${threshold}
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${limit}
  `;

  return results.map((r) => ({
    content: r.content,
    similarity: r.similarity,
    documentId: r.document_id,
  }));
}

/**
 * Get all documents for admin listing
 */
export async function listDocuments() {
  return prisma.rulesDocument.findMany({
    select: {
      id: true,
      title: true,
      section: true,
      createdAt: true,
      _count: { select: { chunks: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Delete a document and its chunks
 */
export async function deleteDocument(id: string) {
  // Chunks are deleted via cascade
  return prisma.rulesDocument.delete({ where: { id } });
}
