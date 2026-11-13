import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Theme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';
import { HStack, VStack } from '@astryxdesign/core/Layout';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { Link } from '@astryxdesign/core/Link';

export const repository = 'https://github.com/theharithsa/SalesDrone';
export const heading = (level, content, className) =>
  h(Heading, { level, weight: 'normal', className }, content);
export const paragraph = (content, className) =>
  h(Text, { as: 'p', type: 'body', className }, content);
export const link = (href, content, props = {}) => h(Link, { href, ...props }, content);
export const buttonLink = (href, label, variant = 'secondary') => h(Button, { href, label, variant, className: 'wrap-button' },
    h('span', { className: 'wrap-button-label' }, label));
export function page(title, current, content, { detail = false, filter = false, handbook = false, version, stylesheet: extraStylesheet } = {}) {
  const base = detail ? '../' : '';
  const navigation = [['Roadmap', 'roadmap.html'], ['Release notes', 'releases.html'], ['Handbook', 'product.html'], ['SDLC', 'sdlc.html']];
  const stylesheet = (path) => h('link', { key: path, rel: 'stylesheet', href: base + path });
  return '<!doctype html>\n' + renderToStaticMarkup(h('html', { lang: 'en', 'data-theme': 'light' },
    h('head', null,
      h('meta', { charSet: 'utf-8' }),
      version && h('meta', { name: 'salesdrone-version', content: version }),
      h('meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' }),
      h('title', null, title + ' | SalesDrone'),
      h('link', { rel: 'icon', href: base + 'assets/brand/icon.svg' }),
      ['astryx/reset.css', 'astryx/core.css', 'astryx/neutral.css', 'whats-new.css'].map(stylesheet),
      extraStylesheet && stylesheet(extraStylesheet),
      filter && h('script', { src: 'release-filter.js', defer: true }),
      handbook && h('link', { rel: 'stylesheet', href: 'product.css' }),
      handbook && h('script', { src: 'product-search.js', defer: true })),
    h('body', null, h(Theme, { theme: neutralTheme, mode: 'light' },
      h('a', { className: 'skip-link', href: '#content' }, 'Skip to content'),
      h('header', { className: 'updates-header' },
        h(HStack, { className: 'shell header-content', justify: 'between', align: 'center', wrap: 'wrap', gap: 3 },
          h(HStack, { as: 'a', href: base + 'index.html', className: 'brand', align: 'center', gap: 2 },
            h('img', { src: base + 'assets/brand/salesdrone-mark.png', width: 32, height: 32, alt: '' }),
            h(Text, { weight: 'semibold' }, 'SalesDrone')),
          h(HStack, { as: 'nav', 'aria-label': 'Documentation', className: 'updates-nav', gap: 1, wrap: 'wrap' },
            navigation.map(([label, href]) => h('a', {
              key: href, href: base + href,
              'aria-current': current === label ? (detail ? 'location' : 'page') : undefined,
            }, label))))),
      h(VStack, { as: 'main', id: 'content', tabIndex: -1, className: 'shell updates-main', gap: 8 }, content),
      h(HStack, { as: 'footer', className: 'shell updates-footer', justify: 'between', wrap: 'wrap', gap: 3 },
        h(Text, { type: 'supporting', color: 'secondary' }, 'SalesDrone by AvinyaTech'),
        h(HStack, { gap: 4, wrap: 'wrap' }, link(base + 'index.html', 'Product overview'), link(base + 'sdlc.html', 'SDLC guide'), link(repository, 'GitHub')))))));
}
