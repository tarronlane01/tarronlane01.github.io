/**
 * Firebase App Configuration
 *
 * Initializes the Firebase app instance.
 */

import { initializeApp } from 'firebase/app'

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

