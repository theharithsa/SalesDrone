/* eslint prefer-rest-params: off -- Google Tag expects Arguments objects in its command queue. */
import { usageAnalyticsEnabled, usagePage } from './lib/usage-analytics';

const view = usagePage(new URLSearchParams(window.location.search).get('page'));
if (window.parent !== window && usageAnalyticsEnabled() && view) {
  const measurementId = 'G-7LZPTNS713';
  const tagWindow = window as Window & { dataLayer?: IArguments[] };
  const dataLayer: IArguments[] = [];
  tagWindow.dataLayer = dataLayer;
  function gtag(..._args: unknown[]) {
    dataLayer.push(arguments);
  }

  gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  gtag('js', new Date());
  gtag('config', measurementId, {
    page_location: new URL(`/${view.id}`, window.location.origin).href,
    page_title: view.title,
    page_referrer: '',
    ignore_referrer: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    cookie_expires: 7776000,
    cookie_update: false,
  });
  const tag = document.createElement('script');
  tag.async = true;
  tag.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.append(tag);
}
