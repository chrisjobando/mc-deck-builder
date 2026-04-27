import { google } from '@ai-sdk/google';
import { embed, embedMany } from 'ai';
import { prisma } from './db';

const CHUNK_SIZE = 800; // Characters per chunk
const CHUNK_OVERLAP = 100; // Overlap between chunks

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
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: google.textEmbeddingModel('text-embedding-004'),
    values: texts,
  });

  return embeddings;
}

/**
 * Generate a single embedding for query text
 */
export async function generateQueryEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: google.textEmbeddingModel('text-embedding-004'),
    value: text,
  });

  return embedding;
}

/**
 * Process and store a rules document with embeddings
 */
export async function processDocument(
  title: string,
  content: string,
  section?: string,
  fileUrl?: string
): Promise<string> {
  // Create the document record
  const document = await prisma.rulesDocument.create({
    data: {
      title,
      section,
      content,
      fileUrl,
    },
  });

  // Split into chunks
  const chunks = chunkText(content);

  // Generate embeddings in batches (Google allows up to 100 at once)
  const BATCH_SIZE = 50;
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
