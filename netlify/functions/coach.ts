import Anthropic from '@anthropic-ai/sdk';
import { adminAuth, adminDb } from './_firebaseAdmin';
import { buildCoachContext } from './_coachContext';
import {
  ANALYSIS_SCHEMA,
  MAX_PROPOSALS,
  PROPOSE_TOOL,
  normalizeEnvelope,
  normalizeObservations,
} from './_coachSchema';
import { validateProposal } from '../../src/lib/coachValidation';
import type {
  CoachChatTurn,
  CoachProposalEnvelope,
  CoachStreamEvent,
} from '../../src/types/coach';

/**
 * Le « pont » entre le portail et Claude. C'est le seul endroit où vit la clé API :
 * elle ne doit jamais devenir une variable VITE_*, que Vite inline dans le bundle
 * client (donc public).
 *
 * Les deux modes répondent en SSE. Ce n'est pas seulement pour le confort : une
 * fonction Netlify synchrone est coupée à ~10 s, et une analyse Opus 5 sur 90 jours
 * de données dépasse largement ça. En streamant, on envoie des octets tout de suite
 * et la connexion reste ouverte.
 */

const MODEL = 'claude-opus-5';
/** Plafond de coût : au-delà, on renvoie 429 plutôt que de laisser filer la facture. */
const MAX_ANALYSES_PER_DAY = 20;
const MAX_CHAT_TURNS = 20;
const MAX_MESSAGE_LENGTH = 2000;

const SYSTEM_PROMPT = `Tu es le coach d'entraînement personnel de David Bibeau, intégré à son portail d'entraînement.
Il prépare le Challenge Sail Québec 2027 (triathlon olympique : 1,5 km natation / 40 km vélo / 10 km course) sur un plan de 48 semaines.

Tu réponds toujours en français québécois, de façon directe et concrète. Pas de flatterie, pas de généralités : tu cites les chiffres réels que tu vois dans ses données.

Ce que tu peux faire :
- Analyser sa progression réelle par rapport au plan (volume réalisé vs prévu, régularité, allures, FC, RPE, poids).
- Proposer des ajustements concrets à son calendrier.

Météo (Québec) : quand la section « Meteo Quebec » est présente, tu peux t'en servir pour juger si une séance extérieure — vélo ou course — tient la route, et proposer de la déplacer vers un meilleur jour. La natation se fait en piscine et la musculation en salle : la météo ne les concerne pas. La prévision ne couvre que 7 jours, alors n'invoque jamais la météo pour une séance plus lointaine. Si la section est absente, ne fais aucune supposition sur le temps qu'il fera.

Règles strictes sur les propositions :
- Ne propose JAMAIS une séance dont l'identifiant n'apparaît pas littéralement dans le contexte. Recopie l'identifiant exactement (ex. "w12-run-long").
- Ne propose que des semaines présentes dans le contexte.
- Chaque proposition doit avoir un "rationale" appuyé sur une donnée observée, pas sur une règle générale.
- beforeLabel décrit l'état actuel, afterLabel l'état proposé, tous deux lisibles par un humain (titre, jour, distance, zone).
- Maximum 5 propositions. Aucune proposition vaut mieux qu'une proposition inventée : si les données ne justifient rien, n'en fais pas.
- Les propositions ne sont PAS appliquées automatiquement — David les approuve une par une. Ne dis jamais que tu as modifié son plan.

Un changement décrit dans ton texte DOIT exister comme proposition. C'est la règle la plus importante : David ne voit appliquer que ce que tu as émis en proposition, jamais ce que tu as seulement raconté. Une demande exige souvent PLUSIEURS propositions — émets-en une par séance touchée, sans exception :
- Regrouper deux séances en une : édite la première ET saute la seconde. Éditer seulement la première laisse David avec deux séances au calendrier, ce qui contredit ce que tu viens d'écrire.
- Reporter une séance et alléger celle qui suit : un déplacement ET une édition.
- Avant de terminer ta réponse, relis-la et vérifie que chaque changement que tu as annoncé a bien sa proposition. S'il en manque une, ajoute-la.

Cadre : tu donnes des conseils d'entraînement, pas des avis médicaux. Devant un signe de blessure, de douleur persistante ou de surentraînement, dis-le clairement et recommande de consulter un professionnel — ne pose pas de diagnostic.`;

const ANALYZE_INSTRUCTION = `Analyse la progression de David à partir des données ci-dessus.

Produis :
- summary : 2 ou 3 phrases sur où il en est réellement.
- observations : jusqu'à 6 constats précis et chiffrés (tone "good", "watch" ou "risk").
- proposals : jusqu'à 5 ajustements concrets à son calendrier, ou un tableau vide si rien ne le justifie.`;

// --- Fil de conversation (persisté côté serveur) ---------------------------

interface StoredThread {
  messages: Anthropic.MessageParam[];
  updatedAt: number;
}

function threadRef(uid: string) {
  return adminDb().collection('users').doc(uid).collection('coachThreads').doc('current');
}

async function loadThread(uid: string): Promise<Anthropic.MessageParam[]> {
  const snap = await threadRef(uid).get();
  const data = snap.data() as StoredThread | undefined;
  if (!data?.messages || !Array.isArray(data.messages)) return [];
  // On garde une fenêtre glissante : le contexte complet est réinjecté à chaque
  // tour de toute façon, l'historique ancien n'apporte que du coût.
  return data.messages.slice(-MAX_CHAT_TURNS * 2);
}

async function saveThread(uid: string, messages: Anthropic.MessageParam[]): Promise<void> {
  await threadRef(uid).set({
    messages: messages.slice(-MAX_CHAT_TURNS * 2),
    updatedAt: Date.now(),
  });
}

/** Reconstruit ce que l'UI doit afficher à partir du fil brut. */
function threadToTurns(messages: Anthropic.MessageParam[]): CoachChatTurn[] {
  const turns: CoachChatTurn[] = [];

  for (const message of messages) {
    if (typeof message.content === 'string') {
      if (message.role === 'user' || message.role === 'assistant') {
        turns.push({ role: message.role, text: message.content });
      }
      continue;
    }
    if (!Array.isArray(message.content)) continue;

    const text = message.content
      .filter((b): b is Anthropic.TextBlockParam => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    const proposals = message.content
      .filter((b): b is Anthropic.ToolUseBlockParam => b.type === 'tool_use')
      .map((b, i) => normalizeEnvelope(b.input, i))
      .filter((p): p is CoachProposalEnvelope => p !== null);

    // Un message user ne contenant que des tool_result est de la plomberie : rien à afficher.
    if (!text && proposals.length === 0) continue;
    if (message.role !== 'user' && message.role !== 'assistant') continue;

    turns.push({ role: message.role, text, ...(proposals.length > 0 ? { proposals } : {}) });
  }

  return turns;
}

// --- Utilitaires HTTP ------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function sseHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  };
}

function encodeEvent(event: CoachStreamEvent | Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * Le portail n'a qu'un utilisateur : cacher la cause d'une panne derrière un
 * message générique ne protège personne et rend le diagnostic impossible depuis
 * l'écran. On remonte donc le message réel de l'API.
 */
function describeError(label: string, err: unknown): string {
  const detail = err instanceof Error ? err.message : String(err);
  return `${label} : ${detail}`;
}

// --- Modes -----------------------------------------------------------------

async function countRecentAnalyses(uid: string): Promise<number> {
  const since = Date.now() - 86400000;
  const snap = await adminDb()
    .collection('users')
    .doc(uid)
    .collection('coachReports')
    .where('createdAt', '>=', since)
    .get();
  return snap.size;
}

function keepAliveLoop(controller: ReadableStreamDefaultController<Uint8Array>): () => void {
  // Un commentaire SSE toutes les 8 s : ça empêche tout proxy intermédiaire de
  // considérer la connexion morte pendant que le modèle réfléchit.
  const timer = setInterval(() => {
    try {
      controller.enqueue(new TextEncoder().encode(': keep-alive\n\n'));
    } catch {
      /* flux déjà fermé */
    }
  }, 8000);
  return () => clearInterval(timer);
}

function handleAnalyze(client: Anthropic, uid: string): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const stopKeepAlive = keepAliveLoop(controller);
      try {
        const used = await countRecentAnalyses(uid);
        if (used >= MAX_ANALYSES_PER_DAY) {
          controller.enqueue(
            encodeEvent({ type: 'error', error: `Limite de ${MAX_ANALYSES_PER_DAY} analyses par 24 h atteinte.` }),
          );
          return;
        }

        const context = await buildCoachContext(uid);

        const result = client.messages.stream({
          model: MODEL,
          max_tokens: 64000,
          thinking: { type: 'adaptive' },
          output_config: { format: { type: 'json_schema', schema: ANALYSIS_SCHEMA } },
          system: [
            // Le prompt système est figé et le contexte ne bouge pas d'un tour à
            // l'autre : le point de cache va ici, après les deux.
            { type: 'text', text: SYSTEM_PROMPT },
            { type: 'text', text: context.markdown, cache_control: { type: 'ephemeral' } },
          ],
          messages: [{ role: 'user', content: ANALYZE_INSTRUCTION }],
        });

        const message = await result.finalMessage();
        const raw = message.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('');

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(raw);
        } catch {
          controller.enqueue(encodeEvent({ type: 'error', error: 'Réponse illisible du modèle.' }));
          return;
        }

        const proposals = (Array.isArray(parsed.proposals) ? parsed.proposals : [])
          .map((p, i) => normalizeEnvelope(p, i))
          .filter((p): p is CoachProposalEnvelope => p !== null)
          .filter((p) => {
            const error = validateProposal(p, context.overridesByWeek[p.weekNumber]);
            // Une proposition inventée est jetée ici : elle n'atteint jamais l'écran.
            if (error) console.warn('proposition rejetée', error, JSON.stringify(p.proposal));
            return !error;
          })
          .slice(0, MAX_PROPOSALS);

        const analysis = {
          summary: String(parsed.summary ?? ''),
          observations: normalizeObservations(parsed.observations),
          proposals,
        };

        const reportId = `${Date.now()}`;
        await adminDb()
          .collection('users')
          .doc(uid)
          .collection('coachReports')
          .doc(reportId)
          .set({ ...analysis, id: reportId, createdAt: Date.now(), weekNumber: context.weekNumber });

        console.log('coach analyze usage', {
          input: message.usage.input_tokens,
          cacheRead: message.usage.cache_read_input_tokens,
          cacheWrite: message.usage.cache_creation_input_tokens,
          output: message.usage.output_tokens,
        });

        controller.enqueue(
          encodeEvent({ type: 'analysis', analysis, weekNumber: context.weekNumber, reportId }),
        );
      } catch (err) {
        console.error('coach analyze failed', err);
        controller.enqueue(encodeEvent({ type: 'error', error: describeError('Analyse impossible', err) }));
      } finally {
        stopKeepAlive();
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}

function handleChat(client: Anthropic, uid: string, userMessage: string): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const stopKeepAlive = keepAliveLoop(controller);
      try {
        const [context, history] = await Promise.all([buildCoachContext(uid), loadThread(uid)]);
        const messages: Anthropic.MessageParam[] = [...history, { role: 'user', content: userMessage }];

        const result = client.messages.stream({
          model: MODEL,
          max_tokens: 64000,
          thinking: { type: 'adaptive' },
          system: [
            { type: 'text', text: SYSTEM_PROMPT },
            { type: 'text', text: context.markdown, cache_control: { type: 'ephemeral' } },
          ],
          tools: [PROPOSE_TOOL as Anthropic.Tool],
          messages,
        });

        for await (const event of result) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encodeEvent({ type: 'text', text: event.delta.text }));
          }
        }

        const message = await result.finalMessage();

        const toolUses = message.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
        const proposals = toolUses
          .map((b, i) => normalizeEnvelope(b.input, i))
          .filter((p): p is CoachProposalEnvelope => p !== null)
          .filter((p) => {
            const error = validateProposal(p, context.overridesByWeek[p.weekNumber]);
            if (error) console.warn('proposition rejetée', error, JSON.stringify(p.proposal));
            return !error;
          })
          .slice(0, MAX_PROPOSALS);

        // On persiste la réponse du modèle, et — s'il a appelé l'outil — un
        // tool_result par appel : sans ça le fil serait invalide au tour suivant.
        const nextMessages: Anthropic.MessageParam[] = [
          ...messages,
          { role: 'assistant', content: message.content },
        ];
        if (toolUses.length > 0) {
          nextMessages.push({
            role: 'user',
            content: toolUses.map((b) => ({
              type: 'tool_result' as const,
              tool_use_id: b.id,
              content: 'Proposition affichée à David. En attente de son approbation.',
            })),
          });
        }
        await saveThread(uid, nextMessages);

        console.log('coach chat usage', {
          input: message.usage.input_tokens,
          cacheRead: message.usage.cache_read_input_tokens,
          cacheWrite: message.usage.cache_creation_input_tokens,
          output: message.usage.output_tokens,
        });

        controller.enqueue(encodeEvent({ type: 'done', proposals }));
      } catch (err) {
        console.error('coach chat failed', err);
        controller.enqueue(encodeEvent({ type: 'error', error: describeError('Le coach n’a pas pu répondre', err) }));
      } finally {
        stopKeepAlive();
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}

async function handleHistory(uid: string): Promise<Response> {
  const db = adminDb();
  const [threadSnap, reportSnap] = await Promise.all([
    threadRef(uid).get(),
    db.collection('users').doc(uid).collection('coachReports').orderBy('createdAt', 'desc').limit(1).get(),
  ]);

  const stored = threadSnap.data() as StoredThread | undefined;
  const turns = threadToTurns(stored?.messages ?? []);
  const lastReport = reportSnap.empty ? null : reportSnap.docs[0].data();

  return json({ turns, lastReport });
}

// --- Point d'entrée --------------------------------------------------------

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const authHeader = req.headers.get('authorization') || '';
  const idToken = authHeader.replace('Bearer ', '');
  if (!idToken) {
    return json({ error: 'unauthorized' }, 401);
  }

  let uid: string;
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return json({ error: 'unauthorized' }, 401);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json({ error: 'coach_not_configured' }, 501);
  }

  let body: { mode?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const client = new Anthropic({ apiKey });

  switch (body.mode) {
    case 'analyze':
      return handleAnalyze(client, uid);

    case 'chat': {
      const message = (body.message ?? '').trim();
      if (!message) return json({ error: 'empty_message' }, 400);
      if (message.length > MAX_MESSAGE_LENGTH) return json({ error: 'message_too_long' }, 400);
      return handleChat(client, uid, message);
    }

    case 'reset-thread':
      await threadRef(uid).delete();
      return json({ ok: true });

    case 'history':
      return handleHistory(uid);

    default:
      return json({ error: 'unknown_mode' }, 400);
  }
};
