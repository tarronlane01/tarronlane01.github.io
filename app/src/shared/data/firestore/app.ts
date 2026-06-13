/**
 * Firebase App Configuration
 *
 * Initializes the Firebase app instance.
 */

import { initializeApp } from 'firebase/app'

// For a SPA on GitHub Pages, this config is bundled and visible in the client — that's expected.
// Secure the key in Google Cloud Console with API key restrictions (HTTP referrer for your domain).
const firebaseConfig = {
  apiKey: 'AIzaSyCfvR8bEeW2CXdD31Ec34doRNThnbryXJo',
  authDomain: 'budget-tkl.firebaseapp.com',
  projectId: 'budget-tkl',
  storageBucket: 'budget-tkl.firebasestorage.app',
  messagingSenderId: '631248313026',
  appId: '1:631248313026:web:36574d789a42b2d102f95b',
}

const app = initializeApp(firebaseConfig)

export default app

