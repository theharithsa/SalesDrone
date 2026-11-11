import { useCallback, useEffect, useRef } from 'react';

const stripCount = 16;
const frameCount = 32;
const duration = 720;
const motionQuery = '(prefers-reduced-motion: reduce)';

// A cylindrical bend moves from the free edge to the spine. Sample its tangent
// at each strip's center so the printed content follows the curve.
function curlAt(distance: number, width: number, progress: number) {
  const radius = width * 0.14;
  const crease = width - (width + Math.PI * radius) * progress;
  const length = Math.max(0, distance - crease);
  const angle = Math.min(Math.PI, length / radius);
  return {
    x: Math.min(distance, crease) + radius * Math.sin(angle) - Math.max(0, length - Math.PI * radius),
    z: radius * (1 - Math.cos(angle)),
    angle,
  };
}

function capturePrint(source: HTMLElement) {
  const template = source.cloneNode(true) as HTMLElement;
  const originals = [source, ...source.querySelectorAll('*')];
  const copies = [template, ...template.querySelectorAll('*')];
  const scrollPositions: { top: number; left: number }[] = [];

  copies.forEach((copy, index) => {
    const original = originals[index];
    if (copy instanceof HTMLInputElement && original instanceof HTMLInputElement) {
      copy.checked = original.checked;
      if (copy.type !== 'file') copy.value = original.value;
    }
    if (copy instanceof HTMLSelectElement && original instanceof HTMLSelectElement) {
      [...copy.options].forEach((option, position) => {
        option.defaultSelected = original.options[position].selected;
      });
    }
    if (copy instanceof HTMLTextAreaElement && original instanceof HTMLTextAreaElement) copy.defaultValue = original.value;
    if (original.scrollTop || original.scrollLeft) {
      copy.setAttribute('data-book-turn-scroll', String(scrollPositions.length));
      scrollPositions.push({ top: original.scrollTop, left: original.scrollLeft });
    }
  });

  // Hidden pages, embedded documents and media do not contribute to the print.
  template.querySelectorAll('[hidden]').forEach((element) => element.replaceChildren());
  template.querySelectorAll('iframe, object, embed, video, audio, script').forEach((element) => element.remove());
  template.inert = true;
  return { template, scrollPositions };
}

function copyPrint(template: HTMLElement, number: number) {
  const print = template.cloneNode(true) as HTMLElement;
  const ids = new Map<string, string>();
  print.querySelectorAll('[id]').forEach((element) => {
    const id = element.id;
    element.id = `book-turn-${number}-${id}`;
    ids.set(id, element.id);
  });
  for (const copy of print.querySelectorAll('svg, svg *')) {
    for (const { name, value } of [...copy.attributes]) {
      const updated = value.replace(/url\(#([^)]*)\)/g, (match, id) =>
        ids.has(id) ? `url(#${ids.get(id)})` : match,
      );
      const fragment = value.startsWith('#') ? ids.get(value.slice(1)) : undefined;
      if (fragment && (name === 'href' || name === 'xlink:href')) copy.setAttribute(name, `#${fragment}`);
      else if (updated !== value) copy.setAttribute(name, updated);
    }
  }
  return print;
}

export function useBookTurn(enabled: boolean) {
  const stop = useRef<() => void>(() => {});

  useEffect(() => () => stop.current(), [enabled]);

  return useCallback((source: HTMLElement, direction: number) => {
    const host = source.parentElement;
    const media = window.matchMedia(motionQuery);
    stop.current();
    if (!enabled || !host || media.matches || !source.animate) return;

    const bounds = source.getBoundingClientRect();
    if (!bounds.width || !source.offsetWidth) return;
    const scale = bounds.width / source.offsetWidth;
    const shell = source.closest('.main-shell');
    const toolbar = shell?.querySelector('.topbar');
    const controls = host.querySelector(':scope > .book-page-controls')
      ?? host.parentElement?.querySelector(':scope > .book-page-controls');
    const navigation = shell?.parentElement?.querySelector('.bottom-nav');
    const toolbarBottom = toolbar && ['sticky', 'fixed'].includes(getComputedStyle(toolbar).position)
      ? toolbar.getBoundingClientRect().bottom
      : 0;
    const navigationTop = navigation?.getClientRects().length
      ? navigation.getBoundingClientRect().top
      : window.innerHeight;
    const top = Math.max(0, bounds.top, toolbarBottom, controls?.getBoundingClientRect().bottom ?? 0);
    const bottom = Math.min(bounds.bottom, navigationTop, window.innerHeight);
    if (bottom <= top) return;

    const width = bounds.width / scale;
    const height = (bottom - top) / scale;
    const tilt = direction > 0 ? -8 : 8;
    const radians = tilt * Math.PI / 180;
    const modelWidth = width * Math.cos(radians) + height * Math.abs(Math.sin(radians));
    const modelHeight = height * Math.cos(radians) + width * Math.abs(Math.sin(radians));
    const stripWidth = modelWidth / stripCount;
    const { template, scrollPositions } = capturePrint(source);
    Object.assign(template.style, {
      width: `${source.offsetWidth}px`,
      height: `${source.offsetHeight}px`,
      margin: '0',
    });
    const layer = document.createElement('div');
    layer.className = 'book-turn-layer';
    layer.inert = true;
    layer.setAttribute('aria-hidden', 'true');
    Object.assign(layer.style, {
      left: `${bounds.left / scale}px`, top: `${top / scale}px`,
      width: `${width}px`, height: `${height}px`,
    });
    const shade = document.createElement('div');
    shade.className = 'book-turn-shade';
    const plane = document.createElement('div');
    plane.className = 'book-turn-plane';
    Object.assign(plane.style, {
      left: `${(width - modelWidth) / 2}px`, top: `${(height - modelHeight) / 2}px`,
      width: `${modelWidth}px`, height: `${modelHeight}px`, transform: `rotateZ(${tilt}deg)`,
    });
    layer.append(shade, plane);

    const strips = Array.from({ length: stripCount }, (_, index) => {
      const strip = document.createElement('div');
      strip.className = 'book-turn-strip';
      const left = index * stripWidth;
      Object.assign(strip.style, { left: `${left}px`, width: `${stripWidth + 0.75}px` });
      const front = document.createElement('div');
      front.className = 'book-turn-front';
      const viewport = document.createElement('div');
      viewport.className = 'book-turn-window';
      const printBounds = {
        left: `${(modelWidth - width) / 2 - left}px`, top: `${(modelHeight - height) / 2}px`,
        width: `${width}px`, height: `${height}px`, transform: `rotateZ(${-tilt}deg)`,
      };
      Object.assign(viewport.style, printBounds);
      const print = copyPrint(template, index);
      viewport.append(print);
      front.append(viewport);
      const back = document.createElement('div');
      back.className = 'book-turn-back';
      const mirror = document.createElement('div');
      mirror.className = 'book-turn-back-mirror';
      const paper = document.createElement('div');
      paper.className = 'book-turn-paper';
      Object.assign(paper.style, printBounds);
      const paperShadow = document.createElement('div');
      paperShadow.className = 'book-turn-paper-shadow';
      paper.append(paperShadow);
      mirror.append(paper);
      back.append(mirror);
      strip.append(front, back);
      plane.append(strip);
      return { strip, viewport, print, paperShadow, center: left + stripWidth / 2 };
    });

    host.append(layer);
    for (const strip of strips) {
      strip.viewport.scrollTop = (top - bounds.top) / scale;
      for (const element of strip.print.querySelectorAll('[data-book-turn-scroll]')) {
        const position = scrollPositions[Number(element.getAttribute('data-book-turn-scroll'))];
        element.scrollTop = position.top;
        element.scrollLeft = position.left;
      }
    }

    const settings = { duration, easing: 'ease-in-out', fill: 'both' } as const;
    const animations = strips.flatMap(({ strip, center, paperShadow }) => {
      const points = Array.from({ length: frameCount + 1 }, (_, frame) =>
        curlAt(direction > 0 ? center : modelWidth - center, modelWidth, frame / frameCount),
      );
      return [
        strip.animate(points.map((point) => {
          const x = direction > 0 ? point.x : modelWidth - point.x;
          return { transform: `translate3d(${x - center}px, 0, ${point.z}px) rotateY(${-point.angle * direction}rad)` };
        }), settings),
        paperShadow.animate(points.map(({ angle }) => ({
          opacity: 0.26 * Math.max(0, Math.sin(angle)),
        })), settings),
      ];
    });
    animations.push(shade.animate([{ opacity: 0 }, { opacity: 0.16, offset: 0.45 }, { opacity: 0 }], settings));

    function clear() {
      if (stop.current !== clear) return;
      stop.current = () => {};
      layer.remove();
      animations.forEach((animation) => animation.cancel());
      media.removeEventListener('change', clear);
      window.removeEventListener('resize', clear);
      window.removeEventListener('scroll', clear);
      shell?.removeEventListener('scroll', clear);
    }
    stop.current = clear;
    media.addEventListener('change', clear);
    window.addEventListener('resize', clear);
    window.addEventListener('scroll', clear);
    shell?.addEventListener('scroll', clear);
    void animations[0].finished.then(clear, clear);
  }, [enabled]);
}
