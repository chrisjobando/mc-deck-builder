import type { APIRoute } from 'astro';
import { requireAuth } from '../../../lib/auth';
import { deleteDocument, listDocuments, processDocument } from '../../../lib/embeddings';

// List all documents
export const GET: APIRoute = async (context) => {
  const user = await requireAuth(context);
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const documents = await listDocuments();
    return new Response(JSON.stringify(documents), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to list documents:', error);
    return new Response('Failed to list documents', { status: 500 });
  }
};

// Upload a new document
export const POST: APIRoute = async (context) => {
  const user = await requireAuth(context);
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const body = await context.request.json();
    const { title, content, section } = body;

    if (!title || !content) {
      return new Response('Missing title or content', { status: 400 });
    }

    const documentId = await processDocument(title, content, section);

    return new Response(JSON.stringify({ id: documentId }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to process document:', error);
    return new Response('Failed to process document', { status: 500 });
  }
};

// Delete a document
export const DELETE: APIRoute = async (context) => {
  const user = await requireAuth(context);
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return new Response('Missing document ID', { status: 400 });
    }

    await deleteDocument(id);

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete document:', error);
    return new Response('Failed to delete document', { status: 500 });
  }
};
