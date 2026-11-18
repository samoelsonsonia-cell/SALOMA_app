import type { IncomingMessage, ServerResponse } from 'http';
import type { Express } from 'express';
import { createSalomaApiApp } from '../server';

let cachedApp: Express | null = null;

function getSafeApp(): Express | null {
  if (cachedApp) return cachedApp;
  try {
    cachedApp = createSalomaApiApp();
    return cachedApp;
  } catch (err) {
    console.error('SALOMA api/index init fallback:', err);
    return null;
  }
}

function sendJsonFallback(res: ServerResponse, statusCode: number, payload: unknown) {
  try {
    if (res.headersSent) return;
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
  } catch {
    // ignore response write failure
  }
}

export default async function handler(
  req: IncomingMessage & { url?: string; body?: unknown },
  res: ServerResponse
) {
  let normalizedUrl = '/';
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
    normalizedUrl = req.url || '/';
  } catch {
    normalizedUrl = req.url || '/';
  }

  try {
    const app = getSafeApp();
    if (!app) {
      if (normalizedUrl.startsWith('/api/security/turnstile')) {
        const siteKey =
          String(
            process.env.NEXT_PUBLIC_CLOUDFLARE_SITE_KEY ||
              process.env.VITE_CLOUDFLARE_SITE_KEY ||
              process.env.TURNSTILE_SITE_KEY ||
              '1x00000000000000000000AA'
          ).trim() || '1x00000000000000000000AA';
        sendJsonFallback(res, 200, {
          siteKey,
          isCustomConfigured: false,
          nonBlocking: true
        });
        return;
      }
      sendJsonFallback(res, 404, {
        error: 'Service API temporairement indisponible.'
      });
      return;
    }

    await new Promise<void>(resolve => {
      let settled = false;
      const done = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      res.once('finish', done);
      res.once('close', done);

      try {
        (app as unknown as (
          rq: IncomingMessage,
          rs: ServerResponse,
          next: (err?: unknown) => void
        ) => void)(req, res, err => {
          if (err) {
            console.error('SALOMA Express middleware error:', err);
            sendJsonFallback(res, 400, {
              error: err instanceof Error ? err.message : 'Erreur lors du traitement de la requête.'
            });
          }
          done();
        });
      } catch (err) {
        console.error('SALOMA handler invoke error:', err);
        sendJsonFallback(res, 400, {
          error: err instanceof Error ? err.message : 'Erreur de traitement de la requête.'
        });
        done();
      }
    });
  } catch (err) {
    console.error('SALOMA top-level handler error:', err);
    sendJsonFallback(res, 400, {
      error: err instanceof Error ? err.message : 'Erreur serveur gérée en mode sécurisé.'
    });
  }
}
