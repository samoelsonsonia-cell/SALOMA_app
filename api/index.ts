import type { IncomingMessage, ServerResponse } from 'http';
import { createSalomaApiApp } from '../server';

const app = createSalomaApiApp();

export default function handler(
  req: IncomingMessage & { url?: string },
  res: ServerResponse
) {
  try {
    const rawUrl = req.url || '/';
    const parsed = new URL(rawUrl, 'http://localhost');
    const subPath = parsed.searchParams.get('__saloma_path');
    if (subPath !== null) {
      parsed.searchParams.delete('__saloma_path');
      const qs = parsed.searchParams.toString();
      const cleanSub = subPath.replace(/^\/+/, '');
      req.url = `/api/${cleanSub}${qs ? `?${qs}` : ''}`;
    } else if (!rawUrl.startsWith('/api')) {
      req.url = `/api${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
    }
  } catch {
    // preserve original req.url on fallback
  }

  return app(
    req as Parameters<typeof app>[0],
    res as Parameters<typeof app>[1]
  );
}
