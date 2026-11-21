import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

export type PriceAlertDirection = 'above' | 'below';

export interface PriceAlert {
  id: string;
  userId: string;
  symbol: string;
  direction: PriceAlertDirection;
  targetPriceUsd: number;
  createdPriceUsd: number;
  active: boolean;
  triggered: boolean;
  triggeredAt?: string;
  triggeredPriceUsd?: number;
  createdAt: string;
  note?: string;
}

const ALERTS_FILE =
  process.env.VERCEL || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME
    ? path.join(os.tmpdir(), '.saloma-price-alerts.json')
    : path.resolve(process.cwd(), '.saloma-price-alerts.json');

let alertsStore: PriceAlert[] = [];
let loaded = false;

function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  try {
    if (fs.existsSync(ALERTS_FILE)) {
      const raw = fs.readFileSync(ALERTS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        alertsStore = parsed.filter(
          item =>
            item &&
            typeof item.id === 'string' &&
            typeof item.userId === 'string' &&
            typeof item.symbol === 'string' &&
            (item.direction === 'above' || item.direction === 'below') &&
            Number.isFinite(Number(item.targetPriceUsd)) &&
            Number(item.targetPriceUsd) > 0
        );
      }
    }
  } catch (err) {
    console.error('Failed to load price alerts store:', err);
    alertsStore = [];
  }
}

function persistAlerts() {
  try {
    fs.writeFileSync(ALERTS_FILE, JSON.stringify(alertsStore, null, 2), { mode: 0o600 });
  } catch (err) {
    console.error('Failed to persist price alerts store:', err);
  }
}

export function listUserPriceAlerts(userId: string): PriceAlert[] {
  ensureLoaded();
  const cleanUser = String(userId || '').trim();
  if (!cleanUser) return [];
  return alertsStore
    .filter(a => a.userId === cleanUser)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function createUserPriceAlert(params: {
  userId: string;
  symbol: string;
  direction: PriceAlertDirection;
  targetPriceUsd: number;
  createdPriceUsd: number;
  note?: string;
}): PriceAlert {
  ensureLoaded();
  const cleanUser = String(params.userId || '').trim();
  const cleanSym = String(params.symbol || '').toUpperCase().trim();
  const target = Number(params.targetPriceUsd);
  const current = Number(params.createdPriceUsd) || 0;

  if (!cleanUser) throw new Error('Utilisateur requis.');
  if (!cleanSym) throw new Error('Crypto invalide.');
  if (params.direction !== 'above' && params.direction !== 'below') {
    throw new Error('Type d’alerte invalide (haussière ou baissière requis).');
  }
  if (!Number.isFinite(target) || target <= 0) {
    throw new Error('Le prix cible doit être supérieur à 0 $.');
  }

  const userActiveCount = alertsStore.filter(a => a.userId === cleanUser && a.active).length;
  if (userActiveCount >= 50) {
    throw new Error('Limite maximale de 50 alertes actives atteinte. Supprimez ou désactivez une alerte.');
  }

  const alert: PriceAlert = {
    id: `alert_${crypto.randomUUID()}`,
    userId: cleanUser,
    symbol: cleanSym,
    direction: params.direction,
    targetPriceUsd: target,
    createdPriceUsd: current,
    active: true,
    triggered: false,
    createdAt: new Date().toISOString(),
    note: params.note ? String(params.note).trim().slice(0, 120) : undefined
  };

  alertsStore.unshift(alert);
  persistAlerts();
  return alert;
}

export function updateUserPriceAlert(
  userId: string,
  alertId: string,
  patch: { active?: boolean; rearm?: boolean }
): PriceAlert | null {
  ensureLoaded();
  const idx = alertsStore.findIndex(a => a.id === alertId && a.userId === userId);
  if (idx === -1) return null;
  const current = alertsStore[idx];
  const next: PriceAlert = { ...current };
  if (patch.rearm) {
    next.triggered = false;
    next.triggeredAt = undefined;
    next.triggeredPriceUsd = undefined;
    next.active = true;
  } else if (typeof patch.active === 'boolean') {
    next.active = patch.active;
    if (patch.active && next.triggered) {
      next.triggered = false;
      next.triggeredAt = undefined;
      next.triggeredPriceUsd = undefined;
    }
  }
  alertsStore[idx] = next;
  persistAlerts();
  return next;
}

export function deleteUserPriceAlert(userId: string, alertId: string): boolean {
  ensureLoaded();
  const prevLen = alertsStore.length;
  alertsStore = alertsStore.filter(a => !(a.id === alertId && a.userId === userId));
  if (alertsStore.length !== prevLen) {
    persistAlerts();
    return true;
  }
  return false;
}

export function evaluatePriceAlertsForSymbol(
  symbol: string,
  currentPriceUsd: number
): PriceAlert[] {
  ensureLoaded();
  if (!Number.isFinite(currentPriceUsd) || currentPriceUsd <= 0) return [];
  const cleanSym = String(symbol || '').toUpperCase().trim();
  if (!cleanSym) return [];

  const triggeredNow: PriceAlert[] = [];
  const nowIso = new Date().toISOString();

  for (let i = 0; i < alertsStore.length; i++) {
    const alert = alertsStore[i];
    if (!alert.active || alert.triggered || alert.symbol !== cleanSym) continue;
    const hit =
      alert.direction === 'above'
        ? currentPriceUsd >= alert.targetPriceUsd
        : currentPriceUsd <= alert.targetPriceUsd;

    if (hit) {
      const updated: PriceAlert = {
        ...alert,
        active: false,
        triggered: true,
        triggeredAt: nowIso,
        triggeredPriceUsd: currentPriceUsd
      };
      alertsStore[i] = updated;
      triggeredNow.push(updated);
    }
  }

  if (triggeredNow.length > 0) {
    persistAlerts();
  }

  return triggeredNow;
}
