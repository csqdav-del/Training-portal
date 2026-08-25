import { auth } from '../firebase';
import type {
  CoachAnalysis,
  CoachChatTurn,
  CoachProposalEnvelope,
  CoachReport,
} from '../types/coach';

/**
 * Client du pont Coach. Même contrainte que healthConnect.ts : en natif la
 * WebView sert capacitor://localhost, donc une URL relative ne pointerait pas
 * vers Netlify — VITE_API_BASE doit être défini pour le build Android.
 */
const API_BASE = import.meta.env.VITE_API_BASE || '';
const ENDPOINT = `${API_BASE}/.netlify/functions/coach`;

export class CoachNotConfiguredError extends Error {
  constructor() {
    super('coach_not_configured');
    this.name = 'CoachNotConfiguredError';
  }
}

async function post(body: unknown): Promise<Response> {
  const user = auth.currentUser;
  if (!user) throw new Error('Non authentifié.');
  const idToken = await user.getIdToken();

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.status === 501) throw new CoachNotConfiguredError();
  if (!res.ok) throw new Error(`Le coach a répondu ${res.status}.`);
  return res;
}

/**
 * Lit un flux SSE et rend chaque événement JSON. Les lignes commençant par `:`
 * sont des keep-alive envoyés pendant que le modèle réfléchit — on les ignore.
 */
async function* readEvents(res: Response): AsyncGenerator<Record<string, unknown>> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error('Flux de réponse vide.');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Les événements SSE sont séparés par une ligne vide.
    let sep = buffer.indexOf('\n\n');
    while (sep !== -1) {
      const chunk = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        try {
          yield JSON.parse(payload) as Record<string, unknown>;
        } catch {
          /* fragment illisible — on saute plutôt que de casser le flux */
        }
      }
      sep = buffer.indexOf('\n\n');
    }
  }
}

export interface AnalyzeResult {
  analysis: CoachAnalysis;
  weekNumber: number;
  reportId: string;
}

/** Lance une analyse complète. Le flux est consommé jusqu'à l'événement final. */
export async function requestAnalysis(): Promise<AnalyzeResult> {
  const res = await post({ mode: 'analyze' });

  for await (const event of readEvents(res)) {
    if (event.type === 'error') throw new Error(String(event.error));
    if (event.type === 'analysis') {
      return {
        analysis: event.analysis as CoachAnalysis,
        weekNumber: Number(event.weekNumber),
        reportId: String(event.reportId),
      };
    }
  }

  throw new Error('Le coach n’a rien renvoyé.');
}

export interface ChatCallbacks {
  onText: (chunk: string) => void;
  onProposals: (proposals: CoachProposalEnvelope[]) => void;
}

/** Envoie un message et diffuse la réponse au fil de sa génération. */
export async function sendChatMessage(message: string, callbacks: ChatCallbacks): Promise<void> {
  const res = await post({ mode: 'chat', message });

  for await (const event of readEvents(res)) {
    if (event.type === 'error') throw new Error(String(event.error));
    if (event.type === 'text') callbacks.onText(String(event.text));
    if (event.type === 'done') callbacks.onProposals((event.proposals ?? []) as CoachProposalEnvelope[]);
  }
}

export async function loadCoachHistory(): Promise<{ turns: CoachChatTurn[]; lastReport: CoachReport | null }> {
  const res = await post({ mode: 'history' });
  return res.json();
}

export async function resetCoachThread(): Promise<void> {
  await post({ mode: 'reset-thread' });
}
