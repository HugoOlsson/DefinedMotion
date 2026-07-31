import { mathjax } from 'mathjax-full/js/mathjax'
import { TeX } from 'mathjax-full/js/input/tex'
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js';
import { SVG } from 'mathjax-full/js/output/svg'
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor'
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html'


const adaptor = liteAdaptor()
RegisterHTMLHandler(adaptor)

const tex = new TeX({ packages: AllPackages.filter(
  (packageName) => packageName !== 'noerrors' && packageName !== 'noundefined'
),
  macros: {
    // \dmClass{tag}{...} -> \class{dm-tag}{...}
    dmClass: ['{\\class{dm-#1}{#2}}', 2],
  },
  formatError: (_jax, error) => {
    throw error
  },
 })
const svgOut = new SVG({ fontCache: 'none' })
const doc = mathjax.document('', { InputJax: tex, OutputJax: svgOut })

export function latexToSVG(
  latex: string,
  { display = true } = {}
): string {
  const node = doc.convert(latex, { display, em: 16, ex: 8, scale: 1 });
  adaptor.removeAttribute(node, 'width');
  adaptor.removeAttribute(node, 'height');
  adaptor.removeAttribute(node, 'style');
  const raw = adaptor.innerHTML(node).trim();
  return prepareMathJaxSVG(raw); // <- resolves currentColor per element
}


// Minimal, SVGLoader-friendly prep for MathJax output
export function prepareMathJaxSVG(svg: string): string {
  const doc  = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = doc.documentElement;

  // helper: is element inside <defs>?
  const inDefs = (el: Element | null): boolean =>
    !!el && (el.tagName.toLowerCase() === 'defs' || inDefs(el.parentElement));

  // 1) Inline only <use> NOT in <defs>
  let changed = true;
  while (changed) {
    changed = false;
    const uses = Array.from(root.querySelectorAll('use')).filter(u => !inDefs(u));
    for (const u of uses) {
      const href = u.getAttribute('href') || u.getAttribute('xlink:href');
      if (!href || !href.startsWith('#')) continue;
      const ref = root.querySelector<SVGGraphicsElement>(href);
      if (!ref) continue;

      const clone = ref.cloneNode(true) as SVGGraphicsElement;

      // compose transforms: ref ∘ use ∘ translate(x,y)
      const x = parseFloat(u.getAttribute('x') || '0') || 0;
      const y = parseFloat(u.getAttribute('y') || '0') || 0;
      const useTf = u.getAttribute('transform') || '';
      const addTf = (x || y) ? ` translate(${x},${y})` : '';
      const baseTf = clone.getAttribute('transform') || '';
      const tf = `${baseTf} ${useTf}${addTf}`.trim();
      if (tf) clone.setAttribute('transform', tf);

      // copy presentation attrs from <use>
      for (const a of ['fill','stroke','stroke-width','stroke-linejoin','stroke-linecap',
                       'opacity','fill-opacity','stroke-opacity']) {
        const v = u.getAttribute(a);
        if (v != null) clone.setAttribute(a, v);
      }

      u.replaceWith(clone);
      changed = true;
    }
  }

  // nearest inherited CSS color (MathJax uses style="color:...")
  const nearestColor = (el: Element | null): string | null => {
    while (el) {
      const attr = el.getAttribute('color');
      if (attr) return attr;
      const style = el.getAttribute('style');
      if (style) {
        const m = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(style);
        if (m) return m[1].trim();
      }
      el = el.parentElement;
    }
    return null;
  };

  // turn rgba(r,g,b,a) into rgb(r,g,b) + *-opacity (SVGLoader reads these)
  const splitRgbaToAttrs = (
    el: SVGElement,
    attr: 'fill'|'stroke',
    opacityAttr: 'fill-opacity'|'stroke-opacity'
  ) => {
    const v = el.getAttribute(attr);
    if (!v) return;
    const m = v.match(/rgba\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\)/i);
    if (!m) return;
    const r = Math.max(0, Math.min(255, Math.round(+m[1])));
    const g = Math.max(0, Math.min(255, Math.round(+m[2])));
    const b = Math.max(0, Math.min(255, Math.round(+m[3])));
    const a = Math.max(0, Math.min(1, +m[4]));
    el.setAttribute(attr, `rgb(${r},${g},${b})`);
    const prev = el.getAttribute(opacityAttr);
    const p = prev != null ? +prev : 1;
    el.setAttribute(opacityAttr, String(p * a));
  };

  // 2) Resolve color inheritance + 3) preserve alpha
  const DRAWABLE = 'path,rect,circle,ellipse,polygon,polyline,line';
  root.querySelectorAll<SVGElement>(DRAWABLE).forEach(el => {
    const f = el.getAttribute('fill');
    if (f === 'currentColor' || f == null) {
      const c = nearestColor(el);
      if (c) el.setAttribute('fill', c);
    }
    const s = el.getAttribute('stroke');
    if (s === 'currentColor') {
      const c = nearestColor(el);
      if (c) el.setAttribute('stroke', c);
    }
    splitRgbaToAttrs(el, 'fill',   'fill-opacity');
    splitRgbaToAttrs(el, 'stroke', 'stroke-opacity');
  });

  return new XMLSerializer().serializeToString(root);
}


