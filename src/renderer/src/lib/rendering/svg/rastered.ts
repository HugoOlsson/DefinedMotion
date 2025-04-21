import { mathjax } from 'mathjax-full/js/mathjax'
import { TeX } from 'mathjax-full/js/input/tex'
import { SVG } from 'mathjax-full/js/output/svg'
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor'
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html'

const adaptor = liteAdaptor()
RegisterHTMLHandler(adaptor)

const tex = new TeX({ packages: ['base', 'ams'] })
const svg = new SVG({ fontCache: 'none' }) // avoid defs entirely
// Option A: create one document and clear state between runs:
const html = mathjax.document('', { InputJax: tex, OutputJax: svg })

export function latexToSVG(latex: string, scale = 1): string {
  // If you prefer fresh state each time, uncomment below:
  // const html = mathjax.document('', { InputJax: tex, OutputJax: svg });

  const node = html.convert(latex, {
    display: true,
    em: 16,
    ex: 8,
    scale
  })

  // Optionally clear any stateful counters in tex or html here
  // tex.clear();

  // Strip unwanted attributes directly via adaptor
  adaptor.removeAttribute(node, 'width')
  adaptor.removeAttribute(node, 'height')
  adaptor.removeAttribute(node, 'style')

  // Serialize and tidy up
  let svgString = adaptor.innerHTML(node)
  svgString = svgString
    .replace(/<g class="MJX_[^"]*"[^>]*>/g, '<g>')
    .replace(/\s{2,}/g, ' ')
    .trim()

  return svgString
}
