import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { createPrivateKey } from 'node:crypto';

function getAdminApp() {
  const existing = getApps();
  if (existing.length) return existing[0];

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim().replace(/^"(.*)"$/, '$1');

  // Prefer the base64-encoded key: a single unbroken line of safe characters
  // survives copy/paste through a web UI far more reliably than a raw
  // multi-line PEM (dashes, newlines, spaces are all easy to mangle by hand).
  const b64Key = process.env.FIREBASE_PRIVATE_KEY_B64?.trim();
  let privateKey = b64Key
    ? Buffer.from(b64Key, 'base64').toString('utf8')
    : process.env.FIREBASE_PRIVATE_KEY?.trim();

  if (privateKey) {
    // Strip accidental wrapping quotes (common when copy-pasting from the JSON file)
    privateKey = privateKey.replace(/^"(.*)"$/s, '$1');
    // Turn literal "\n" sequences into real newlines (harmless if already real newlines)
    privateKey = privateKey.replace(/\\n/g, '\n');
    // Normalize Windows line endings (Notepad copy/paste) - OpenSSL's PEM decoder
    // can reject "\r\n" line endings inside the base64 body with a cryptic
    // "DECODER routines::unsupported" error.
    privateKey = privateKey.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // Trim each line and drop any accidental blank lines (not valid inside a PEM body)
    privateKey = privateKey
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join('\n');
    privateKey += '\n';
  }

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase Admin credentials: set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in Netlify env vars.',
    );
  }

  if (!privateKey.includes('BEGIN PRIVATE KEY')) {
    console.error('FIREBASE_PRIVATE_KEY diagnostic', {
      length: privateKey.length,
      first30: privateKey.slice(0, 30),
      last30: privateKey.slice(-30),
      hasLiteralBackslashN: privateKey.includes('\\n'),
      hasRealNewline: privateKey.includes('\n'),
    });
    throw new Error('FIREBASE_PRIVATE_KEY does not look like a PEM private key (missing BEGIN PRIVATE KEY marker) — see diagnostic log above.');
  }

  // Re-parse and re-export via Node's own crypto so google-auth-library's JWT
  // signer receives a canonically-formatted PEM. Node 18+/OpenSSL 3.x's DECODER
  // can reject an otherwise-valid but hand-normalized PEM string at sign time
  // ("error:1E08010C:DECODER routines::unsupported"), even when preferRest
  // avoids the gRPC credential path — JWTAccess still signs with crypto.sign()
  // directly on whatever PEM string it's given.
  try {
    privateKey = createPrivateKey(privateKey)
      .export({ type: 'pkcs8', format: 'pem' })
      .toString();
  } catch (err) {
    console.error('FIREBASE_PRIVATE_KEY failed to parse as a private key', err);
    throw new Error('FIREBASE_PRIVATE_KEY is not a valid private key (Node crypto could not parse it).');
  }

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

let firestoreInstance: ReturnType<typeof getFirestore> | undefined;

export function adminDb() {
  if (!firestoreInstance) {
    firestoreInstance = getFirestore(getAdminApp());
    // Netlify's serverless Node runtime hits a known firebase-admin/gRPC + OpenSSL 3.x
    // bug ("error:1E08010C:DECODER routines::unsupported") when the gRPC credential
    // plugin signs requests. REST transport sidesteps that code path entirely.
    firestoreInstance.settings({ preferRest: true });
  }
  return firestoreInstance;
}

export function adminAuth() {
  return getAuth(getAdminApp());
}
