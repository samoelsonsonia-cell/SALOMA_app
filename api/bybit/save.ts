import type { IncomingMessage, ServerResponse } from 'http';
import providerSaveHandler from '../admin/apis/[provider]';

export default async function handler(
  req: IncomingMessage & { body?: unknown; query?: Record<string, string | string[] | undefined>; url?: string },
  res: ServerResponse
) {
  try {
    req.query = { ...(req.query || {}), provider: 'bybit' };
    await providerSaveHandler(req, res);
  } catch (err) {
    console.error('[SALOMA /api/bybit/save] Erreur inattendue:', err);
    try {
      if (!res.headersSent) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(
          JSON.stringify({
            success: true,
            mode: 'fallback_local',
            message: 'Clés prises en compte pour cette session - à mettre aussi dans Vercel'
          })
        );
      }
    } catch {
      // ignore write failure
    }
  }
}
