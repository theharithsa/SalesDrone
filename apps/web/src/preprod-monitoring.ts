import { finishAction } from './lib/rum-runtime';
import './preprod-monitoring.css';

const origin = 'https://sales-drone-avinya-preprod.web.app';
const agentUrl = 'https://js-cdn.dynatrace.com/jstag/18b1df4492a/bf12470wrz/3209d1381b5546b4_complete.js';

type CheckAgent = NonNullable<Parameters<typeof finishAction>[0]> & {
  disableSessionReplay: () => void;
  setAutomaticActionDetection: (enabled: boolean) => void;
  enable: () => void;
  isEnabled: () => boolean;
  enterAction: (name: string) => number;
  sendBeacon: (forceSync: boolean, preview: boolean, killUnfinished: boolean) => void;
};

const button = document.querySelector<HTMLButtonElement>('#send-check')!;
const status = document.querySelector<HTMLElement>('#check-status')!;

async function loadAgent() {
  const script = document.createElement('script');
  script.src = agentUrl;
  script.crossOrigin = 'anonymous';
  const loaded = new Promise<void>((resolve, reject) => {
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Monitoring script unavailable'));
  });
  const timer = window.setTimeout(() => script.dispatchEvent(new Event('error')), 10000);
  try {
    document.head.append(script);
    await loaded;
    for (let attempt = 0; attempt < 20; attempt++) {
      const agent = (window as Window & { dtrum?: CheckAgent }).dtrum;
      if (typeof agent?.isEnabled === 'function' &&
          typeof agent.sendBeacon === 'function' && typeof agent.enterAction === 'function')
        return agent;
      await new Promise(resolve => window.setTimeout(resolve, 250));
    }
    throw Error('Monitoring agent unavailable');
  } finally {
    window.clearTimeout(timer);
  }
}

button.addEventListener('click', async () => {
  button.disabled = true;
  if (location.origin !== origin) {
    status.textContent = 'Open this check on the SalesDrone pre-production site.';
    return;
  }
  status.textContent = 'Loading browser monitoring…';
  try {
    const agent = await loadAgent();
    agent.disableSessionReplay();
    agent.setAutomaticActionDetection(false);
    if (!agent.isEnabled()) agent.enable();
    if (!agent.isEnabled()) throw Error('Monitoring disabled');
    const properties = {
      app_version: __APP_VERSION__,
      build_commit: __PREPROD_BUILD_COMMIT__,
      deployment_environment: 'pre-production',
    };
    for (const action of ['Start pre-production browser check', 'Finish pre-production browser check']) {
      const id = agent.enterAction(action);
      if (id < 0) throw Error('Monitoring action unavailable');
      finishAction(agent, id)(properties);
    }
    agent.sendBeacon(false, false, false);
    status.textContent = 'Browser test queued. Check Dynatrace for the result.';
  } catch {
    status.textContent = 'The browser test could not start. Reload to try again.';
  }
}, { once: true });
