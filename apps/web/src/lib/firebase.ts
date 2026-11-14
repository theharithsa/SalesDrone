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
export const preproductionBuild = import.meta.env.VITE_DEPLOYMENT_ENVIRONMENT === 'pre-production';
const preproductionSite = 'sales-drone-avinya-preprod';
const allowedPreproductionHosts = new Set([
  preproductionSite + '.web.app', preproductionSite + '.firebaseapp.com',
]);
if (preproductionBuild && (!allowedPreproductionHosts.has(window.location.hostname) ||
    !import.meta.env.VITE_FIREBASE_APPCHECK_KEY || import.meta.env.VITE_USE_EMULATORS === 'true')) {
  throw new Error('Pre-production build requires its Hosting origin and App Check key');
}
export const firebaseConfig = {
  apiKey: 'AIzaSyCHqWlqPaz1J117_vdm8NkH3koqcOGvkzw',
  authDomain: preproductionBuild ? window.location.hostname : 'sales-drone-avinya.firebaseapp.com',
  projectId: 'sales-drone-avinya',
  storageBucket: preproductionBuild ? 'sales-drone-avinya-preprod-files' : 'sales-drone-avinya.firebasestorage.app',
  messagingSenderId: '510928501696',
  appId: preproductionBuild ? '1:510928501696:web:c79580e633cb1a6b55e625' : '1:510928501696:web:51489a43bc139eab55e625',
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
