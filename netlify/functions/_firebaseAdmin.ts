import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminApp() {
  const existing = getApps();
  if (existing.length) return existing[0];

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim().replace(/^"(.*)"$/, '$1');

  let privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim();
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

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

export function adminDb() {
  return getFirestore(getAdminApp());
}

export function adminAuth() {
  return getAuth(getAdminApp());
}
