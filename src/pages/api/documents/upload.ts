import type { APIRoute } from 'astro';
import { PDFParse } from 'pdf-parse';
import { requireAdmin } from '../../../lib/auth';
import { processDocument } from '../../../lib/embeddings';

interface UploadResult {
  filename: string;
  id?: string;
  contentLength?: number;
  error?: string;
}

async function extractText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (file.type === 'application/pdf') {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return result.text;
  } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
    return new TextDecoder().decode(buffer);
  }
  throw new Error('Unsupported file type. Use PDF or TXT.');
}

export const POST: APIRoute = async (context) => {
  const user = await requireAdmin(context);
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const formData = await context.request.formData();
    const files = formData.getAll('file') as File[];
    const section = formData.get('section') as string | null;

    if (!files.length) {
      return new Response('Missing file(s)', { status: 400 });
    }

    const results: UploadResult[] = [];

    for (const file of files) {
      const title = file.name.replace(/\.(pdf|txt)$/i, '');

      try {
        const content = await extractText(file);

        if (!content.trim()) {
          results.push({ filename: file.name, error: 'No text content extracted' });
          continue;
        }

        const documentId = await processDocument(title, content, section ?? undefined);
        results.push({ 
          filename: file.name, 
          id: documentId, 
          contentLength: content.length 
        });
      } catch (err) {
        results.push({ 
          filename: file.name, 
          error: err instanceof Error ? err.message : 'Unknown error' 
        });
      }
    }

    const successful = results.filter(r => r.id);
    const failed = results.filter(r => r.error);

    return new Response(JSON.stringify({ 
      results,
      summary: {
        total: results.length,
        successful: successful.length,
        failed: failed.length,
      }
    }), {
      status: failed.length === results.length ? 400 : 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to process upload:', error);
    return new Response(`Failed to process files: ${error instanceof Error ? error.message : 'Unknown error'}`, { 
      status: 500 
    });
  }
};
