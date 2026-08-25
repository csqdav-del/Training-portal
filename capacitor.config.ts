import type { CapacitorConfig } from '@capacitor/cli';

/**
 * L'app Android n'est qu'une coquille autour du même build Vite que le site.
 * Sa seule raison d'être : Health Connect est un magasin de données local à
 * l'appareil, sans API serveur — il faut donc du code natif pour le lire.
 */
const config: CapacitorConfig = {
  appId: 'com.davidbibeau.trainingportal',
  appName: 'Training Portal',
  webDir: 'dist',
  android: {
    // Le site est servi depuis le bundle local (capacitor://localhost) : les
    // appels aux fonctions Netlify doivent viser VITE_API_BASE (voir .env).
    allowMixedContent: false,
  },
  plugins: {
    FirebaseAuthentication: {
      // La connexion Google passe par le SDK natif : signInWithPopup ne
      // fonctionne pas dans une WebView.
      skipNativeAuth: false,
      providers: ['google.com'],
    },
  },
};

export default config;
