import { initializeApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from 'firebase/auth';
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  ReCaptchaEnterpriseProvider,
  getToken as appCheckToken,
} from 'firebase/app-check';
export const firebaseConfig = {
  apiKey: 'AIzaSyCHqWlqPaz1J117_vdm8NkH3koqcOGvkzw',
  authDomain: 'sales-drone-avinya.firebaseapp.com',
  projectId: 'sales-drone-avinya',
  storageBucket: 'sales-drone-avinya.firebasestorage.app',
  messagingSenderId: '510928501696',
  appId: '1:510928501696:web:51489a43bc139eab55e625',
  measurementId: 'G-7LZPTNS713',
};
export const emulator = import.meta.env.VITE_USE_EMULATORS === 'true';
const app = initializeApp(
  emulator
    ? {
        ...firebaseConfig,
        projectId: 'demo-salesdrone',
        authDomain: 'localhost',
      }
    : firebaseConfig,
);
export const auth = getAuth(app);
if (emulator)
  connectAuthEmulator(
    auth,
    `http://${window.location.hostname === 'localhost' ? 'localhost' : '127.0.0.1'}:9099`,
    { disableWarnings: true },
  );
const siteKey = import.meta.env.VITE_FIREBASE_APPCHECK_KEY;
const appCheck =
  siteKey && !emulator
    ? initializeAppCheck(app, {
        provider:
          import.meta.env.VITE_FIREBASE_APPCHECK_PROVIDER === 'enterprise'
            ? new ReCaptchaEnterpriseProvider(siteKey)
            : new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true,
      })
    : null;
export async function attestation() {
  return appCheck ? (await appCheckToken(appCheck)).token : null;
}
export const login = () => signInWithPopup(auth, new GoogleAuthProvider());
export const redirectLogin = () =>
  signInWithRedirect(auth, new GoogleAuthProvider());
export const finishRedirect = () => getRedirectResult(auth);
export default app;
