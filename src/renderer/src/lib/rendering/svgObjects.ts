import { interpolate } from 'flubber' // ES6
import * as THREE from 'three'
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'
import { MeshLine, MeshLineMaterial } from 'three.meshline'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'

const loader = new SVGLoader()

export const getSVGInterpolator = (
  startSVG: string,
  endSVG: string
): ((progress: number) => string) => interpolate(startSVG, endSVG)

export const createSVGObject = (SVG: string, width: number) => {
  const loader = new SVGLoader()
  const svgData = loader.parse(SVG)
  const svgGroup = new THREE.Group()
  const materials = {}

  svgData.paths.forEach((path) => {
    const style = path.userData.style

    // 1. Handle Filled Areas
    if (style.fill !== 'none') {
      const fillColor = new THREE.Color(style.fill)
      const fillOpacity = style.fillOpacity ? parseFloat(style.fillOpacity) : 1
      const materialKey = `fill-${fillColor.getHexString()}-${fillOpacity}`

      if (!materials[materialKey]) {
        materials[materialKey] = new THREE.MeshBasicMaterial({
          color: fillColor,
          opacity: fillOpacity,
          transparent: fillOpacity < 1,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      }

      // Create shapes with proper hole handling
      const shapes = path.toShapes(true)
      shapes.forEach((shape) => {
        const geometry = new THREE.ShapeGeometry(shape, 100)
        const mesh = new THREE.Mesh(geometry, materials[materialKey])
        svgGroup.add(mesh)
      })
    }

    // Handle Strokes with Line2
    if (style.stroke && style.stroke !== 'none') {
      const strokeColor = new THREE.Color(style.stroke)
      const strokeWidth = parseFloat(style.strokeWidth) || 1
      const strokeOpacity = style.strokeOpacity ? parseFloat(style.strokeOpacity) : 1
      const materialKey = `stroke-${strokeColor.getHexString()}-${strokeOpacity}-${strokeWidth}`

      path.subPaths.forEach((subPath) => {
        const points = subPath.getPoints(100).flatMap((p) => [p.x, p.y, 0])
        console.log('SHOULD DRAW STROKE', points)
        const geometry = new MeshLine()
        geometry.setPoints(points)
        if (!materials[materialKey]) {
          materials[materialKey] = new MeshLineMaterial({
            color: strokeColor,
            linewidth: strokeWidth,
            transparent: strokeOpacity < 1,
            opacity: strokeOpacity,
            depthTest: false,
            depthWrite: false
          })
        }
        const line = new THREE.Mesh(geometry, materials[materialKey])
        console.log('line', line)

        svgGroup.add(line)
      })
    }
  })

  const originalBox = new THREE.Box3().setFromObject(svgGroup)
  const originalWidth = originalBox.max.x - originalBox.min.x
  if (originalWidth <= 0) return svgGroup

  const scaleFactor = width / originalWidth
  svgGroup.scale.set(scaleFactor, scaleFactor, 1) // Single Y flip here

  // Center the scaled group
  const scaledBox = new THREE.Box3().setFromObject(svgGroup)
  const center = scaledBox.getCenter(new THREE.Vector3())
  svgGroup.position.sub(center)

  return svgGroup
}

function closePathIfNeeded(points, thresholdRatio = 0.05) {
  if (points.length < 6) return points // Not enough points to form a path

  // Extract first and last points (ignore z-coordinate)
  const [x0, y0] = points
  const [xn, yn] = points.slice(-3)

  // Calculate distance between first and last points
  const dx = xn - x0
  const dy = yn - y0
  const distance = Math.sqrt(dx * dx + dy * dy)

  // Calculate bounding box dimensions
  let minX = Infinity,
    maxX = -Infinity
  let minY = Infinity,
    maxY = -Infinity

  for (let i = 0; i < points.length; i += 3) {
    const x = points[i]
    const y = points[i + 1]
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }

  const width = maxX - minX
  const height = maxY - minY
  const scale = Math.max(width, height)

  // Avoid closing if the path is too small
  if (scale === 0) return points

  // Check if distance is within threshold
  if (distance <= scale * thresholdRatio) {
    // Clone array and append first point to close the path
    return [...points, x0, y0, 0]
  }

  return points
}

export const pathToSVG = (path: string, fillColor = 'white', strokeColor = 'white') => {
  return `
    <svg viewBox="0 0 100 100">
      <path stroke="${strokeColor}" fill="${fillColor}" d="${path}"/>
    </svg>
  `
}

export async function getLatexSVG(latex: string): Promise<string> {
  // Check if MathJax is already loaded on the window.
  if (!window.MathJax) {
    // Configure MathJax by setting the global MathJax configuration.
    window.MathJax = {
      loader: { load: ['input/tex', 'output/svg'] },
      tex: {
        inlineMath: [
          ['$', '$'],
          ['\\(', '\\)']
        ]
      },
      svg: {
        fontCache: 'global'
      }
    }

    // Dynamically import the MathJax module.
    await import('mathjax/es5/tex-svg.js')
  }

  // Wait for MathJax to be ready before calling tex2svgPromise.
  // (MathJax.startup.promise is available if you want to wait for startup.
  // For this example we assume MathJax is ready after the import.)
  try {
    // Generate the MathJax output container from the LaTeX string.
    const container = await MathJax.tex2svgPromise(latex, { display: true })
    // Query for the pure <svg> element inside the container.
    const svgElement = container.querySelector('svg')

    if (svgElement) {
      return svgElement.outerHTML
    } else {
      throw new Error('SVG element not found in MathJax output.')
    }
  } catch (err) {
    console.error('Error converting LaTeX to SVG:', err)
    throw err
  }
}

export const testSVGLatex = `
<svg xmlns="http://www.w3.org/2000/svg" width="99.624px" height="33.224px" viewBox="0 -1149.5 5504.2 1835.5" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" style=""><defs><path id="MJX-4-TEX-I-1D465" d="M52 289Q59 331 106 386T222 442Q257 442 286 424T329 379Q371 442 430 442Q467 442 494 420T522 361Q522 332 508 314T481 292T458 288Q439 288 427 299T415 328Q415 374 465 391Q454 404 425 404Q412 404 406 402Q368 386 350 336Q290 115 290 78Q290 50 306 38T341 26Q378 26 414 59T463 140Q466 150 469 151T485 153H489Q504 153 504 145Q504 144 502 134Q486 77 440 33T333 -11Q263 -11 227 52Q186 -10 133 -10H127Q78 -10 57 16T35 71Q35 103 54 123T99 143Q142 143 142 101Q142 81 130 66T107 46T94 41L91 40Q91 39 97 36T113 29T132 26Q168 26 194 71Q203 87 217 139T245 247T261 313Q266 340 266 352Q266 380 251 392T217 404Q177 404 142 372T93 290Q91 281 88 280T72 278H58Q52 284 52 289Z"></path><path id="MJX-4-TEX-N-3D" d="M56 347Q56 360 70 367H707Q722 359 722 347Q722 336 708 328L390 327H72Q56 332 56 347ZM56 153Q56 168 72 173H708Q722 163 722 153Q722 140 707 133H70Q56 140 56 153Z"></path><path id="MJX-4-TEX-N-73" d="M295 316Q295 356 268 385T190 414Q154 414 128 401Q98 382 98 349Q97 344 98 336T114 312T157 287Q175 282 201 278T245 269T277 256Q294 248 310 236T342 195T359 133Q359 71 321 31T198 -10H190Q138 -10 94 26L86 19L77 10Q71 4 65 -1L54 -11H46H42Q39 -11 33 -5V74V132Q33 153 35 157T45 162H54Q66 162 70 158T75 146T82 119T101 77Q136 26 198 26Q295 26 295 104Q295 133 277 151Q257 175 194 187T111 210Q75 227 54 256T33 318Q33 357 50 384T93 424T143 442T187 447H198Q238 447 268 432L283 424L292 431Q302 440 314 448H322H326Q329 448 335 442V310L329 304H301Q295 310 295 316Z"></path><path id="MJX-4-TEX-N-69" d="M69 609Q69 637 87 653T131 669Q154 667 171 652T188 609Q188 579 171 564T129 549Q104 549 87 564T69 609ZM247 0Q232 3 143 3Q132 3 106 3T56 1L34 0H26V46H42Q70 46 91 49Q100 53 102 60T104 102V205V293Q104 345 102 359T88 378Q74 385 41 385H30V408Q30 431 32 431L42 432Q52 433 70 434T106 436Q123 437 142 438T171 441T182 442H185V62Q190 52 197 50T232 46H255V0H247Z"></path><path id="MJX-4-TEX-N-6E" d="M41 46H55Q94 46 102 60V68Q102 77 102 91T102 122T103 161T103 203Q103 234 103 269T102 328V351Q99 370 88 376T43 385H25V408Q25 431 27 431L37 432Q47 433 65 434T102 436Q119 437 138 438T167 441T178 442H181V402Q181 364 182 364T187 369T199 384T218 402T247 421T285 437Q305 442 336 442Q450 438 463 329Q464 322 464 190V104Q464 66 466 59T477 49Q498 46 526 46H542V0H534L510 1Q487 2 460 2T422 3Q319 3 310 0H302V46H318Q379 46 379 62Q380 64 380 200Q379 335 378 343Q372 371 358 385T334 402T308 404Q263 404 229 370Q202 343 195 315T187 232V168V108Q187 78 188 68T191 55T200 49Q221 46 249 46H265V0H257L234 1Q210 2 183 2T145 3Q42 3 33 0H25V46H41Z"></path><path id="MJX-4-TEX-N-2061" d=""></path><path id="MJX-4-TEX-LO-28" d="M180 96T180 250T205 541T266 770T353 944T444 1069T527 1150H555Q561 1144 561 1141Q561 1137 545 1120T504 1072T447 995T386 878T330 721T288 513T272 251Q272 133 280 56Q293 -87 326 -209T399 -405T475 -531T536 -609T561 -640Q561 -643 555 -649H527Q483 -612 443 -568T353 -443T266 -270T205 -41Z"></path><path id="MJX-4-TEX-I-1D70B" d="M132 -11Q98 -11 98 22V33L111 61Q186 219 220 334L228 358H196Q158 358 142 355T103 336Q92 329 81 318T62 297T53 285Q51 284 38 284Q19 284 19 294Q19 300 38 329T93 391T164 429Q171 431 389 431Q549 431 553 430Q573 423 573 402Q573 371 541 360Q535 358 472 358H408L405 341Q393 269 393 222Q393 170 402 129T421 65T431 37Q431 20 417 5T381 -10Q370 -10 363 -7T347 17T331 77Q330 86 330 121Q330 170 339 226T357 318T367 358H269L268 354Q268 351 249 275T206 114T175 17Q164 -11 132 -11Z"></path><path id="MJX-4-TEX-N-32" d="M109 429Q82 429 66 447T50 491Q50 562 103 614T235 666Q326 666 387 610T449 465Q449 422 429 383T381 315T301 241Q265 210 201 149L142 93L218 92Q375 92 385 97Q392 99 409 186V189H449V186Q448 183 436 95T421 3V0H50V19V31Q50 38 56 46T86 81Q115 113 136 137Q145 147 170 174T204 211T233 244T261 278T284 308T305 340T320 369T333 401T340 431T343 464Q343 527 309 573T212 619Q179 619 154 602T119 569T109 550Q109 549 114 549Q132 549 151 535T170 489Q170 464 154 447T109 429Z"></path><path id="MJX-4-TEX-LO-29" d="M35 1138Q35 1150 51 1150H56H69Q113 1113 153 1069T243 944T330 771T391 541T416 250T391 -40T330 -270T243 -443T152 -568T69 -649H56Q43 -649 39 -647T35 -637Q65 -607 110 -548Q283 -316 316 56Q324 133 324 251Q324 368 316 445Q278 877 48 1123Q36 1137 35 1138Z"></path></defs><g stroke="#000000" fill="#000000" stroke-width="0" transform="scale(1,-1)"><g data-mml-node="math"><g data-mml-node="mi"><use data-c="1D465" xlink:href="#MJX-4-TEX-I-1D465"></use></g><g data-mml-node="mo" transform="translate(849.8,0)"><use data-c="3D" xlink:href="#MJX-4-TEX-N-3D"></use></g><g data-mml-node="mi" transform="translate(1905.6,0)"><use data-c="73" xlink:href="#MJX-4-TEX-N-73"></use><use data-c="69" xlink:href="#MJX-4-TEX-N-69" transform="translate(394,0)"></use><use data-c="6E" xlink:href="#MJX-4-TEX-N-6E" transform="translate(672,0)"></use></g><g data-mml-node="mo" transform="translate(3133.6,0)"><use data-c="2061" xlink:href="#MJX-4-TEX-N-2061"></use></g><g data-mml-node="mrow" transform="translate(3300.2,0)"><g data-mml-node="mo" transform="translate(0 -0.5)"><use data-c="28" xlink:href="#MJX-4-TEX-LO-28"></use></g><g data-mml-node="mfrac" transform="translate(597,0)"><g data-mml-node="mi" transform="translate(220,676)"><use data-c="1D70B" xlink:href="#MJX-4-TEX-I-1D70B"></use></g><g data-mml-node="mn" transform="translate(255,-686)"><use data-c="32" xlink:href="#MJX-4-TEX-N-32"></use></g><rect width="770" height="60" x="120" y="220"></rect></g><g data-mml-node="mo" transform="translate(1607,0) translate(0 -0.5)"><use data-c="29" xlink:href="#MJX-4-TEX-LO-29"></use></g></g></g></g></svg>
`

export const testSVGLatex2 = `
<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<svg xmlns="http://www.w3.org/2000/svg" width="214.432px" height="43.800px" viewBox="0 -1460 11847.4 2420" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" style=""><defs><path id="MJX-23-TEX-I-1D465" d="M52 289Q59 331 106 386T222 442Q257 442 286 424T329 379Q371 442 430 442Q467 442 494 420T522 361Q522 332 508 314T481 292T458 288Q439 288 427 299T415 328Q415 374 465 391Q454 404 425 404Q412 404 406 402Q368 386 350 336Q290 115 290 78Q290 50 306 38T341 26Q378 26 414 59T463 140Q466 150 469 151T485 153H489Q504 153 504 145Q504 144 502 134Q486 77 440 33T333 -11Q263 -11 227 52Q186 -10 133 -10H127Q78 -10 57 16T35 71Q35 103 54 123T99 143Q142 143 142 101Q142 81 130 66T107 46T94 41L91 40Q91 39 97 36T113 29T132 26Q168 26 194 71Q203 87 217 139T245 247T261 313Q266 340 266 352Q266 380 251 392T217 404Q177 404 142 372T93 290Q91 281 88 280T72 278H58Q52 284 52 289Z"></path><path id="MJX-23-TEX-N-3D" d="M56 347Q56 360 70 367H707Q722 359 722 347Q722 336 708 328L390 327H72Q56 332 56 347ZM56 153Q56 168 72 173H708Q722 163 722 153Q722 140 707 133H70Q56 140 56 153Z"></path><path id="MJX-23-TEX-N-73" d="M295 316Q295 356 268 385T190 414Q154 414 128 401Q98 382 98 349Q97 344 98 336T114 312T157 287Q175 282 201 278T245 269T277 256Q294 248 310 236T342 195T359 133Q359 71 321 31T198 -10H190Q138 -10 94 26L86 19L77 10Q71 4 65 -1L54 -11H46H42Q39 -11 33 -5V74V132Q33 153 35 157T45 162H54Q66 162 70 158T75 146T82 119T101 77Q136 26 198 26Q295 26 295 104Q295 133 277 151Q257 175 194 187T111 210Q75 227 54 256T33 318Q33 357 50 384T93 424T143 442T187 447H198Q238 447 268 432L283 424L292 431Q302 440 314 448H322H326Q329 448 335 442V310L329 304H301Q295 310 295 316Z"></path><path id="MJX-23-TEX-N-69" d="M69 609Q69 637 87 653T131 669Q154 667 171 652T188 609Q188 579 171 564T129 549Q104 549 87 564T69 609ZM247 0Q232 3 143 3Q132 3 106 3T56 1L34 0H26V46H42Q70 46 91 49Q100 53 102 60T104 102V205V293Q104 345 102 359T88 378Q74 385 41 385H30V408Q30 431 32 431L42 432Q52 433 70 434T106 436Q123 437 142 438T171 441T182 442H185V62Q190 52 197 50T232 46H255V0H247Z"></path><path id="MJX-23-TEX-N-6E" d="M41 46H55Q94 46 102 60V68Q102 77 102 91T102 122T103 161T103 203Q103 234 103 269T102 328V351Q99 370 88 376T43 385H25V408Q25 431 27 431L37 432Q47 433 65 434T102 436Q119 437 138 438T167 441T178 442H181V402Q181 364 182 364T187 369T199 384T218 402T247 421T285 437Q305 442 336 442Q450 438 463 329Q464 322 464 190V104Q464 66 466 59T477 49Q498 46 526 46H542V0H534L510 1Q487 2 460 2T422 3Q319 3 310 0H302V46H318Q379 46 379 62Q380 64 380 200Q379 335 378 343Q372 371 358 385T334 402T308 404Q263 404 229 370Q202 343 195 315T187 232V168V108Q187 78 188 68T191 55T200 49Q221 46 249 46H265V0H257L234 1Q210 2 183 2T145 3Q42 3 33 0H25V46H41Z"></path><path id="MJX-23-TEX-N-2061" d=""></path><path id="MJX-23-TEX-LO-28" d="M180 96T180 250T205 541T266 770T353 944T444 1069T527 1150H555Q561 1144 561 1141Q561 1137 545 1120T504 1072T447 995T386 878T330 721T288 513T272 251Q272 133 280 56Q293 -87 326 -209T399 -405T475 -531T536 -609T561 -640Q561 -643 555 -649H527Q483 -612 443 -568T353 -443T266 -270T205 -41Z"></path><path id="MJX-23-TEX-I-1D70B" d="M132 -11Q98 -11 98 22V33L111 61Q186 219 220 334L228 358H196Q158 358 142 355T103 336Q92 329 81 318T62 297T53 285Q51 284 38 284Q19 284 19 294Q19 300 38 329T93 391T164 429Q171 431 389 431Q549 431 553 430Q573 423 573 402Q573 371 541 360Q535 358 472 358H408L405 341Q393 269 393 222Q393 170 402 129T421 65T431 37Q431 20 417 5T381 -10Q370 -10 363 -7T347 17T331 77Q330 86 330 121Q330 170 339 226T357 318T367 358H269L268 354Q268 351 249 275T206 114T175 17Q164 -11 132 -11Z"></path><path id="MJX-23-TEX-N-32" d="M109 429Q82 429 66 447T50 491Q50 562 103 614T235 666Q326 666 387 610T449 465Q449 422 429 383T381 315T301 241Q265 210 201 149L142 93L218 92Q375 92 385 97Q392 99 409 186V189H449V186Q448 183 436 95T421 3V0H50V19V31Q50 38 56 46T86 81Q115 113 136 137Q145 147 170 174T204 211T233 244T261 278T284 308T305 340T320 369T333 401T340 431T343 464Q343 527 309 573T212 619Q179 619 154 602T119 569T109 550Q109 549 114 549Q132 549 151 535T170 489Q170 464 154 447T109 429Z"></path><path id="MJX-23-TEX-LO-29" d="M35 1138Q35 1150 51 1150H56H69Q113 1113 153 1069T243 944T330 771T391 541T416 250T391 -40T330 -270T243 -443T152 -568T69 -649H56Q43 -649 39 -647T35 -637Q65 -607 110 -548Q283 -316 316 56Q324 133 324 251Q324 368 316 445Q278 877 48 1123Q36 1137 35 1138Z"></path><path id="MJX-23-TEX-N-63" d="M370 305T349 305T313 320T297 358Q297 381 312 396Q317 401 317 402T307 404Q281 408 258 408Q209 408 178 376Q131 329 131 219Q131 137 162 90Q203 29 272 29Q313 29 338 55T374 117Q376 125 379 127T395 129H409Q415 123 415 120Q415 116 411 104T395 71T366 33T318 2T249 -11Q163 -11 99 53T34 214Q34 318 99 383T250 448T370 421T404 357Q404 334 387 320Z"></path><path id="MJX-23-TEX-N-6F" d="M28 214Q28 309 93 378T250 448Q340 448 405 380T471 215Q471 120 407 55T250 -10Q153 -10 91 57T28 214ZM250 30Q372 30 372 193V225V250Q372 272 371 288T364 326T348 362T317 390T268 410Q263 411 252 411Q222 411 195 399Q152 377 139 338T126 246V226Q126 130 145 91Q177 30 250 30Z"></path><path id="MJX-23-TEX-N-28" d="M94 250Q94 319 104 381T127 488T164 576T202 643T244 695T277 729T302 750H315H319Q333 750 333 741Q333 738 316 720T275 667T226 581T184 443T167 250T184 58T225 -81T274 -167T316 -220T333 -241Q333 -250 318 -250H315H302L274 -226Q180 -141 137 -14T94 250Z"></path><path id="MJX-23-TEX-I-1D466" d="M21 287Q21 301 36 335T84 406T158 442Q199 442 224 419T250 355Q248 336 247 334Q247 331 231 288T198 191T182 105Q182 62 196 45T238 27Q261 27 281 38T312 61T339 94Q339 95 344 114T358 173T377 247Q415 397 419 404Q432 431 462 431Q475 431 483 424T494 412T496 403Q496 390 447 193T391 -23Q363 -106 294 -155T156 -205Q111 -205 77 -183T43 -117Q43 -95 50 -80T69 -58T89 -48T106 -45Q150 -45 150 -87Q150 -107 138 -122T115 -142T102 -147L99 -148Q101 -153 118 -160T152 -167H160Q177 -167 186 -165Q219 -156 247 -127T290 -65T313 -9T321 21L315 17Q309 13 296 6T270 -6Q250 -11 231 -11Q185 -11 150 11T104 82Q103 89 103 113Q103 170 138 262T173 379Q173 380 173 381Q173 390 173 393T169 400T158 404H154Q131 404 112 385T82 344T65 302T57 280Q55 278 41 278H27Q21 284 21 287Z"></path><path id="MJX-23-TEX-N-29" d="M60 749L64 750Q69 750 74 750H86L114 726Q208 641 251 514T294 250Q294 182 284 119T261 12T224 -76T186 -143T145 -194T113 -227T90 -246Q87 -249 86 -250H74Q66 -250 63 -250T58 -247T55 -238Q56 -237 66 -225Q221 -64 221 250T66 725Q56 737 55 738Q55 746 60 749Z"></path><path id="MJX-23-TEX-I-1D450" d="M34 159Q34 268 120 355T306 442Q362 442 394 418T427 355Q427 326 408 306T360 285Q341 285 330 295T319 325T330 359T352 380T366 386H367Q367 388 361 392T340 400T306 404Q276 404 249 390Q228 381 206 359Q162 315 142 235T121 119Q121 73 147 50Q169 26 205 26H209Q321 26 394 111Q403 121 406 121Q410 121 419 112T429 98T420 83T391 55T346 25T282 0T202 -11Q127 -11 81 37T34 159Z"></path><path id="MJX-23-TEX-I-1D45C" d="M201 -11Q126 -11 80 38T34 156Q34 221 64 279T146 380Q222 441 301 441Q333 441 341 440Q354 437 367 433T402 417T438 387T464 338T476 268Q476 161 390 75T201 -11ZM121 120Q121 70 147 48T206 26Q250 26 289 58T351 142Q360 163 374 216T388 308Q388 352 370 375Q346 405 306 405Q243 405 195 347Q158 303 140 230T121 120Z"></path><path id="MJX-23-TEX-I-1D460" d="M131 289Q131 321 147 354T203 415T300 442Q362 442 390 415T419 355Q419 323 402 308T364 292Q351 292 340 300T328 326Q328 342 337 354T354 372T367 378Q368 378 368 379Q368 382 361 388T336 399T297 405Q249 405 227 379T204 326Q204 301 223 291T278 274T330 259Q396 230 396 163Q396 135 385 107T352 51T289 7T195 -10Q118 -10 86 19T53 87Q53 126 74 143T118 160Q133 160 146 151T160 120Q160 94 142 76T111 58Q109 57 108 57T107 55Q108 52 115 47T146 34T201 27Q237 27 263 38T301 66T318 97T323 122Q323 150 302 164T254 181T195 196T148 231Q131 256 131 289Z"></path><path id="MJX-23-TEX-I-1D44E" d="M33 157Q33 258 109 349T280 441Q331 441 370 392Q386 422 416 422Q429 422 439 414T449 394Q449 381 412 234T374 68Q374 43 381 35T402 26Q411 27 422 35Q443 55 463 131Q469 151 473 152Q475 153 483 153H487Q506 153 506 144Q506 138 501 117T481 63T449 13Q436 0 417 -8Q409 -10 393 -10Q359 -10 336 5T306 36L300 51Q299 52 296 50Q294 48 292 46Q233 -10 172 -10Q117 -10 75 30T33 157ZM351 328Q351 334 346 350T323 385T277 405Q242 405 210 374T160 293Q131 214 119 129Q119 126 119 118T118 106Q118 61 136 44T179 26Q217 26 254 59T298 110Q300 114 325 217T351 328Z"></path><path id="MJX-23-TEX-I-1D456" d="M184 600Q184 624 203 642T247 661Q265 661 277 649T290 619Q290 596 270 577T226 557Q211 557 198 567T184 600ZM21 287Q21 295 30 318T54 369T98 420T158 442Q197 442 223 419T250 357Q250 340 236 301T196 196T154 83Q149 61 149 51Q149 26 166 26Q175 26 185 29T208 43T235 78T260 137Q263 149 265 151T282 153Q302 153 302 143Q302 135 293 112T268 61T223 11T161 -11Q129 -11 102 10T74 74Q74 91 79 106T122 220Q160 321 166 341T173 380Q173 404 156 404H154Q124 404 99 371T61 287Q60 286 59 284T58 281T56 279T53 278T49 278T41 278H27Q21 284 21 287Z"></path><path id="MJX-23-TEX-I-1D45B" d="M21 287Q22 293 24 303T36 341T56 388T89 425T135 442Q171 442 195 424T225 390T231 369Q231 367 232 367L243 378Q304 442 382 442Q436 442 469 415T503 336T465 179T427 52Q427 26 444 26Q450 26 453 27Q482 32 505 65T540 145Q542 153 560 153Q580 153 580 145Q580 144 576 130Q568 101 554 73T508 17T439 -10Q392 -10 371 17T350 73Q350 92 386 193T423 345Q423 404 379 404H374Q288 404 229 303L222 291L189 157Q156 26 151 16Q138 -11 108 -11Q95 -11 87 -5T76 7T74 17Q74 30 112 180T152 343Q153 348 153 366Q153 405 129 405Q91 405 66 305Q60 285 60 284Q58 278 41 278H27Q21 284 21 287Z"></path><path id="MJX-23-TEX-I-1D44F" d="M73 647Q73 657 77 670T89 683Q90 683 161 688T234 694Q246 694 246 685T212 542Q204 508 195 472T180 418L176 399Q176 396 182 402Q231 442 283 442Q345 442 383 396T422 280Q422 169 343 79T173 -11Q123 -11 82 27T40 150V159Q40 180 48 217T97 414Q147 611 147 623T109 637Q104 637 101 637H96Q86 637 83 637T76 640T73 647ZM336 325V331Q336 405 275 405Q258 405 240 397T207 376T181 352T163 330L157 322L136 236Q114 150 114 114Q114 66 138 42Q154 26 178 26Q211 26 245 58Q270 81 285 114T318 219Q336 291 336 325Z"></path></defs><g stroke="#000000" fill="#000000" stroke-width="0" transform="scale(1,-1)"><g data-mml-node="math"><g data-mml-node="mi"><use data-c="1D465" xlink:href="#MJX-23-TEX-I-1D465"></use></g><g data-mml-node="mo" transform="translate(849.8,0)"><use data-c="3D" xlink:href="#MJX-23-TEX-N-3D"></use></g><g data-mml-node="mi" transform="translate(1905.6,0)"><use data-c="73" xlink:href="#MJX-23-TEX-N-73"></use><use data-c="69" xlink:href="#MJX-23-TEX-N-69" transform="translate(394,0)"></use><use data-c="6E" xlink:href="#MJX-23-TEX-N-6E" transform="translate(672,0)"></use></g><g data-mml-node="mo" transform="translate(3133.6,0)"><use data-c="2061" xlink:href="#MJX-23-TEX-N-2061"></use></g><g data-mml-node="mrow" transform="translate(3300.2,0)"><g data-mml-node="mo" transform="translate(0 -0.5)"><use data-c="28" xlink:href="#MJX-23-TEX-LO-28"></use></g><g data-mml-node="mfrac" transform="translate(597,0)"><g data-mml-node="mi" transform="translate(220,676)"><use data-c="1D70B" xlink:href="#MJX-23-TEX-I-1D70B"></use></g><g data-mml-node="mn" transform="translate(255,-686)"><use data-c="32" xlink:href="#MJX-23-TEX-N-32"></use></g><rect width="770" height="60" x="120" y="220"></rect></g><g data-mml-node="mo" transform="translate(1607,0) translate(0 -0.5)"><use data-c="29" xlink:href="#MJX-23-TEX-LO-29"></use></g></g><g data-mml-node="mi" transform="translate(5670.9,0)"><use data-c="63" xlink:href="#MJX-23-TEX-N-63"></use><use data-c="6F" xlink:href="#MJX-23-TEX-N-6F" transform="translate(444,0)"></use><use data-c="73" xlink:href="#MJX-23-TEX-N-73" transform="translate(944,0)"></use></g><g data-mml-node="mo" transform="translate(7008.9,0)"><use data-c="2061" xlink:href="#MJX-23-TEX-N-2061"></use></g><g data-mml-node="mo" transform="translate(7008.9,0)"><use data-c="28" xlink:href="#MJX-23-TEX-N-28"></use></g><g data-mml-node="msub" transform="translate(7397.9,0)"><g data-mml-node="mi"><use data-c="1D466" xlink:href="#MJX-23-TEX-I-1D466"></use></g><g data-mml-node="mn" transform="translate(523,-150) scale(0.707)"><use data-c="32" xlink:href="#MJX-23-TEX-N-32"></use></g></g><g data-mml-node="mo" transform="translate(8324.4,0)"><use data-c="29" xlink:href="#MJX-23-TEX-N-29"></use></g><g data-mml-node="mfrac" transform="translate(8713.4,0)"><g data-mml-node="mrow" transform="translate(220,710)"><g data-mml-node="mi"><use data-c="1D450" xlink:href="#MJX-23-TEX-I-1D450"></use></g><g data-mml-node="mi" transform="translate(433,0)"><use data-c="1D45C" xlink:href="#MJX-23-TEX-I-1D45C"></use></g><g data-mml-node="mi" transform="translate(918,0)"><use data-c="1D460" xlink:href="#MJX-23-TEX-I-1D460"></use></g><g data-mml-node="mo" transform="translate(1387,0)"><use data-c="28" xlink:href="#MJX-23-TEX-N-28"></use></g><g data-mml-node="mi" transform="translate(1776,0)"><use data-c="1D44E" xlink:href="#MJX-23-TEX-I-1D44E"></use></g><g data-mml-node="mo" transform="translate(2305,0)"><use data-c="29" xlink:href="#MJX-23-TEX-N-29"></use></g></g><g data-mml-node="mrow" transform="translate(256.5,-710)"><g data-mml-node="mi"><use data-c="1D460" xlink:href="#MJX-23-TEX-I-1D460"></use></g><g data-mml-node="mi" transform="translate(469,0)"><use data-c="1D456" xlink:href="#MJX-23-TEX-I-1D456"></use></g><g data-mml-node="mi" transform="translate(814,0)"><use data-c="1D45B" xlink:href="#MJX-23-TEX-I-1D45B"></use></g><g data-mml-node="mo" transform="translate(1414,0)"><use data-c="28" xlink:href="#MJX-23-TEX-N-28"></use></g><g data-mml-node="mi" transform="translate(1803,0)"><use data-c="1D44F" xlink:href="#MJX-23-TEX-I-1D44F"></use></g><g data-mml-node="mo" transform="translate(2232,0)"><use data-c="29" xlink:href="#MJX-23-TEX-N-29"></use></g></g><rect width="2894" height="60" x="120" y="220"></rect></g></g></g></svg>
`

export const latexOTest = `

<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<svg xmlns="http://www.w3.org/2000/svg" width="8.776px" height="8.184px" viewBox="0 -441 485 452" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" style=""><defs><path id="MJX-24-TEX-I-1D45C" d="M201 -11Q126 -11 80 38T34 156Q34 221 64 279T146 380Q222 441 301 441Q333 441 341 440Q354 437 367 433T402 417T438 387T464 338T476 268Q476 161 390 75T201 -11ZM121 120Q121 70 147 48T206 26Q250 26 289 58T351 142Q360 163 374 216T388 308Q388 352 370 375Q346 405 306 405Q243 405 195 347Q158 303 140 230T121 120Z"></path></defs><g stroke="#000000" fill="#000000" stroke-width="0" transform="scale(1,-1)"><g data-mml-node="math"><g data-mml-node="mi"><use data-c="1D45C" xlink:href="#MJX-24-TEX-I-1D45C"></use></g></g></g></svg>
`

export function createSVGGroup5(svgText: string, width: number) {
  // Create the SVGLoader instance and parse the SVG string.
  const loader = new SVGLoader()
  const data = loader.parse(svgText)
  const group = new THREE.Group()
  group.scale.multiplyScalar(0.25)
  group.position.x = -70
  group.position.y = 70
  group.scale.y *= -1

  let renderOrder = 0

  for (const path of data.paths) {
    console.log('PATH')
    const fillColor = path.userData.style.fill

    if (fillColor !== undefined && fillColor !== 'none') {
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setStyle(fillColor),
        opacity: path.userData.style.fillOpacity,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false
      })

      const shapes = SVGLoader.createShapes(path)

      for (const shape of shapes) {
        const geometry = new THREE.ShapeGeometry(shape, 100)
        const mesh = new THREE.Mesh(geometry, material)
        mesh.renderOrder = renderOrder++

        group.add(mesh)
      }
    }

    const strokeColor = path.userData.style.stroke

    if (strokeColor !== undefined && strokeColor !== 'none') {
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setStyle(strokeColor),
        opacity: path.userData.style.strokeOpacity,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false
      })

      for (const subPath of path.subPaths) {
        const geometry = SVGLoader.pointsToStroke(subPath.getPoints(100), path.userData.style)

        if (geometry) {
          const mesh = new THREE.Mesh(geometry, material)
          mesh.renderOrder = renderOrder++

          group.add(mesh)
        }
      }
    }
  }

  const originalBox = new THREE.Box3().setFromObject(group)
  const originalWidth = originalBox.max.x - originalBox.min.x
  if (originalWidth <= 0) return group

  const scaleFactor = width / originalWidth
  group.scale.set(scaleFactor, -scaleFactor, 1) // Single Y flip here

  // Center the scaled group
  const scaledBox = new THREE.Box3().setFromObject(group)
  const center = scaledBox.getCenter(new THREE.Vector3())
  group.position.sub(center)

  return group
}

export const tigerSVG = `

<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     height="800">
 <g transform="translate(200,200)" style="fill-opacity:1; fill:none;">
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.172">
  <path d="M-122.304 84.285C-122.304 84.285 -122.203 86.179 -123.027 86.16C-123.851 86.141 -140.305 38.066 -160.833 40.309C-160.833 40.309 -143.05 32.956 -122.304 84.285z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.172">
  <path d="M-118.774 81.262C-118.774 81.262 -119.323 83.078 -120.092 82.779C-120.86 82.481 -119.977 31.675 -140.043 26.801C-140.043 26.801 -120.82 25.937 -118.774 81.262z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.172">
  <path d="M-91.284 123.59C-91.284 123.59 -89.648 124.55 -90.118 125.227C-90.589 125.904 -139.763 113.102 -149.218 131.459C-149.218 131.459 -145.539 112.572 -91.284 123.59z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.172">
  <path d="M-94.093 133.801C-94.093 133.801 -92.237 134.197 -92.471 134.988C-92.704 135.779 -143.407 139.121 -146.597 159.522C-146.597 159.522 -149.055 140.437 -94.093 133.801z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.172">
  <path d="M-98.304 128.276C-98.304 128.276 -96.526 128.939 -96.872 129.687C-97.218 130.435 -147.866 126.346 -153.998 146.064C-153.998 146.064 -153.646 126.825 -98.304 128.276z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.172">
  <path d="M-109.009 110.072C-109.009 110.072 -107.701 111.446 -108.34 111.967C-108.979 112.488 -152.722 86.634 -166.869 101.676C-166.869 101.676 -158.128 84.533 -109.009 110.072z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.172">
  <path d="M-116.554 114.263C-116.554 114.263 -115.098 115.48 -115.674 116.071C-116.25 116.661 -162.638 95.922 -174.992 112.469C-174.992 112.469 -168.247 94.447 -116.554 114.263z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.172">
  <path d="M-119.154 118.335C-119.154 118.335 -117.546 119.343 -118.036 120.006C-118.526 120.669 -167.308 106.446 -177.291 124.522C-177.291 124.522 -173.066 105.749 -119.154 118.335z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.172">
  <path d="M-108.42 118.949C-108.42 118.949 -107.298 120.48 -107.999 120.915C-108.7 121.35 -148.769 90.102 -164.727 103.207C-164.727 103.207 -153.862 87.326 -108.42 118.949z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.172">
  <path d="M-128.2 90C-128.2 90 -127.6 91.8 -128.4 92C-129.2 92.2 -157.8 50.2 -177.001 57.8C-177.001 57.8 -161.8 46 -128.2 90z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.172">
  <path d="M-127.505 96.979C-127.505 96.979 -126.53 98.608 -127.269 98.975C-128.007 99.343 -164.992 64.499 -182.101 76.061C-182.101 76.061 -169.804 61.261 -127.505 96.979z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.172">
  <path d="M-127.62 101.349C-127.62 101.349 -126.498 102.88 -127.199 103.315C-127.9 103.749 -167.969 72.502 -183.927 85.607C-183.927 85.607 -173.062 69.726 -127.62 101.349z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000">
  <path d="M-129.83 103.065C-129.327 109.113 -128.339 115.682 -126.6 118.801C-126.6 118.801 -130.2 131.201 -121.4 144.401C-121.4 144.401 -121.8 151.601 -120.2 154.801C-120.2 154.801 -116.2 163.201 -111.4 164.001C-107.516 164.648 -98.793 167.717 -88.932 169.121C-88.932 169.121 -71.8 183.201 -75 196.001C-75 196.001 -75.4 212.401 -79 214.001C-79 214.001 -67.4 202.801 -77 219.601L-81.4 238.401C-81.4 238.401 -55.8 216.801 -71.4 235.201L-81.4 261.201C-81.4 261.201 -61.8 242.801 -69 251.201L-72.2 260.001C-72.2 260.001 -29 232.801 -59.8 262.401C-59.8 262.401 -51.8 258.801 -47.4 261.601C-47.4 261.601 -40.6 260.401 -41.4 262.001C-41.4 262.001 -62.2 272.401 -65.8 290.801C-65.8 290.801 -57.4 280.801 -60.6 291.601L-60.2 303.201C-60.2 303.201 -56.2 281.601 -56.6 319.201C-56.6 319.201 -37.4 301.201 -49 322.001L-49 338.801C-49 338.801 -33.8 322.401 -40.2 335.201C-40.2 335.201 -30.2 326.401 -34.2 341.601C-34.2 341.601 -35 352.001 -30.6 340.801C-30.6 340.801 -14.6 310.201 -20.6 336.401C-20.6 336.401 -21.4 355.601 -16.6 340.801C-16.6 340.801 -16.2 351.201 -7 358.401C-7 358.401 -8.2 307.601 4.6 343.601L8.6 360.001C8.6 360.001 11.4 350.801 11 345.601C11 345.601 25.8 329.201 19 353.601C19 353.601 34.2 330.801 31 344.001C31 344.001 23.4 360.001 25 364.801C25 364.801 41.8 330.001 43 328.401C43 328.401 41 370.802 51.8 334.801C51.8 334.801 57.4 346.801 54.6 351.201C54.6 351.201 62.6 343.201 61.8 340.001C61.8 340.001 66.4 331.801 69.2 345.401C69.2 345.401 71 354.801 72.6 351.601C72.6 351.601 76.6 375.602 77.8 352.801C77.8 352.801 79.4 339.201 72.2 327.601C72.2 327.601 73 324.401 70.2 320.401C70.2 320.401 83.8 342.001 76.6 313.201C76.6 313.201 87.801 321.201 89.001 321.201C89.001 321.201 75.4 298.001 84.2 302.801C84.2 302.801 79 292.401 97.001 304.401C97.001 304.401 81 288.401 98.601 298.001C98.601 298.001 106.601 304.401 99.001 294.401C99.001 294.401 84.6 278.401 106.601 296.401C106.601 296.401 118.201 312.801 119.001 315.601C119.001 315.601 109.001 286.401 104.601 283.601C104.601 283.601 113.001 247.201 154.201 262.801C154.201 262.801 161.001 280.001 165.401 261.601C165.401 261.601 178.201 255.201 189.401 282.801C189.401 282.801 193.401 269.201 192.601 266.401C192.601 266.401 199.401 267.601 198.601 266.401C198.601 266.401 211.801 270.801 213.001 270.001C213.001 270.001 219.801 276.801 220.201 273.201C220.201 273.201 229.401 276.001 227.401 272.401C227.401 272.401 236.201 288.001 236.601 291.601L239.001 277.601L241.001 280.401C241.001 280.401 242.601 272.801 241.801 271.601C241.001 270.401 261.801 278.401 266.601 299.201L268.601 307.601C268.601 307.601 274.601 292.801 273.001 288.801C273.001 288.801 278.201 289.601 278.601 294.001C278.601 294.001 282.601 270.801 277.801 264.801C277.801 264.801 282.201 264.001 283.401 267.601L283.401 260.401C283.401 260.401 290.601 261.201 290.601 258.801C290.601 258.801 295.001 254.801 297.001 259.601C297.001 259.601 284.601 224.401 303.001 243.601C303.001 243.601 310.201 254.401 306.601 235.601C303.001 216.801 299.001 215.201 303.801 214.801C303.801 214.801 304.601 211.201 302.601 209.601C300.601 208.001 303.801 209.601 303.801 209.601C303.801 209.601 308.601 213.601 303.401 191.601C303.401 191.601 309.801 193.201 297.801 164.001C297.801 164.001 300.601 161.601 296.601 153.201C296.601 153.201 304.601 157.601 307.401 156.001C307.401 156.001 307.001 154.401 303.801 150.401C303.801 150.401 282.201 95.6 302.601 117.601C302.601 117.601 314.451 131.151 308.051 108.351C308.051 108.351 298.94 84.341 299.717 80.045L-129.83 103.065z"/>
 </g>
 <g style="fill: #cc7226; stroke:#000000">
  <path d="M299.717 80.245C300.345 80.426 302.551 81.55 303.801 83.2C303.801 83.2 310.601 94 305.401 75.6C305.401 75.6 296.201 46.8 305.001 58C305.001 58 311.001 65.2 307.801 51.6C303.936 35.173 301.401 28.8 301.401 28.8C301.401 28.8 313.001 33.6 286.201 -6L295.001 -2.4C295.001 -2.4 275.401 -42 253.801 -47.2L245.801 -53.2C245.801 -53.2 284.201 -91.2 271.401 -128C271.401 -128 264.601 -133.2 255.001 -124C255.001 -124 248.601 -119.2 242.601 -120.8C242.601 -120.8 211.801 -119.6 209.801 -119.6C207.801 -119.6 173.001 -156.8 107.401 -139.2C107.401 -139.2 102.201 -137.2 97.801 -138.4C97.801 -138.4 79.4 -154.4 30.6 -131.6C30.6 -131.6 20.6 -129.6 19 -129.6C17.4 -129.6 14.6 -129.6 6.6 -123.2C-1.4 -116.8 -1.8 -116 -3.8 -114.4C-3.8 -114.4 -20.2 -103.2 -25 -102.4C-25 -102.4 -36.6 -96 -41 -86L-44.6 -84.8C-44.6 -84.8 -46.2 -77.6 -46.6 -76.4C-46.6 -76.4 -51.4 -72.8 -52.2 -67.2C-52.2 -67.2 -61 -61.2 -60.6 -56.8C-60.6 -56.8 -62.2 -51.6 -63 -46.8C-63 -46.8 -70.2 -42 -69.4 -39.2C-69.4 -39.2 -77 -25.2 -75.8 -18.4C-75.8 -18.4 -82.2 -18.8 -85 -16.4C-85 -16.4 -85.8 -11.6 -87.4 -11.2C-87.4 -11.2 -90.2 -10 -87.8 -6C-87.8 -6 -89.4 -3.2 -89.8 -1.6C-89.8 -1.6 -89 1.2 -93.4 6.8C-93.4 6.8 -99.8 25.6 -97.8 30.8C-97.8 30.8 -97.4 35.6 -100.2 37.2C-100.2 37.2 -103.8 36.8 -95.4 48.8C-95.4 48.8 -94.6 50 -97.8 52.4C-97.8 52.4 -115 56 -117.4 72.4C-117.4 72.4 -131 87.2 -131 92.4C-131 94.705 -130.729 97.852 -130.03 102.465C-130.03 102.465 -130.6 110.801 -103 111.601C-75.4 112.401 299.717 80.245 299.717 80.245z"/>
 </g>
 <g style="fill: #cc7226">
  <path d="M-115.6 102.6C-140.6 63.2 -126.2 119.601 -126.2 119.601C-117.4 154.001 12.2 116.401 12.2 116.401C12.2 116.401 181.001 86 192.201 82C203.401 78 298.601 84.4 298.601 84.4L293.001 67.6C228.201 21.2 209.001 44.4 195.401 40.4C181.801 36.4 184.201 46 181.001 46.8C177.801 47.6 138.601 22.8 132.201 23.6C125.801 24.4 100.459 0.649 115.401 32.4C131.401 66.4 57 71.6 40.2 60.4C23.4 49.2 47.4 78.8 47.4 78.8C65.8 98.8 31.4 82 31.4 82C-3 69.2 -27 94.8 -30.2 95.6C-33.4 96.4 -38.2 99.6 -39 93.2C-39.8 86.8 -47.31 70.099 -79 96.4C-99 113.001 -112.8 91 -112.8 91L-115.6 102.6z"/>
 </g>
 <g style="fill: #e87f3a">
  <path d="M133.51 25.346C127.11 26.146 101.743 2.407 116.71 34.146C133.31 69.346 58.31 73.346 41.51 62.146C24.709 50.946 48.71 80.546 48.71 80.546C67.11 100.546 32.709 83.746 32.709 83.746C-1.691 70.946 -25.691 96.546 -28.891 97.346C-32.091 98.146 -36.891 101.346 -37.691 94.946C-38.491 88.546 -45.87 72.012 -77.691 98.146C-98.927 115.492 -112.418 94.037 -112.418 94.037L-115.618 104.146C-140.618 64.346 -125.546 122.655 -125.546 122.655C-116.745 157.056 13.509 118.146 13.509 118.146C13.509 118.146 182.31 87.746 193.51 83.746C204.71 79.746 299.038 86.073 299.038 86.073L293.51 68.764C228.71 22.364 210.31 46.146 196.71 42.146C183.11 38.146 185.51 47.746 182.31 48.546C179.11 49.346 139.91 24.546 133.51 25.346z"/>
 </g>
 <g style="fill: #ea8c4d">
  <path d="M134.819 27.091C128.419 27.891 103.685 3.862 118.019 35.891C134.219 72.092 59.619 75.092 42.819 63.892C26.019 52.692 50.019 82.292 50.019 82.292C68.419 102.292 34.019 85.492 34.019 85.492C-0.381 72.692 -24.382 98.292 -27.582 99.092C-30.782 99.892 -35.582 103.092 -36.382 96.692C-37.182 90.292 -44.43 73.925 -76.382 99.892C-98.855 117.983 -112.036 97.074 -112.036 97.074L-115.636 105.692C-139.436 66.692 -124.891 125.71 -124.891 125.71C-116.091 160.11 14.819 119.892 14.819 119.892C14.819 119.892 183.619 89.492 194.819 85.492C206.019 81.492 299.474 87.746 299.474 87.746L294.02 69.928C229.219 23.528 211.619 47.891 198.019 43.891C184.419 39.891 186.819 49.491 183.619 50.292C180.419 51.092 141.219 26.291 134.819 27.091z"/>
 </g>
 <g style="fill: #ec9961">
  <path d="M136.128 28.837C129.728 29.637 104.999 5.605 119.328 37.637C136.128 75.193 60.394 76.482 44.128 65.637C27.328 54.437 51.328 84.037 51.328 84.037C69.728 104.037 35.328 87.237 35.328 87.237C0.928 74.437 -23.072 100.037 -26.272 100.837C-29.472 101.637 -34.272 104.837 -35.072 98.437C-35.872 92.037 -42.989 75.839 -75.073 101.637C-98.782 120.474 -111.655 100.11 -111.655 100.11L-115.655 107.237C-137.455 70.437 -124.236 128.765 -124.236 128.765C-115.436 163.165 16.128 121.637 16.128 121.637C16.128 121.637 184.928 91.237 196.129 87.237C207.329 83.237 299.911 89.419 299.911 89.419L294.529 71.092C229.729 24.691 212.929 49.637 199.329 45.637C185.728 41.637 188.128 51.237 184.928 52.037C181.728 52.837 142.528 28.037 136.128 28.837z"/>
 </g>
 <g style="fill: #eea575">
  <path d="M137.438 30.583C131.037 31.383 106.814 7.129 120.637 39.383C137.438 78.583 62.237 78.583 45.437 67.383C28.637 56.183 52.637 85.783 52.637 85.783C71.037 105.783 36.637 88.983 36.637 88.983C2.237 76.183 -21.763 101.783 -24.963 102.583C-28.163 103.383 -32.963 106.583 -33.763 100.183C-34.563 93.783 -41.548 77.752 -73.763 103.383C-98.709 122.965 -111.273 103.146 -111.273 103.146L-115.673 108.783C-135.473 73.982 -123.582 131.819 -123.582 131.819C-114.782 166.22 17.437 123.383 17.437 123.383C17.437 123.383 186.238 92.983 197.438 88.983C208.638 84.983 300.347 91.092 300.347 91.092L295.038 72.255C230.238 25.855 214.238 51.383 200.638 47.383C187.038 43.383 189.438 52.983 186.238 53.783C183.038 54.583 143.838 29.783 137.438 30.583z"/>
 </g>
 <g style="fill: #f1b288">
  <path d="M138.747 32.328C132.347 33.128 106.383 9.677 121.947 41.128C141.147 79.928 63.546 80.328 46.746 69.128C29.946 57.928 53.946 87.528 53.946 87.528C72.346 107.528 37.946 90.728 37.946 90.728C3.546 77.928 -20.454 103.528 -23.654 104.328C-26.854 105.128 -31.654 108.328 -32.454 101.928C-33.254 95.528 -40.108 79.665 -72.454 105.128C-98.636 125.456 -110.891 106.183 -110.891 106.183L-115.691 110.328C-133.691 77.128 -122.927 134.874 -122.927 134.874C-114.127 169.274 18.746 125.128 18.746 125.128C18.746 125.128 187.547 94.728 198.747 90.728C209.947 86.728 300.783 92.764 300.783 92.764L295.547 73.419C230.747 27.019 215.547 53.128 201.947 49.128C188.347 45.128 190.747 54.728 187.547 55.528C184.347 56.328 145.147 31.528 138.747 32.328z"/>
 </g>
 <g style="fill: #f3bf9c">
  <path d="M140.056 34.073C133.655 34.873 107.313 11.613 123.255 42.873C143.656 82.874 64.855 82.074 48.055 70.874C31.255 59.674 55.255 89.274 55.255 89.274C73.655 109.274 39.255 92.474 39.255 92.474C4.855 79.674 -19.145 105.274 -22.345 106.074C-25.545 106.874 -30.345 110.074 -31.145 103.674C-31.945 97.274 -38.668 81.578 -71.145 106.874C-98.564 127.947 -110.509 109.219 -110.509 109.219L-115.709 111.874C-131.709 81.674 -122.273 137.929 -122.273 137.929C-113.473 172.329 20.055 126.874 20.055 126.874C20.055 126.874 188.856 96.474 200.056 92.474C211.256 88.474 301.22 94.437 301.22 94.437L296.056 74.583C231.256 28.183 216.856 54.874 203.256 50.874C189.656 46.873 192.056 56.474 188.856 57.274C185.656 58.074 146.456 33.273 140.056 34.073z"/>
 </g>
 <g style="fill: #f5ccb0">
  <path d="M141.365 35.819C134.965 36.619 107.523 13.944 124.565 44.619C146.565 84.219 66.164 83.819 49.364 72.619C32.564 61.419 56.564 91.019 56.564 91.019C74.964 111.019 40.564 94.219 40.564 94.219C6.164 81.419 -17.836 107.019 -21.036 107.819C-24.236 108.619 -29.036 111.819 -29.836 105.419C-30.636 99.019 -37.227 83.492 -69.836 108.619C-98.491 130.438 -110.127 112.256 -110.127 112.256L-115.727 113.419C-130.128 85.019 -121.618 140.983 -121.618 140.983C-112.818 175.384 21.364 128.619 21.364 128.619C21.364 128.619 190.165 98.219 201.365 94.219C212.565 90.219 301.656 96.11 301.656 96.11L296.565 75.746C231.765 29.346 218.165 56.619 204.565 52.619C190.965 48.619 193.365 58.219 190.165 59.019C186.965 59.819 147.765 35.019 141.365 35.819z"/>
 </g>
 <g style="fill: #f8d8c4">
  <path d="M142.674 37.565C136.274 38.365 108.832 15.689 125.874 46.365C147.874 85.965 67.474 85.565 50.674 74.365C33.874 63.165 57.874 92.765 57.874 92.765C76.274 112.765 41.874 95.965 41.874 95.965C7.473 83.165 -16.527 108.765 -19.727 109.565C-22.927 110.365 -27.727 113.565 -28.527 107.165C-29.327 100.765 -35.786 85.405 -68.527 110.365C-98.418 132.929 -109.745 115.293 -109.745 115.293L-115.745 114.965C-129.346 88.564 -120.963 144.038 -120.963 144.038C-112.163 178.438 22.673 130.365 22.673 130.365C22.673 130.365 191.474 99.965 202.674 95.965C213.874 91.965 302.093 97.783 302.093 97.783L297.075 76.91C232.274 30.51 219.474 58.365 205.874 54.365C192.274 50.365 194.674 59.965 191.474 60.765C188.274 61.565 149.074 36.765 142.674 37.565z"/>
 </g>
 <g style="fill: #fae5d7">
  <path d="M143.983 39.31C137.583 40.11 110.529 17.223 127.183 48.11C149.183 88.91 68.783 87.31 51.983 76.11C35.183 64.91 59.183 94.51 59.183 94.51C77.583 114.51 43.183 97.71 43.183 97.71C8.783 84.91 -15.217 110.51 -18.417 111.31C-21.618 112.11 -26.418 115.31 -27.218 108.91C-28.018 102.51 -34.346 87.318 -67.218 112.11C-98.345 135.42 -109.363 118.329 -109.363 118.329L-115.764 116.51C-128.764 92.51 -120.309 147.093 -120.309 147.093C-111.509 181.493 23.983 132.11 23.983 132.11C23.983 132.11 192.783 101.71 203.983 97.71C215.183 93.71 302.529 99.456 302.529 99.456L297.583 78.074C232.783 31.673 220.783 60.11 207.183 56.11C193.583 52.11 195.983 61.71 192.783 62.51C189.583 63.31 150.383 38.51 143.983 39.31z"/>
 </g>
 <g style="fill: #fcf2eb">
  <path d="M145.292 41.055C138.892 41.855 112.917 18.411 128.492 49.855C149.692 92.656 70.092 89.056 53.292 77.856C36.492 66.656 60.492 96.256 60.492 96.256C78.892 116.256 44.492 99.456 44.492 99.456C10.092 86.656 -13.908 112.256 -17.108 113.056C-20.308 113.856 -25.108 117.056 -25.908 110.656C-26.708 104.256 -32.905 89.232 -65.908 113.856C-98.273 137.911 -108.982 121.365 -108.982 121.365L-115.782 118.056C-128.582 94.856 -119.654 150.147 -119.654 150.147C-110.854 184.547 25.292 133.856 25.292 133.856C25.292 133.856 194.093 103.456 205.293 99.456C216.493 95.456 302.965 101.128 302.965 101.128L298.093 79.237C233.292 32.837 222.093 61.856 208.493 57.856C194.893 53.855 197.293 63.456 194.093 64.256C190.892 65.056 151.692 40.255 145.292 41.055z"/>
 </g>
 <g style="fill: #ffffff">
  <path d="M-115.8 119.601C-128.6 97.6 -119 153.201 -119 153.201C-110.2 187.601 26.6 135.601 26.6 135.601C26.6 135.601 195.401 105.2 206.601 101.2C217.801 97.2 303.401 102.8 303.401 102.8L298.601 80.4C233.801 34 223.401 63.6 209.801 59.6C196.201 55.6 198.601 65.2 195.401 66C192.201 66.8 153.001 42 146.601 42.8C140.201 43.6 114.981 19.793 129.801 51.6C152.028 99.307 69.041 89.227 54.6 79.6C37.8 68.4 61.8 98 61.8 98C80.2 118.001 45.8 101.2 45.8 101.2C11.4 88.4 -12.6 114.001 -15.8 114.801C-19 115.601 -23.8 118.801 -24.6 112.401C-25.4 106 -31.465 91.144 -64.6 115.601C-98.2 140.401 -108.6 124.401 -108.6 124.401L-115.8 119.601z"/>
 </g>
 <g style="fill: #000000">
  <path d="M-74.2 149.601C-74.2 149.601 -81.4 161.201 -60.6 174.401C-60.6 174.401 -59.2 175.801 -77.2 171.601C-77.2 171.601 -83.4 169.601 -85 159.201C-85 159.201 -89.8 154.801 -94.6 149.201C-99.4 143.601 -74.2 149.601 -74.2 149.601z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M65.8 102C65.8 102 83.498 128.821 82.9 133.601C81.6 144.001 81.4 153.601 84.6 157.601C87.801 161.601 96.601 194.801 96.601 194.801C96.601 194.801 96.201 196.001 108.601 158.001C108.601 158.001 120.201 142.001 100.201 123.601C100.201 123.601 65 94.8 65.8 102z"/>
 </g>
 <g style="fill: #000000">
  <path d="M-54.2 176.401C-54.2 176.401 -43 183.601 -57.4 214.801L-51 212.401C-51 212.401 -51.8 223.601 -55 226.001L-47.8 222.801C-47.8 222.801 -43 230.801 -47 235.601C-47 235.601 -30.2 243.601 -31 250.001C-31 250.001 -24.6 242.001 -28.6 235.601C-32.6 229.201 -39.8 233.201 -39 214.801L-47.8 218.001C-47.8 218.001 -42.2 209.201 -42.2 202.801L-50.2 205.201C-50.2 205.201 -34.731 178.623 -45.4 177.201C-51.4 176.401 -54.2 176.401 -54.2 176.401z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M-21.8 193.201C-21.8 193.201 -19 188.801 -21.8 189.601C-24.6 190.401 -55.8 205.201 -61.8 214.801C-61.8 214.801 -27.4 190.401 -21.8 193.201z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M-11.4 201.201C-11.4 201.201 -8.6 196.801 -11.4 197.601C-14.2 198.401 -45.4 213.201 -51.4 222.801C-51.4 222.801 -17 198.401 -11.4 201.201z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M1.8 186.001C1.8 186.001 4.6 181.601 1.8 182.401C-1 183.201 -32.2 198.001 -38.2 207.601C-38.2 207.601 -3.8 183.201 1.8 186.001z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M-21.4 229.601C-21.4 229.601 -21.4 223.601 -24.2 224.401C-27 225.201 -63 242.801 -69 252.401C-69 252.401 -27 226.801 -21.4 229.601z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M-20.2 218.801C-20.2 218.801 -19 214.001 -21.8 214.801C-23.8 214.801 -50.2 226.401 -56.2 236.001C-56.2 236.001 -26.6 214.401 -20.2 218.801z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M-34.6 266.401L-44.6 274.001C-44.6 274.001 -34.2 266.401 -30.6 267.601C-30.6 267.601 -37.4 278.801 -38.2 284.001C-38.2 284.001 -27.8 271.201 -22.2 271.601C-22.2 271.601 -14.6 272.001 -14.6 282.801C-14.6 282.801 -9 272.401 -5.8 272.801C-5.8 272.801 -4.6 279.201 -5.8 286.001C-5.8 286.001 -1.8 278.401 2.2 280.001C2.2 280.001 8.6 278.001 7.8 289.601C7.8 289.601 7.8 300.001 7 302.801C7 302.801 12.6 276.401 15 276.001C15 276.001 23 274.801 27.8 283.601C27.8 283.601 23.8 276.001 28.6 278.001C28.6 278.001 39.4 279.601 42.6 286.401C42.6 286.401 35.8 274.401 41.4 277.601C41.4 277.601 48.2 277.601 49.4 284.001C49.4 284.001 57.8 305.201 59.8 306.801C59.8 306.801 52.2 285.201 53.8 285.201C53.8 285.201 51.8 273.201 57 288.001C57 288.001 53.8 274.001 59.4 274.801C65 275.601 69.4 285.601 77.8 283.201C77.8 283.201 87.401 288.801 89.401 219.601L-34.6 266.401z"/>
 </g>
 <g style="fill: #000000">
  <path d="M-29.8 173.601C-29.8 173.601 -15 167.601 25 173.601C25 173.601 32.2 174.001 39 165.201C45.8 156.401 72.6 149.201 79 151.201L88.601 157.601L89.401 158.801C89.401 158.801 101.801 169.201 102.201 176.801C102.601 184.401 87.801 232.401 78.2 248.401C68.6 264.401 59 276.801 39.8 274.401C39.8 274.401 19 270.401 -6.6 274.401C-6.6 274.401 -35.8 272.801 -38.6 264.801C-41.4 256.801 -27.4 241.601 -27.4 241.601C-27.4 241.601 -23 233.201 -24.2 218.801C-25.4 204.401 -25 176.401 -29.8 173.601z"/>
 </g>
 <g style="fill: #e5668c">
  <path d="M-7.8 175.601C0.6 194.001 -29 259.201 -29 259.201C-31 260.801 -16.34 266.846 -6.2 264.401C4.746 261.763 45 266.001 45 266.001C68.6 250.401 81.4 206.001 81.4 206.001C81.4 206.001 91.801 182.001 74.2 178.801C56.6 175.601 -7.8 175.601 -7.8 175.601z"/>
 </g>
 <g style="fill: #b23259">
  <path d="M-9.831 206.497C-6.505 193.707 -4.921 181.906 -7.8 175.601C-7.8 175.601 54.6 182.001 65.8 161.201C70.041 153.326 84.801 184.001 84.4 193.601C84.4 193.601 21.4 208.001 6.6 196.801L-9.831 206.497z"/>
 </g>
 <g style="fill: #a5264c">
  <path d="M-5.4 222.801C-5.4 222.801 -3.4 230.001 -5.8 234.001C-5.8 234.001 -7.4 234.801 -8.6 235.201C-8.6 235.201 -7.4 238.801 -1.4 240.401C-1.4 240.401 0.6 244.801 3 245.201C5.4 245.601 10.2 251.201 14.2 250.001C18.2 248.801 29.4 244.801 29.4 244.801C29.4 244.801 35 241.601 43.8 245.201C43.8 245.201 46.175 244.399 46.6 240.401C47.1 235.701 50.2 232.001 52.2 230.001C54.2 228.001 63.8 215.201 62.6 214.801C61.4 214.401 -5.4 222.801 -5.4 222.801z"/>
 </g>
 <g style="fill: #ff727f; stroke:#000000">
  <path d="M-9.8 174.401C-9.8 174.401 -12.6 196.801 -9.4 205.201C-6.2 213.601 -7 215.601 -7.8 219.601C-8.6 223.601 -4.2 233.601 1.4 239.601L13.4 241.201C13.4 241.201 28.6 237.601 37.8 240.401C37.8 240.401 46.794 241.744 50.2 226.801C50.2 226.801 55 220.401 62.2 217.601C69.4 214.801 76.6 173.201 72.6 165.201C68.6 157.201 54.2 152.801 38.2 168.401C22.2 184.001 20.2 167.201 -9.8 174.401z"/>
 </g>
 <g style="fill: #ffffcc; stroke:#000000; stroke-width:0.5">
  <path d="M-8.2 249.201C-8.2 249.201 -9 247.201 -13.4 246.801C-13.4 246.801 -35.8 243.201 -44.2 230.801C-44.2 230.801 -51 225.201 -46.6 236.801C-46.6 236.801 -36.2 257.201 -29.4 260.001C-29.4 260.001 -13 264.001 -8.2 249.201z"/>
 </g>
 <g style="fill: #cc3f4c">
  <path d="M71.742 185.229C72.401 177.323 74.354 168.709 72.6 165.201C66.154 152.307 49.181 157.695 38.2 168.401C22.2 184.001 20.2 167.201 -9.8 174.401C-9.8 174.401 -11.545 188.364 -10.705 198.376C-10.705 198.376 26.6 186.801 27.4 192.401C27.4 192.401 29 189.201 38.2 189.201C47.4 189.201 70.142 188.029 71.742 185.229z"/>
 </g>
 <g style="stroke:#a51926; stroke-width:2">
  <path d="M28.6 175.201C28.6 175.201 33.4 180.001 29.8 189.601C29.8 189.601 15.4 205.601 17.4 219.601"/>
 </g>
 <g style="fill: #ffffcc; stroke:#000000; stroke-width:0.5">
  <path d="M-19.4 260.001C-19.4 260.001 -23.8 247.201 -15 254.001C-15 254.001 -10.2 256.001 -11.4 257.601C-12.6 259.201 -18.2 263.201 -19.4 260.001z"/>
 </g>
 <g style="fill: #ffffcc; stroke:#000000; stroke-width:0.5">
  <path d="M-14.36 261.201C-14.36 261.201 -17.88 250.961 -10.84 256.401C-10.84 256.401 -6.419 258.849 -7.96 259.281C-12.52 260.561 -7.96 263.121 -14.36 261.201z"/>
 </g>
 <g style="fill: #ffffcc; stroke:#000000; stroke-width:0.5">
  <path d="M-9.56 261.201C-9.56 261.201 -13.08 250.961 -6.04 256.401C-6.04 256.401 -1.665 258.711 -3.16 259.281C-6.52 260.561 -3.16 263.121 -9.56 261.201z"/>
 </g>
 <g style="fill: #ffffcc; stroke:#000000; stroke-width:0.5">
  <path d="M-2.96 261.401C-2.96 261.401 -6.48 251.161 0.56 256.601C0.56 256.601 4.943 258.933 3.441 259.481C0.48 260.561 3.441 263.321 -2.96 261.401z"/>
 </g>
 <g style="fill: #ffffcc; stroke:#000000; stroke-width:0.5">
  <path d="M3.52 261.321C3.52 261.321 0 251.081 7.041 256.521C7.041 256.521 10.881 258.121 9.921 259.401C8.961 260.681 9.921 263.241 3.52 261.321z"/>
 </g>
 <g style="fill: #ffffcc; stroke:#000000; stroke-width:0.5">
  <path d="M10.2 262.001C10.2 262.001 5.4 249.601 14.6 256.001C14.6 256.001 19.4 258.001 18.2 259.601C17 261.201 18.2 264.401 10.2 262.001z"/>
 </g>
 <g style="stroke:#a5264c; stroke-width:2">
  <path d="M-18.2 244.801C-18.2 244.801 -5 242.001 1 245.201C1 245.201 7 246.401 8.2 246.001C9.4 245.601 12.6 245.201 12.6 245.201"/>
 </g>
 <g style="stroke:#a5264c; stroke-width:2">
  <path d="M15.8 253.601C15.8 253.601 27.8 240.001 39.8 244.401C46.816 246.974 45.8 243.601 46.6 240.801C47.4 238.001 47.6 233.801 52.6 230.801"/>
 </g>
 <g style="fill: #ffffcc; stroke:#000000; stroke-width:0.5">
  <path d="M33 237.601C33 237.601 29 226.801 26.2 239.601C23.4 252.401 20.2 256.001 18.6 258.801C18.6 258.801 18.6 264.001 27 263.601C27 263.601 37.8 263.201 38.2 260.401C38.6 257.601 37 246.001 33 237.601z"/>
 </g>
 <g style="stroke:#a5264c; stroke-width:2">
  <path d="M47 244.801C47 244.801 50.6 242.401 53 243.601"/>
 </g>
 <g style="stroke:#a5264c; stroke-width:2">
  <path d="M53.5 228.401C53.5 228.401 56.4 223.501 61.2 222.701"/>
 </g>
 <g style="fill: #b2b2b2">
  <path d="M-25.8 265.201C-25.8 265.201 -7.8 268.401 -3.4 266.801C-3.4 266.801 5.4 266.801 -3 268.801C-3 268.801 -15.8 268.801 -23.8 267.601C-23.8 267.601 -35.4 262.001 -25.8 265.201z"/>
 </g>
 <g style="fill: #ffffcc; stroke:#000000; stroke-width:0.5">
  <path d="M-11.8 172.001C-11.8 172.001 5.8 172.001 7.8 172.801C7.8 172.801 15 203.601 11.4 211.201C11.4 211.201 10.2 214.001 7.4 208.401C7.4 208.401 -11 175.601 -14.2 173.601C-17.4 171.601 -13 172.001 -11.8 172.001z"/>
 </g>
 <g style="fill: #ffffcc; stroke:#000000; stroke-width:0.5">
  <path d="M-88.9 169.301C-88.9 169.301 -80 171.001 -67.4 173.601C-67.4 173.601 -62.6 196.001 -59.4 200.801C-56.2 205.601 -59.8 205.601 -63.4 202.801C-67 200.001 -81.8 186.001 -83.8 181.601C-85.8 177.201 -88.9 169.301 -88.9 169.301z"/>
 </g>
 <g style="fill: #ffffcc; stroke:#000000; stroke-width:0.5">
  <path d="M-67.039 173.818C-67.039 173.818 -61.239 175.366 -60.23 177.581C-59.222 179.795 -61.432 183.092 -61.432 183.092C-61.432 183.092 -62.432 186.397 -63.634 184.235C-64.836 182.072 -67.708 174.412 -67.039 173.818z"/>
 </g>
 <g style="fill: #000000">
  <path d="M-67 173.601C-67 173.601 -63.4 178.801 -59.8 178.801C-56.2 178.801 -55.818 178.388 -53 179.001C-48.4 180.001 -48.8 178.001 -42.2 179.201C-39.56 179.681 -37 178.801 -34.2 180.001C-31.4 181.201 -28.2 180.401 -27 178.401C-25.8 176.401 -21 172.201 -21 172.201C-21 172.201 -33.8 174.001 -36.6 174.801C-36.6 174.801 -59 176.001 -67 173.601z"/>
 </g>
 <g style="fill: #ffffcc; stroke:#000000; stroke-width:0.5">
  <path d="M-22.4 173.801C-22.4 173.801 -28.85 177.301 -29.25 179.701C-29.65 182.101 -24 185.801 -24 185.801C-24 185.801 -21.25 190.401 -20.65 188.001C-20.05 185.601 -21.6 174.201 -22.4 173.801z"/>
 </g>
 <g style="fill: #ffffcc; stroke:#000000; stroke-width:0.5">
  <path d="M-59.885 179.265C-59.885 179.265 -52.878 190.453 -52.661 179.242C-52.661 179.242 -52.104 177.984 -53.864 177.962C-59.939 177.886 -58.418 173.784 -59.885 179.265z"/>
 </g>
 <g style="fill: #ffffcc; stroke:#000000; stroke-width:0.5">
  <path d="M-52.707 179.514C-52.707 179.514 -44.786 190.701 -45.422 179.421C-45.422 179.421 -45.415 179.089 -47.168 178.936C-51.915 178.522 -51.57 174.004 -52.707 179.514z"/>
 </g>
 <g style="fill: #ffffcc; stroke:#000000; stroke-width:0.5">
  <path d="M-45.494 179.522C-45.494 179.522 -37.534 190.15 -38.203 180.484C-38.203 180.484 -38.084 179.251 -39.738 178.95C-43.63 178.244 -43.841 174.995 -45.494 179.522z"/>
 </g>
 <g style="fill: #ffffcc; stroke:#000000; stroke-width:0.5">
  <path d="M-38.618 179.602C-38.618 179.602 -30.718 191.163 -30.37 181.382C-30.37 181.382 -28.726 180.004 -30.472 179.782C-36.29 179.042 -35.492 174.588 -38.618 179.602z"/>
 </g>
 <g style="fill: #e5e5b2">
  <path d="M-74.792 183.132L-82.45 181.601C-85.05 176.601 -87.15 170.451 -87.15 170.451C-87.15 170.451 -80.8 171.451 -68.3 174.251C-68.3 174.251 -67.424 177.569 -65.952 183.364L-74.792 183.132z"/>
 </g>
 <g style="fill: #e5e5b2">
  <path d="M-9.724 178.47C-11.39 175.964 -12.707 174.206 -13.357 173.8C-16.37 171.917 -12.227 172.294 -11.098 172.294C-11.098 172.294 5.473 172.294 7.356 173.047C7.356 173.047 7.88 175.289 8.564 178.68C8.564 178.68 -1.524 176.67 -9.724 178.47z"/>
 </g>
 <g style="fill: #cc7226">
  <path d="M43.88 40.321C71.601 44.281 97.121 8.641 98.881 -1.04C100.641 -10.72 90.521 -22.6 90.521 -22.6C91.841 -25.68 87.001 -39.76 81.721 -49C76.441 -58.24 60.54 -57.266 43 -58.24C27.16 -59.12 8.68 -35.8 7.36 -34.04C6.04 -32.28 12.2 6.001 13.52 11.721C14.84 17.441 12.2 43.841 12.2 43.841C46.44 34.741 16.16 36.361 43.88 40.321z"/>
 </g>
 <g style="fill: #ea8e51">
  <path d="M8.088 -33.392C6.792 -31.664 12.84 5.921 14.136 11.537C15.432 17.153 12.84 43.073 12.84 43.073C45.512 34.193 16.728 35.729 43.944 39.617C71.161 43.505 96.217 8.513 97.945 -0.992C99.673 -10.496 89.737 -22.16 89.737 -22.16C91.033 -25.184 86.281 -39.008 81.097 -48.08C75.913 -57.152 60.302 -56.195 43.08 -57.152C27.528 -58.016 9.384 -35.12 8.088 -33.392z"/>
 </g>
 <g style="fill: #efaa7c">
  <path d="M8.816 -32.744C7.544 -31.048 13.48 5.841 14.752 11.353C16.024 16.865 13.48 42.305 13.48 42.305C44.884 33.145 17.296 35.097 44.008 38.913C70.721 42.729 95.313 8.385 97.009 -0.944C98.705 -10.272 88.953 -21.72 88.953 -21.72C90.225 -24.688 85.561 -38.256 80.473 -47.16C75.385 -56.064 60.063 -55.125 43.16 -56.064C27.896 -56.912 10.088 -34.44 8.816 -32.744z"/>
 </g>
 <g style="fill: #f4c6a8">
  <path d="M9.544 -32.096C8.296 -30.432 14.12 5.761 15.368 11.169C16.616 16.577 14.12 41.537 14.12 41.537C43.556 32.497 17.864 34.465 44.072 38.209C70.281 41.953 94.409 8.257 96.073 -0.895C97.737 -10.048 88.169 -21.28 88.169 -21.28C89.417 -24.192 84.841 -37.504 79.849 -46.24C74.857 -54.976 59.824 -54.055 43.24 -54.976C28.264 -55.808 10.792 -33.76 9.544 -32.096z"/>
 </g>
 <g style="fill: #f9e2d3">
  <path d="M10.272 -31.448C9.048 -29.816 14.76 5.681 15.984 10.985C17.208 16.289 14.76 40.769 14.76 40.769C42.628 31.849 18.432 33.833 44.136 37.505C69.841 41.177 93.505 8.129 95.137 -0.848C96.769 -9.824 87.385 -20.84 87.385 -20.84C88.609 -23.696 84.121 -36.752 79.225 -45.32C74.329 -53.888 59.585 -52.985 43.32 -53.888C28.632 -54.704 11.496 -33.08 10.272 -31.448z"/>
 </g>
 <g style="fill: #ffffff">
  <path d="M44.2 36.8C69.4 40.4 92.601 8 94.201 -0.8C95.801 -9.6 86.601 -20.4 86.601 -20.4C87.801 -23.2 83.4 -36 78.6 -44.4C73.8 -52.8 59.346 -51.914 43.4 -52.8C29 -53.6 12.2 -32.4 11 -30.8C9.8 -29.2 15.4 5.6 16.6 10.8C17.8 16 15.4 40 15.4 40C40.9 31.4 19 33.2 44.2 36.8z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M90.601 2.8C90.601 2.8 62.8 10.4 51.2 8.8C51.2 8.8 35.4 2.2 26.6 24C26.6 24 23 31.2 21 33.2C19 35.2 90.601 2.8 90.601 2.8z"/>
 </g>
 <g style="fill: #000000">
  <path d="M94.401 0.6C94.401 0.6 65.4 12.8 55.4 12.4C55.4 12.4 39 7.8 30.6 22.4C30.6 22.4 22.2 31.6 19 33.2C19 33.2 18.6 34.8 25 30.8L35.4 36C35.4 36 50.2 45.6 59.8 29.6C59.8 29.6 63.8 18.4 63.8 16.4C63.8 14.4 85 8.8 86.601 8.4C88.201 8 94.801 3.8 94.401 0.6z"/>
 </g>
 <g style="fill: #99cc32">
  <path d="M47 36.514C40.128 36.514 31.755 32.649 31.755 26.4C31.755 20.152 40.128 13.887 47 13.887C53.874 13.887 59.446 18.952 59.446 25.2C59.446 31.449 53.874 36.514 47 36.514z"/>
 </g>
 <g style="fill: #659900">
  <path d="M43.377 19.83C38.531 20.552 33.442 22.055 33.514 21.839C35.054 17.22 41.415 13.887 47 13.887C51.296 13.887 55.084 15.865 57.32 18.875C57.32 18.875 52.004 18.545 43.377 19.83z"/>
 </g>
 <g style="fill: #ffffff">
  <path d="M55.4 19.6C55.4 19.6 51 16.4 51 18.6C51 18.6 54.6 23 55.4 19.6z"/>
 </g>
 <g style="fill: #000000">
  <path d="M45.4 27.726C42.901 27.726 40.875 25.7 40.875 23.2C40.875 20.701 42.901 18.675 45.4 18.675C47.9 18.675 49.926 20.701 49.926 23.2C49.926 25.7 47.9 27.726 45.4 27.726z"/>
 </g>
 <g style="fill: #cc7226">
  <path d="M-58.6 14.4C-58.6 14.4 -61.8 -6.8 -59.4 -11.2C-59.4 -11.2 -48.6 -21.2 -49 -24.8C-49 -24.8 -49.4 -42.8 -50.6 -43.6C-51.8 -44.4 -59.4 -50.4 -65.4 -44C-65.4 -44 -75.8 -26 -75 -19.6L-75 -17.6C-75 -17.6 -82.6 -18 -84.2 -16C-84.2 -16 -85.4 -10.8 -86.6 -10.4C-86.6 -10.4 -89.4 -8 -87.4 -5.2C-87.4 -5.2 -89.4 -2.8 -89 1.2L-81.4 5.2C-81.4 5.2 -79.4 19.6 -68.6 24.8C-63.764 27.129 -60.6 20.4 -58.6 14.4z"/>
 </g>
 <g style="fill: #ffffff">
  <path d="M-59.6 12.56C-59.6 12.56 -62.48 -6.52 -60.32 -10.48C-60.32 -10.48 -50.6 -19.48 -50.96 -22.72C-50.96 -22.72 -51.32 -38.92 -52.4 -39.64C-53.48 -40.36 -60.32 -45.76 -65.72 -40C-65.72 -40 -75.08 -23.8 -74.36 -18.04L-74.36 -16.24C-74.36 -16.24 -81.2 -16.6 -82.64 -14.8C-82.64 -14.8 -83.72 -10.12 -84.8 -9.76C-84.8 -9.76 -87.32 -7.6 -85.52 -5.08C-85.52 -5.08 -87.32 -2.92 -86.96 0.68L-80.12 4.28C-80.12 4.28 -78.32 17.24 -68.6 21.92C-64.248 24.015 -61.4 17.96 -59.6 12.56z"/>
 </g>
 <g style="fill: #eb955c">
  <path d="M-51.05 -42.61C-52.14 -43.47 -59.63 -49.24 -65.48 -43C-65.48 -43 -75.62 -25.45 -74.84 -19.21L-74.84 -17.26C-74.84 -17.26 -82.25 -17.65 -83.81 -15.7C-83.81 -15.7 -84.98 -10.63 -86.15 -10.24C-86.15 -10.24 -88.88 -7.9 -86.93 -5.17C-86.93 -5.17 -88.88 -2.83 -88.49 1.07L-81.08 4.97C-81.08 4.97 -79.13 19.01 -68.6 24.08C-63.886 26.35 -60.8 19.79 -58.85 13.94C-58.85 13.94 -61.97 -6.73 -59.63 -11.02C-59.63 -11.02 -49.1 -20.77 -49.49 -24.28C-49.49 -24.28 -49.88 -41.83 -51.05 -42.61z"/>
 </g>
 <g style="fill: #f2b892">
  <path d="M-51.5 -41.62C-52.48 -42.54 -59.86 -48.08 -65.56 -42C-65.56 -42 -75.44 -24.9 -74.68 -18.82L-74.68 -16.92C-74.68 -16.92 -81.9 -17.3 -83.42 -15.4C-83.42 -15.4 -84.56 -10.46 -85.7 -10.08C-85.7 -10.08 -88.36 -7.8 -86.46 -5.14C-86.46 -5.14 -88.36 -2.86 -87.98 0.94L-80.76 4.74C-80.76 4.74 -78.86 18.42 -68.6 23.36C-64.006 25.572 -61 19.18 -59.1 13.48C-59.1 13.48 -62.14 -6.66 -59.86 -10.84C-59.86 -10.84 -49.6 -20.34 -49.98 -23.76C-49.98 -23.76 -50.36 -40.86 -51.5 -41.62z"/>
 </g>
 <g style="fill: #f8dcc8">
  <path d="M-51.95 -40.63C-52.82 -41.61 -60.09 -46.92 -65.64 -41C-65.64 -41 -75.26 -24.35 -74.52 -18.43L-74.52 -16.58C-74.52 -16.58 -81.55 -16.95 -83.03 -15.1C-83.03 -15.1 -84.14 -10.29 -85.25 -9.92C-85.25 -9.92 -87.84 -7.7 -85.99 -5.11C-85.99 -5.11 -87.84 -2.89 -87.47 0.81L-80.44 4.51C-80.44 4.51 -78.59 17.83 -68.6 22.64C-64.127 24.794 -61.2 18.57 -59.35 13.02C-59.35 13.02 -62.31 -6.59 -60.09 -10.66C-60.09 -10.66 -50.1 -19.91 -50.47 -23.24C-50.47 -23.24 -50.84 -39.89 -51.95 -40.63z"/>
 </g>
 <g style="fill: #ffffff">
  <path d="M-59.6 12.46C-59.6 12.46 -62.48 -6.52 -60.32 -10.48C-60.32 -10.48 -50.6 -19.48 -50.96 -22.72C-50.96 -22.72 -51.32 -38.92 -52.4 -39.64C-53.16 -40.68 -60.32 -45.76 -65.72 -40C-65.72 -40 -75.08 -23.8 -74.36 -18.04L-74.36 -16.24C-74.36 -16.24 -81.2 -16.6 -82.64 -14.8C-82.64 -14.8 -83.72 -10.12 -84.8 -9.76C-84.8 -9.76 -87.32 -7.6 -85.52 -5.08C-85.52 -5.08 -87.32 -2.92 -86.96 0.68L-80.12 4.28C-80.12 4.28 -78.32 17.24 -68.6 21.92C-64.248 24.015 -61.4 17.86 -59.6 12.46z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M-62.7 6.2C-62.7 6.2 -84.3 -4 -85.2 -4.8C-85.2 -4.8 -76.1 3.4 -75.3 3.4C-74.5 3.4 -62.7 6.2 -62.7 6.2z"/>
 </g>
 <g style="fill: #000000">
  <path d="M-79.8 0C-79.8 0 -61.4 3.6 -61.4 8C-61.4 10.912 -61.643 24.331 -67 22.8C-75.4 20.4 -71.8 6 -79.8 0z"/>
 </g>
 <g style="fill: #99cc32">
  <path d="M-71.4 3.8C-71.4 3.8 -62.422 5.274 -61.4 8C-60.8 9.6 -60.137 17.908 -65.6 19C-70.152 19.911 -72.382 9.69 -71.4 3.8z"/>
 </g>
 <g style="fill: #000000">
  <path d="M14.595 46.349C14.098 44.607 15.409 44.738 17.2 44.2C19.2 43.6 31.4 39.8 32.2 37.2C33 34.6 46.2 39 46.2 39C48 39.8 52.4 42.4 52.4 42.4C57.2 43.6 63.8 44 63.8 44C66.2 45 69.6 47.8 69.6 47.8C84.2 58 96.601 50.8 96.601 50.8C116.601 44.2 110.601 27 110.601 27C107.601 18 110.801 14.6 110.801 14.6C111.001 10.8 118.201 17.2 118.201 17.2C120.801 21.4 121.601 26.4 121.601 26.4C129.601 37.6 126.201 19.8 126.201 19.8C126.401 18.8 123.601 15.2 123.601 14C123.601 12.8 121.801 9.4 121.801 9.4C118.801 6 121.201 -1 121.201 -1C123.001 -14.8 120.801 -13 120.801 -13C119.601 -14.8 110.401 -4.8 110.401 -4.8C108.201 -1.4 102.201 0.2 102.201 0.2C99.401 2 96.001 0.6 96.001 0.6C93.401 0.2 87.801 7.2 87.801 7.2C90.601 7 93.001 11.4 95.401 11.6C97.801 11.8 99.601 9.2 101.201 8.6C102.801 8 105.601 13.8 105.601 13.8C106.001 16.4 100.401 21.2 100.401 21.2C100.001 25.8 98.401 24.2 98.401 24.2C95.401 23.6 94.201 27.4 93.201 32C92.201 36.6 88.001 37 88.001 37C86.401 44.4 85.2 41.4 85.2 41.4C85 35.8 79 41.6 79 41.6C77.8 43.6 73.2 41.4 73.2 41.4C66.4 39.4 68.8 37.4 68.8 37.4C70.6 35.2 81.8 37.4 81.8 37.4C84 35.8 76 31.8 76 31.8C75.4 30 76.4 25.6 76.4 25.6C77.6 22.4 84.4 16.8 84.4 16.8C93.801 15.6 91.001 14 91.001 14C84.801 8.8 79 16.4 79 16.4C76.8 22.6 59.4 37.6 59.4 37.6C54.6 41 57.2 34.2 53.2 37.6C49.2 41 28.6 32 28.6 32C17.038 30.807 14.306 46.549 10.777 43.429C10.777 43.429 16.195 51.949 14.595 46.349z"/>
 </g>
 <g style="fill: #000000">
  <path d="M209.401 -120C209.401 -120 183.801 -112 181.001 -93.2C181.001 -93.2 178.601 -70.4 199.001 -52.8C199.001 -52.8 199.401 -46.4 201.401 -43.2C201.401 -43.2 199.801 -38.4 218.601 -46L245.801 -54.4C245.801 -54.4 252.201 -56.8 257.401 -65.6C262.601 -74.4 277.801 -93.2 274.201 -118.4C274.201 -118.4 275.401 -129.6 269.401 -130C269.401 -130 261.001 -131.6 253.801 -124C253.801 -124 247.001 -120.8 244.601 -121.2L209.401 -120z"/>
 </g>
 <g style="fill: #000000">
  <path d="M264.022 -120.99C264.022 -120.99 266.122 -129.92 261.282 -125.08C261.282 -125.08 254.242 -119.36 246.761 -119.36C246.761 -119.36 232.241 -117.16 227.841 -103.96C227.841 -103.96 223.881 -77.12 231.801 -71.4C231.801 -71.4 236.641 -63.92 243.681 -70.52C250.722 -77.12 266.222 -107.35 264.022 -120.99z"/>
 </g>
 <g style="fill: #323232">
  <path d="M263.648 -120.632C263.648 -120.632 265.738 -129.376 260.986 -124.624C260.986 -124.624 254.074 -119.008 246.729 -119.008C246.729 -119.008 232.473 -116.848 228.153 -103.888C228.153 -103.888 224.265 -77.536 232.041 -71.92C232.041 -71.92 236.793 -64.576 243.705 -71.056C250.618 -77.536 265.808 -107.24 263.648 -120.632z"/>
 </g>
 <g style="fill: #666666">
  <path d="M263.274 -120.274C263.274 -120.274 265.354 -128.832 260.69 -124.168C260.69 -124.168 253.906 -118.656 246.697 -118.656C246.697 -118.656 232.705 -116.536 228.465 -103.816C228.465 -103.816 224.649 -77.952 232.281 -72.44C232.281 -72.44 236.945 -65.232 243.729 -71.592C250.514 -77.952 265.394 -107.13 263.274 -120.274z"/>
 </g>
 <g style="fill: #999999">
  <path d="M262.9 -119.916C262.9 -119.916 264.97 -128.288 260.394 -123.712C260.394 -123.712 253.738 -118.304 246.665 -118.304C246.665 -118.304 232.937 -116.224 228.777 -103.744C228.777 -103.744 225.033 -78.368 232.521 -72.96C232.521 -72.96 237.097 -65.888 243.753 -72.128C250.41 -78.368 264.98 -107.02 262.9 -119.916z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M262.526 -119.558C262.526 -119.558 264.586 -127.744 260.098 -123.256C260.098 -123.256 253.569 -117.952 246.633 -117.952C246.633 -117.952 233.169 -115.912 229.089 -103.672C229.089 -103.672 225.417 -78.784 232.761 -73.48C232.761 -73.48 237.249 -66.544 243.777 -72.664C250.305 -78.784 264.566 -106.91 262.526 -119.558z"/>
 </g>
 <g style="fill: #ffffff">
  <path d="M262.151 -119.2C262.151 -119.2 264.201 -127.2 259.801 -122.8C259.801 -122.8 253.401 -117.6 246.601 -117.6C246.601 -117.6 233.401 -115.6 229.401 -103.6C229.401 -103.6 225.801 -79.2 233.001 -74C233.001 -74 237.401 -67.2 243.801 -73.2C250.201 -79.2 264.151 -106.8 262.151 -119.2z"/>
 </g>
 <g style="fill: #992600">
  <path d="M50.6 84C50.6 84 30.2 64.8 22.2 64C22.2 64 -12.2 60 -27 78C-27 78 -9.4 57.6 18.2 63.2C18.2 63.2 -3.4 58.8 -15.8 62C-15.8 62 -32.6 62 -42.2 76L-45 80.8C-45 80.8 -41 66 -22.6 60C-22.6 60 0.2 55.2 11 60C11 60 -10.6 53.2 -20.6 55.2C-20.6 55.2 -51 52.8 -63.8 79.2C-63.8 79.2 -59.8 64.8 -45 57.6C-45 57.6 -31.4 48.8 -11 51.6C-11 51.6 3.4 54.8 8.6 57.2C13.8 59.6 12.6 56.8 4.2 52C4.2 52 -1.4 42 -15.4 42.4C-15.4 42.4 -58.2 46 -68.6 58C-68.6 58 -55 46.8 -44.6 44C-44.6 44 -22.2 36 -13.8 36.8C-13.8 36.8 11 37.8 18.6 33.8C18.6 33.8 7.4 38.8 10.6 42C13.8 45.2 20.6 52.8 20.6 54C20.6 55.2 44.8 77.3 48.4 81.7L50.6 84z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M189 278C189 278 173.5 241.5 161 232C161 232 187 248 190.5 266C190.5 266 190.5 276 189 278z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M236 285.5C236 285.5 209.5 230.5 191 206.5C191 206.5 234.5 244 239.5 270.5L240 276L237 273.5C237 273.5 236.5 282.5 236 285.5z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M292.5 237C292.5 237 230 177.5 228.5 175C228.5 175 289 241 292 248.5C292 248.5 290 239.5 292.5 237z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M104 280.5C104 280.5 123.5 228.5 142.5 251C142.5 251 157.5 261 157 264C157 264 153 257.5 135 258C135 258 116 255 104 280.5z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M294.5 153C294.5 153 249.5 124.5 242 123C230.193 120.639 291.5 152 296.5 162.5C296.5 162.5 298.5 160 294.5 153z"/>
 </g>
 <g style="fill: #000000">
  <path d="M143.801 259.601C143.801 259.601 164.201 257.601 171.001 250.801L175.401 254.401L193.001 216.001L196.601 221.201C196.601 221.201 211.001 206.401 210.201 198.401C209.401 190.401 223.001 204.401 223.001 204.401C223.001 204.401 222.201 192.801 229.401 199.601C229.401 199.601 227.001 184.001 235.401 192.001C235.401 192.001 224.864 161.844 247.401 187.601C253.001 194.001 248.601 187.201 248.601 187.201C248.601 187.201 222.601 139.201 244.201 153.601C244.201 153.601 246.201 130.801 245.001 126.401C243.801 122.001 241.801 99.6 237.001 94.4C232.201 89.2 237.401 87.6 243.001 92.8C243.001 92.8 231.801 68.8 245.001 80.8C245.001 80.8 241.401 65.6 237.001 62.8C237.001 62.8 231.401 45.6 246.601 56.4C246.601 56.4 242.201 44 239.001 40.8C239.001 40.8 227.401 13.2 234.601 18L239.001 21.6C239.001 21.6 232.201 7.6 238.601 12C245.001 16.4 245.001 16 245.001 16C245.001 16 223.801 -17.2 244.201 0.4C244.201 0.4 236.042 -13.518 232.601 -20.4C232.601 -20.4 213.801 -40.8 228.201 -34.4L233.001 -32.8C233.001 -32.8 224.201 -42.8 216.201 -44.4C208.201 -46 218.601 -52.4 225.001 -50.4C231.401 -48.4 247.001 -40.8 247.001 -40.8C247.001 -40.8 259.801 -22 263.801 -21.6C263.801 -21.6 243.801 -29.2 249.801 -21.2C249.801 -21.2 264.201 -7.2 257.001 -7.6C257.001 -7.6 251.001 -0.4 255.801 8.4C255.801 8.4 237.342 -9.991 252.201 15.6L259.001 32C259.001 32 234.601 7.2 245.801 29.2C245.801 29.2 263.001 52.8 265.001 53.2C267.001 53.6 271.401 62.4 271.401 62.4L267.001 60.4L272.201 69.2C272.201 69.2 261.001 57.2 267.001 70.4L272.601 84.8C272.601 84.8 252.201 62.8 265.801 92.4C265.801 92.4 249.401 87.2 258.201 104.4C258.201 104.4 256.601 120.401 257.001 125.601C257.401 130.801 258.601 159.201 254.201 167.201C249.801 175.201 260.201 194.401 262.201 198.401C264.201 202.401 267.801 213.201 259.001 204.001C250.201 194.801 254.601 200.401 256.601 209.201C258.601 218.001 264.601 233.601 263.801 239.201C263.801 239.201 262.601 240.401 259.401 236.801C259.401 236.801 244.601 214.001 246.201 228.401C246.201 228.401 245.001 236.401 241.801 245.201C241.801 245.201 238.601 256.001 238.601 247.201C238.601 247.201 235.401 230.401 232.601 238.001C229.801 245.601 226.201 251.601 223.401 254.001C220.601 256.401 215.401 233.601 214.201 244.001C214.201 244.001 202.201 231.601 197.401 248.001L185.801 264.401C185.801 264.401 185.401 252.001 184.201 258.001C184.201 258.001 154.201 264.001 143.801 259.601z"/>
 </g>
 <g style="fill: #000000">
  <path d="M109.401 -97.2C109.401 -97.2 97.801 -105.2 93.801 -104.8C89.801 -104.4 121.401 -113.6 162.601 -86C162.601 -86 167.401 -83.2 171.001 -83.6C171.001 -83.6 174.201 -81.2 171.401 -77.6C171.401 -77.6 162.601 -68 173.801 -56.8C173.801 -56.8 192.201 -50 186.601 -58.8C186.601 -58.8 197.401 -54.8 199.801 -50.8C202.201 -46.8 201.001 -50.8 201.001 -50.8C201.001 -50.8 194.601 -58 188.601 -63.2C188.601 -63.2 183.401 -65.2 180.601 -73.6C177.801 -82 175.401 -92 179.801 -95.2C179.801 -95.2 175.801 -90.8 176.601 -94.8C177.401 -98.8 181.001 -102.4 182.601 -102.8C184.201 -103.2 200.601 -119 207.401 -119.4C207.401 -119.4 198.201 -118 195.201 -119C192.201 -120 165.601 -131.4 159.601 -132.6C159.601 -132.6 142.801 -139.2 154.801 -137.2C154.801 -137.2 190.601 -133.4 208.801 -120.2C208.801 -120.2 201.601 -128.6 183.201 -135.6C183.201 -135.6 161.001 -148.2 125.801 -143.2C125.801 -143.2 108.001 -140 100.201 -138.2C100.201 -138.2 97.601 -138.8 97.001 -139.2C96.401 -139.6 84.6 -148.6 57 -141.6C57 -141.6 40 -137 31.4 -132.2C31.4 -132.2 16.2 -131 12.6 -127.8C12.6 -127.8 -6 -113.2 -8 -112.4C-10 -111.6 -21.4 -104 -22.2 -103.6C-22.2 -103.6 2.4 -110.2 4.8 -112.6C7.2 -115 24.6 -117.6 27 -116.2C29.4 -114.8 37.8 -115.4 28.2 -114.8C28.2 -114.8 103.801 -100 104.601 -98C105.401 -96 109.401 -97.2 109.401 -97.2z"/>
 </g>
 <g style="fill: #cc7226">
  <path d="M180.801 -106.4C180.801 -106.4 170.601 -113.8 168.601 -113.8C166.601 -113.8 154.201 -124 150.001 -123.6C145.801 -123.2 133.601 -133.2 106.201 -125C106.201 -125 105.601 -127 109.201 -127.8C109.201 -127.8 115.601 -130 116.001 -130.6C116.001 -130.6 136.201 -134.8 143.401 -131.2C143.401 -131.2 152.601 -128.6 158.801 -122.4C158.801 -122.4 170.001 -119.2 173.201 -120.2C173.201 -120.2 182.001 -118 182.401 -116.2C182.401 -116.2 188.201 -113.2 186.401 -110.6C186.401 -110.6 186.801 -109 180.801 -106.4z"/>
 </g>
 <g style="fill: #cc7226">
  <path d="M168.33 -108.509C169.137 -107.877 170.156 -107.779 170.761 -106.97C170.995 -106.656 170.706 -106.33 170.391 -106.233C169.348 -105.916 168.292 -106.486 167.15 -105.898C166.748 -105.691 166.106 -105.873 165.553 -106.022C163.921 -106.463 162.092 -106.488 160.401 -105.8C158.416 -106.929 156.056 -106.345 153.975 -107.346C153.917 -107.373 153.695 -107.027 153.621 -107.054C150.575 -108.199 146.832 -107.916 144.401 -110.2C141.973 -110.612 139.616 -111.074 137.188 -111.754C135.37 -112.263 133.961 -113.252 132.341 -114.084C130.964 -114.792 129.507 -115.314 127.973 -115.686C126.11 -116.138 124.279 -116.026 122.386 -116.546C122.293 -116.571 122.101 -116.227 122.019 -116.254C121.695 -116.362 121.405 -116.945 121.234 -116.892C119.553 -116.37 118.065 -117.342 116.401 -117C115.223 -118.224 113.495 -117.979 111.949 -118.421C108.985 -119.269 105.831 -117.999 102.801 -119C106.914 -120.842 111.601 -119.61 115.663 -121.679C117.991 -122.865 120.653 -121.763 123.223 -122.523C123.71 -122.667 124.401 -122.869 124.801 -122.2C124.935 -122.335 125.117 -122.574 125.175 -122.546C127.625 -121.389 129.94 -120.115 132.422 -119.049C132.763 -118.903 133.295 -119.135 133.547 -118.933C135.067 -117.717 137.01 -117.82 138.401 -116.6C140.099 -117.102 141.892 -116.722 143.621 -117.346C143.698 -117.373 143.932 -117.032 143.965 -117.054C145.095 -117.802 146.25 -117.531 147.142 -117.227C147.48 -117.112 148.143 -116.865 148.448 -116.791C149.574 -116.515 150.43 -116.035 151.609 -115.852C151.723 -115.834 151.908 -116.174 151.98 -116.146C153.103 -115.708 154.145 -115.764 154.801 -114.6C154.936 -114.735 155.101 -114.973 155.183 -114.946C156.21 -114.608 156.859 -113.853 157.96 -113.612C158.445 -113.506 159.057 -112.88 159.633 -112.704C162.025 -111.973 163.868 -110.444 166.062 -109.549C166.821 -109.239 167.697 -109.005 168.33 -108.509z"/>
 </g>
 <g style="fill: #cc7226">
  <path d="M91.696 -122.739C89.178 -124.464 86.81 -125.57 84.368 -127.356C84.187 -127.489 83.827 -127.319 83.625 -127.441C82.618 -128.05 81.73 -128.631 80.748 -129.327C80.209 -129.709 79.388 -129.698 78.88 -129.956C76.336 -131.248 73.707 -131.806 71.2 -133C71.882 -133.638 73.004 -133.394 73.6 -134.2C73.795 -133.92 74.033 -133.636 74.386 -133.827C76.064 -134.731 77.914 -134.884 79.59 -134.794C81.294 -134.702 83.014 -134.397 84.789 -134.125C85.096 -134.078 85.295 -133.555 85.618 -133.458C87.846 -132.795 90.235 -133.32 92.354 -132.482C93.945 -131.853 95.515 -131.03 96.754 -129.755C97.006 -129.495 96.681 -129.194 96.401 -129C96.789 -129.109 97.062 -128.903 97.173 -128.59C97.257 -128.351 97.257 -128.049 97.173 -127.81C97.061 -127.498 96.782 -127.397 96.408 -127.346C95.001 -127.156 96.773 -128.536 96.073 -128.088C94.8 -127.274 95.546 -125.868 94.801 -124.6C94.521 -124.794 94.291 -125.012 94.401 -125.4C94.635 -124.878 94.033 -124.588 93.865 -124.272C93.48 -123.547 92.581 -122.132 91.696 -122.739z"/>
 </g>
 <g style="fill: #cc7226">
  <path d="M59.198 -115.391C56.044 -116.185 52.994 -116.07 49.978 -117.346C49.911 -117.374 49.688 -117.027 49.624 -117.054C48.258 -117.648 47.34 -118.614 46.264 -119.66C45.351 -120.548 43.693 -120.161 42.419 -120.648C42.095 -120.772 41.892 -121.284 41.591 -121.323C40.372 -121.48 39.445 -122.429 38.4 -123C40.736 -123.795 43.147 -123.764 45.609 -124.148C45.722 -124.166 45.867 -123.845 46 -123.845C46.136 -123.845 46.266 -124.066 46.4 -124.2C46.595 -123.92 46.897 -123.594 47.154 -123.848C47.702 -124.388 48.258 -124.198 48.798 -124.158C48.942 -124.148 49.067 -123.845 49.2 -123.845C49.336 -123.845 49.467 -124.156 49.6 -124.156C49.736 -124.155 49.867 -123.845 50 -123.845C50.136 -123.845 50.266 -124.066 50.4 -124.2C51.092 -123.418 51.977 -123.972 52.799 -123.793C53.837 -123.566 54.104 -122.418 55.178 -122.12C59.893 -120.816 64.03 -118.671 68.393 -116.584C68.7 -116.437 68.91 -116.189 68.8 -115.8C69.067 -115.8 69.38 -115.888 69.57 -115.756C70.628 -115.024 71.669 -114.476 72.366 -113.378C72.582 -113.039 72.253 -112.632 72.02 -112.684C67.591 -113.679 63.585 -114.287 59.198 -115.391z"/>
 </g>
 <g style="fill: #cc7226">
  <path d="M45.338 -71.179C43.746 -72.398 43.162 -74.429 42.034 -76.221C41.82 -76.561 42.094 -76.875 42.411 -76.964C42.971 -77.123 43.514 -76.645 43.923 -76.443C45.668 -75.581 47.203 -74.339 49.2 -74.2C51.19 -71.966 55.45 -71.581 55.457 -68.2C55.458 -67.341 54.03 -68.259 53.6 -67.4C51.149 -68.403 48.76 -68.3 46.38 -69.767C45.763 -70.148 46.093 -70.601 45.338 -71.179z"/>
 </g>
 <g style="fill: #cc7226">
  <path d="M17.8 -123.756C17.935 -123.755 24.966 -123.522 24.949 -123.408C24.904 -123.099 17.174 -122.05 16.81 -122.22C16.646 -122.296 9.134 -119.866 9 -120C9.268 -120.135 17.534 -123.756 17.8 -123.756z"/>
 </g>
 <g style="fill: #000000">
  <path d="M33.2 -114C33.2 -114 18.4 -112.2 14 -111C9.6 -109.8 -9 -102.2 -12 -100.2C-12 -100.2 -25.4 -94.8 -42.4 -74.8C-42.4 -74.8 -34.8 -78.2 -32.6 -81C-32.6 -81 -19 -93.6 -19.2 -91C-19.2 -91 -7 -99.6 -7.6 -97.4C-7.6 -97.4 16.8 -108.6 14.8 -105.4C14.8 -105.4 36.4 -110 35.4 -108C35.4 -108 54.2 -103.6 51.4 -103.4C51.4 -103.4 45.6 -102.2 52 -98.6C52 -98.6 48.6 -94.2 43.2 -98.2C37.8 -102.2 40.8 -100 35.8 -99C35.8 -99 33.2 -98.2 28.6 -102.2C28.6 -102.2 23 -106.8 14.2 -103.2C14.2 -103.2 -16.4 -90.6 -18.4 -90C-18.4 -90 -22 -87.2 -24.4 -83.6C-24.4 -83.6 -30.2 -79.2 -33.2 -77.8C-33.2 -77.8 -46 -66.2 -47.2 -64.8C-47.2 -64.8 -50.6 -59.6 -51.4 -59.2C-51.4 -59.2 -45 -63 -43 -65C-43 -65 -29 -75 -23.6 -75.8C-23.6 -75.8 -19.2 -78.8 -18.4 -80.2C-18.4 -80.2 -4 -89.4 0.2 -89.4C0.2 -89.4 9.4 -84.2 11.8 -91.2C11.8 -91.2 17.6 -93 23.2 -91.8C23.2 -91.8 26.4 -94.4 25.6 -96.6C25.6 -96.6 27.2 -98.4 28.2 -94.6C28.2 -94.6 31.6 -91 36.4 -93C36.4 -93 40.4 -93.2 38.4 -90.8C38.4 -90.8 34 -87 22.2 -86.8C22.2 -86.8 9.8 -86.2 -6.6 -78.6C-6.6 -78.6 -36.4 -68.2 -45.6 -57.8C-45.6 -57.8 -52 -49 -57.4 -47.8C-57.4 -47.8 -63.2 -47 -69.2 -39.6C-69.2 -39.6 -59.4 -45.4 -50.4 -45.4C-50.4 -45.4 -46.4 -47.8 -50.2 -44.2C-50.2 -44.2 -53.8 -36.6 -52.2 -31.2C-52.2 -31.2 -52.8 -26 -53.6 -24.4C-53.6 -24.4 -61.4 -11.6 -61.4 -9.2C-61.4 -6.8 -60.2 3 -59.8 3.6C-59.4 4.2 -60.8 2 -57 4.4C-53.2 6.8 -50.4 8.4 -49.6 11.2C-48.8 14 -51.6 5.8 -51.8 4C-52 2.2 -56.2 -5 -55.4 -7.4C-55.4 -7.4 -54.4 -6.4 -53.6 -5C-53.6 -5 -54.2 -5.6 -53.6 -9.2C-53.6 -9.2 -52.8 -14.4 -51.4 -17.6C-50 -20.8 -48 -24.6 -47.6 -25.4C-47.2 -26.2 -47.2 -32 -45.8 -29.4L-42.4 -26.8C-42.4 -26.8 -45.2 -29.4 -43 -31.6C-43 -31.6 -44 -37.2 -42.2 -39.8C-42.2 -39.8 -35.2 -48.2 -33.6 -49.2C-32 -50.2 -33.4 -49.8 -33.4 -49.8C-33.4 -49.8 -27.4 -54 -33.2 -52.4C-33.2 -52.4 -37.2 -50.8 -40.2 -50.8C-40.2 -50.8 -47.8 -48.8 -43.8 -53C-39.8 -57.2 -29.8 -62.6 -26 -62.4L-25.2 -60.8L-14 -63.2L-15.2 -62.4C-15.2 -62.4 -15.4 -62.6 -11.2 -63C-7 -63.4 -1.2 -62 0.2 -63.8C1.6 -65.6 5 -66.6 4.6 -65.2C4.2 -63.8 4 -61.8 4 -61.8C4 -61.8 9 -67.6 8.4 -65.4C7.8 -63.2 -0.4 -58 -1.8 -51.8L8.6 -60L12.2 -63C12.2 -63 15.8 -60.8 16 -62.4C16.2 -64 20.8 -69.8 22 -69.6C23.2 -69.4 25.2 -72.2 25 -69.6C24.8 -67 32.4 -61.6 32.4 -61.6C32.4 -61.6 35.6 -63.4 37 -62C38.4 -60.6 42.6 -81.8 42.6 -81.8L67.6 -92.4L111.201 -95.8L94.201 -102.6L33.2 -114z"/>
 </g>
 <g style="stroke:#4c0000; stroke-width:2">
  <path d="M51.4 85C51.4 85 36.4 68.2 28 65.6C28 65.6 14.6 58.8 -10 66.6"/>
 </g>
 <g style="stroke:#4c0000; stroke-width:2">
  <path d="M24.8 64.2C24.8 64.2 -0.4 56.2 -15.8 60.4C-15.8 60.4 -34.2 62.4 -42.6 76.2"/>
 </g>
 <g style="stroke:#4c0000; stroke-width:2">
  <path d="M21.2 63C21.2 63 4.2 55.8 -10.6 53.6C-10.6 53.6 -27.2 51 -43.8 58.2C-43.8 58.2 -56 64.2 -61.4 74.4"/>
 </g>
 <g style="stroke:#4c0000; stroke-width:2">
  <path d="M22.2 63.4C22.2 63.4 6.8 52.4 5.8 51C5.8 51 -1.2 40 -14.2 39.6C-14.2 39.6 -35.6 40.4 -52.8 48.4"/>
 </g>
 <g style="fill: #000000">
  <path d="M20.895 54.407C22.437 55.87 49.4 84.8 49.4 84.8C84.6 121.401 56.6 87.2 56.6 87.2C49 82.4 39.8 63.6 39.8 63.6C38.6 60.8 53.8 70.8 53.8 70.8C57.8 71.6 71.4 90.8 71.4 90.8C64.6 88.4 69.4 95.6 69.4 95.6C72.2 97.6 92.601 113.201 92.601 113.201C96.201 117.201 100.201 118.801 100.201 118.801C114.201 113.601 107.801 126.801 107.801 126.801C110.201 133.601 115.801 122.001 115.801 122.001C127.001 105.2 110.601 107.601 110.601 107.601C80.6 110.401 73.8 94.4 73.8 94.4C71.4 92 80.2 94.4 80.2 94.4C88.601 96.4 73 82 73 82C75.4 82 84.6 88.8 84.6 88.8C95.001 98 97.001 96 97.001 96C115.001 87.2 125.401 94.8 125.401 94.8C127.401 96.4 121.801 103.2 123.401 108.401C125.001 113.601 129.801 126.001 129.801 126.001C127.401 127.601 127.801 138.401 127.801 138.401C144.601 161.601 135.001 159.601 135.001 159.601C119.401 159.201 134.201 166.801 134.201 166.801C137.401 168.801 146.201 176.001 146.201 176.001C143.401 174.801 141.801 180.001 141.801 180.001C146.601 184.001 143.801 188.801 143.801 188.801C137.801 190.001 136.601 194.001 136.601 194.001C143.401 202.001 133.401 202.401 133.401 202.401C137.001 206.801 132.201 218.801 132.201 218.801C127.401 218.801 121.001 224.401 121.001 224.401C123.401 229.201 113.001 234.801 113.001 234.801C104.601 236.401 107.401 243.201 107.401 243.201C99.401 249.201 97.001 265.201 97.001 265.201C96.201 275.601 93.801 278.801 99.001 276.801C104.201 274.801 103.401 262.401 103.401 262.401C98.601 246.801 141.401 230.801 141.401 230.801C145.401 229.201 146.201 224.001 146.201 224.001C148.201 224.401 157.001 232.001 157.001 232.001C164.601 243.201 165.001 234.001 165.001 234.001C166.201 230.401 164.601 224.401 164.601 224.401C170.601 202.801 156.601 196.401 156.601 196.401C146.601 162.801 160.601 171.201 160.601 171.201C163.401 176.801 174.201 182.001 174.201 182.001L177.801 179.601C176.201 174.801 184.601 168.801 184.601 168.801C187.401 175.201 193.401 167.201 193.401 167.201C197.001 142.801 209.401 157.201 209.401 157.201C213.401 158.401 214.601 151.601 214.601 151.601C218.201 141.201 214.601 127.601 214.601 127.601C218.201 127.201 227.801 133.201 227.801 133.201C230.601 129.601 221.401 112.801 225.401 115.201C229.401 117.601 233.801 119.201 233.801 119.201C234.601 117.201 224.601 104.801 224.601 104.801C220.201 102 215.001 81.6 215.001 81.6C222.201 85.2 212.201 70 212.201 70C212.201 66.8 218.201 55.6 218.201 55.6C217.401 48.8 218.201 49.2 218.201 49.2C221.001 50.4 229.001 52 222.201 45.6C215.401 39.2 223.001 34.4 223.001 34.4C227.401 31.6 213.801 32 213.801 32C208.601 27.6 209.001 23.6 209.001 23.6C217.001 25.6 202.601 11.2 200.201 7.6C197.801 4 207.401 -1.2 207.401 -1.2C220.601 -4.8 209.001 -8 209.001 -8C189.401 -7.6 200.201 -18.4 200.201 -18.4C206.201 -18 204.601 -20.4 204.601 -20.4C199.401 -21.6 189.801 -28 189.801 -28C185.801 -31.6 189.401 -30.8 189.401 -30.8C206.201 -29.6 177.401 -40.8 177.401 -40.8C185.401 -40.8 167.401 -51.2 167.401 -51.2C165.401 -52.8 162.201 -60.4 162.201 -60.4C156.201 -65.6 151.401 -72.4 151.401 -72.4C151.001 -76.8 146.201 -81.6 146.201 -81.6C134.601 -95.2 129.001 -94.8 129.001 -94.8C114.201 -98.4 109.001 -97.6 109.001 -97.6L56.2 -93.2C29.8 -80.4 37.6 -59.4 37.6 -59.4C44 -51 53.2 -54.8 53.2 -54.8C57.8 -61 69.4 -58.8 69.4 -58.8C89.801 -55.6 87.201 -59.2 87.201 -59.2C84.801 -63.8 68.6 -70 68.4 -70.6C68.2 -71.2 59.4 -74.6 59.4 -74.6C56.4 -75.8 52 -85 52 -85C48.8 -88.4 64.6 -82.6 64.6 -82.6C63.4 -81.6 70.8 -77.6 70.8 -77.6C88.201 -78.6 98.801 -67.8 98.801 -67.8C109.601 -51.2 109.801 -59.4 109.801 -59.4C112.601 -68.8 100.801 -90 100.801 -90C101.201 -92 109.401 -85.4 109.401 -85.4C110.801 -87.4 111.601 -81.6 111.601 -81.6C111.801 -79.2 115.601 -71.2 115.601 -71.2C118.401 -58.2 122.001 -65.6 122.001 -65.6L126.601 -56.2C128.001 -53.6 122.001 -46 122.001 -46C121.801 -43.2 122.601 -43.4 117.001 -35.8C111.401 -28.2 114.801 -23.8 114.801 -23.8C113.401 -17.2 122.201 -17.6 122.201 -17.6C124.801 -15.4 128.201 -15.4 128.201 -15.4C130.001 -13.4 132.401 -14 132.401 -14C134.001 -17.8 140.201 -15.8 140.201 -15.8C141.601 -18.2 149.801 -18.6 149.801 -18.6C150.801 -21.2 151.201 -22.8 154.601 -23.4C158.001 -24 133.401 -67 133.401 -67C139.801 -67.8 131.601 -80.2 131.601 -80.2C129.401 -86.8 140.801 -72.2 143.001 -70.8C145.201 -69.4 146.201 -67.2 144.601 -67.4C143.001 -67.6 141.201 -65.4 142.601 -65.2C144.001 -65 157.001 -50 160.401 -39.8C163.801 -29.6 169.801 -25.6 176.001 -19.6C182.201 -13.6 181.401 10.6 181.401 10.6C181.001 19.4 187.001 30 187.001 30C189.001 33.8 184.801 52 184.801 52C182.801 54.2 184.201 55 184.201 55C185.201 56.2 192.001 69.4 192.001 69.4C190.201 69.2 193.801 72.8 193.801 72.8C199.001 78.8 192.601 75.8 192.601 75.8C186.601 74.2 193.601 84 193.601 84C194.801 85.8 185.801 81.2 185.801 81.2C176.601 80.6 188.201 87.8 188.201 87.8C196.801 95 185.401 90.6 185.401 90.6C180.801 88.8 184.001 95.6 184.001 95.6C187.201 97.2 204.401 104.2 204.401 104.2C204.801 108.001 201.801 113.001 201.801 113.001C202.201 117.001 200.001 120.401 200.001 120.401C198.801 128.601 198.201 129.401 198.201 129.401C194.001 129.601 186.601 143.401 186.601 143.401C184.801 146.001 174.601 158.001 174.601 158.001C172.601 165.001 154.601 157.801 154.601 157.801C148.001 161.201 150.001 157.801 150.001 157.801C149.601 155.601 154.401 149.601 154.401 149.601C161.401 147.001 158.801 136.201 158.801 136.201C162.801 134.801 151.601 132.001 151.801 130.801C152.001 129.601 157.801 128.201 157.801 128.201C165.801 126.201 161.401 123.801 161.401 123.801C160.801 119.801 163.801 114.201 163.801 114.201C175.401 113.401 163.801 97.2 163.801 97.2C153.001 89.6 152.001 83.8 152.001 83.8C164.601 75.6 156.401 63.2 156.601 59.6C156.801 56 158.001 34.4 158.001 34.4C156.001 28.2 153.001 14.6 153.001 14.6C155.201 9.4 162.601 -3.2 162.601 -3.2C165.401 -7.4 174.201 -12.2 172.001 -15.2C169.801 -18.2 162.001 -16.4 162.001 -16.4C154.201 -17.8 154.801 -12.6 154.801 -12.6C153.201 -11.6 152.401 -6.6 152.401 -6.6C151.68 1.333 142.801 7.6 142.801 7.6C131.601 13.8 140.801 17.8 140.801 17.8C146.801 24.4 137.001 24.6 137.001 24.6C126.001 22.8 134.201 33 134.201 33C145.001 45.8 142.001 48.6 142.001 48.6C131.801 49.6 144.401 58.8 144.401 58.8C144.401 58.8 143.601 56.8 143.801 58.6C144.001 60.4 147.001 64.6 147.801 66.6C148.601 68.6 144.601 68.8 144.601 68.8C145.201 78.4 129.801 74.2 129.801 74.2C129.801 74.2 129.801 74.2 128.201 74.4C126.601 74.6 115.401 73.8 109.601 71.6C103.801 69.4 97.001 69.4 97.001 69.4C97.001 69.4 93.001 71.2 85.4 71C77.8 70.8 69.8 73.6 69.8 73.6C65.4 73.2 74 68.8 74.2 69C74.4 69.2 80 63.6 72 64.2C50.203 65.835 39.4 55.6 39.4 55.6C37.4 54.2 34.8 51.4 34.8 51.4C24.8 49.4 36.2 63.8 36.2 63.8C37.4 65.2 36 66.2 36 66.2C35.2 64.6 27.4 59.2 27.4 59.2C24.589 58.227 23.226 56.893 20.895 54.407z"/>
 </g>
 <g style="fill: #4c0000">
  <path d="M-3 42.8C-3 42.8 8.6 48.4 11.2 51.2C13.8 54 27.8 65.4 27.8 65.4C27.8 65.4 22.4 63.4 19.8 61.6C17.2 59.8 6.4 51.6 6.4 51.6C6.4 51.6 2.6 45.6 -3 42.8z"/>
 </g>
 <g style="fill: #99cc32">
  <path d="M-61.009 11.603C-60.672 11.455 -61.196 8.743 -61.4 8.2C-62.422 5.474 -71.4 4 -71.4 4C-71.627 5.365 -71.682 6.961 -71.576 8.599C-71.576 8.599 -66.708 14.118 -61.009 11.603z"/>
 </g>
 <g style="fill: #659900">
  <path d="M-61.009 11.403C-61.458 11.561 -61.024 8.669 -61.2 8.2C-62.222 5.474 -71.4 3.9 -71.4 3.9C-71.627 5.265 -71.682 6.861 -71.576 8.499C-71.576 8.499 -67.308 13.618 -61.009 11.403z"/>
 </g>
 <g style="fill: #000000">
  <path d="M-65.4 11.546C-66.025 11.546 -66.531 10.406 -66.531 9C-66.531 7.595 -66.025 6.455 -65.4 6.455C-64.775 6.455 -64.268 7.595 -64.268 9C-64.268 10.406 -64.775 11.546 -65.4 11.546z"/>
 </g>
 <g style="fill: #000000">
  <path d="M-65.4 9z"/>
 </g>
 <g style="fill: #000000">
  <path d="M-111 109.601C-111 109.601 -116.6 119.601 -91.8 113.601C-91.8 113.601 -77.8 112.401 -75.4 110.001C-74.2 110.801 -65.834 113.734 -63 114.401C-56.2 116.001 -47.8 106 -47.8 106C-47.8 106 -43.2 95.5 -40.4 95.5C-37.6 95.5 -40.8 97.1 -40.8 97.1C-40.8 97.1 -47.4 107.201 -47 108.801C-47 108.801 -52.2 128.801 -68.2 129.601C-68.2 129.601 -84.35 130.551 -83 136.401C-83 136.401 -74.2 134.001 -71.8 136.401C-71.8 136.401 -61 136.001 -69 142.401L-75.8 154.001C-75.8 154.001 -75.66 157.919 -85.8 154.401C-95.6 151.001 -105.9 138.101 -105.9 138.101C-105.9 138.101 -121.85 123.551 -111 109.601z"/>
 </g>
 <g style="fill: #e59999">
  <path d="M-112.2 113.601C-112.2 113.601 -114.2 123.201 -77.4 112.801C-77.4 112.801 -73 112.801 -70.6 113.601C-68.2 114.401 -56.2 117.201 -54.2 116.001C-54.2 116.001 -61.4 129.601 -73 128.001C-73 128.001 -86.2 129.601 -85.8 134.401C-85.8 134.401 -81.8 141.601 -77 144.001C-77 144.001 -74.2 146.401 -74.6 149.601C-75 152.801 -77.8 154.401 -79.8 155.201C-81.8 156.001 -85 152.801 -86.6 152.801C-88.2 152.801 -96.6 146.401 -101 141.601C-105.4 136.801 -113.8 124.801 -113.4 122.001C-113 119.201 -112.2 113.601 -112.2 113.601z"/>
 </g>
 <g style="fill: #b26565">
  <path d="M-109 131.051C-106.4 135.001 -103.2 139.201 -101 141.601C-96.6 146.401 -88.2 152.801 -86.6 152.801C-85 152.801 -81.8 156.001 -79.8 155.201C-77.8 154.401 -75 152.801 -74.6 149.601C-74.2 146.401 -77 144.001 -77 144.001C-80.066 142.468 -82.806 138.976 -84.385 136.653C-84.385 136.653 -84.2 139.201 -89.4 138.401C-94.6 137.601 -99.8 134.801 -101.4 131.601C-103 128.401 -105.4 126.001 -103.8 129.601C-102.2 133.201 -99.8 136.801 -98.2 137.201C-96.6 137.601 -97 138.801 -99.4 138.401C-101.8 138.001 -104.6 137.601 -109 132.401z"/>
 </g>
 <g style="fill: #992600">
  <path d="M-111.6 110.001C-111.6 110.001 -109.8 96.4 -108.6 92.4C-108.6 92.4 -109.4 85.6 -107 81.4C-104.6 77.2 -102.6 71 -99.6 65.6C-96.6 60.2 -96.4 56.2 -92.4 54.6C-88.4 53 -82.4 44.4 -79.6 43.4C-76.8 42.4 -77 43.2 -77 43.2C-77 43.2 -70.2 28.4 -56.6 32.4C-56.6 32.4 -72.8 29.6 -57 20.2C-57 20.2 -61.8 21.3 -58.5 14.3C-56.299 9.632 -56.8 16.4 -67.8 28.2C-67.8 28.2 -72.8 36.8 -78 39.8C-83.2 42.8 -95.2 49.8 -96.4 53.6C-97.6 57.4 -100.8 63.2 -102.8 64.8C-104.8 66.4 -107.6 70.6 -108 74C-108 74 -109.2 78 -110.6 79.2C-112 80.4 -112.2 83.6 -112.2 85.6C-112.2 87.6 -114.2 90.4 -114 92.8C-114 92.8 -113.2 111.801 -113.6 113.801L-111.6 110.001z"/>
 </g>
 <g style="fill: #ffffff">
  <path d="M-120.2 114.601C-120.2 114.601 -122.2 113.201 -126.6 119.201C-126.6 119.201 -119.3 152.201 -119.3 153.601C-119.3 153.601 -118.2 151.501 -119.5 144.301C-120.8 137.101 -121.7 124.401 -121.7 124.401L-120.2 114.601z"/>
 </g>
 <g style="fill: #992600">
  <path d="M-98.6 54C-98.6 54 -116.2 57.2 -115.8 86.4L-116.6 111.201C-116.6 111.201 -117.8 85.6 -119 84C-120.2 82.4 -116.2 71.2 -119.4 77.2C-119.4 77.2 -133.4 91.2 -125.4 112.401C-125.4 112.401 -123.9 115.701 -126.9 111.101C-126.9 111.101 -131.5 98.5 -130.4 92.1C-130.4 92.1 -130.2 89.9 -128.3 87.1C-128.3 87.1 -119.7 75.4 -117 73.1C-117 73.1 -115.2 58.7 -99.8 53.5C-99.8 53.5 -94.1 51.2 -98.6 54z"/>
 </g>
 <g style="fill: #000000">
  <path d="M40.8 -12.2C41.46 -12.554 41.451 -13.524 42.031 -13.697C43.18 -14.041 43.344 -15.108 43.862 -15.892C44.735 -17.211 44.928 -18.744 45.51 -20.235C45.782 -20.935 45.809 -21.89 45.496 -22.55C44.322 -25.031 43.62 -27.48 42.178 -29.906C41.91 -30.356 41.648 -31.15 41.447 -31.748C40.984 -33.132 39.727 -34.123 38.867 -35.443C38.579 -35.884 39.104 -36.809 38.388 -36.893C37.491 -36.998 36.042 -37.578 35.809 -36.552C35.221 -33.965 36.232 -31.442 37.2 -29C36.418 -28.308 36.752 -27.387 36.904 -26.62C37.614 -23.014 36.416 -19.662 35.655 -16.188C35.632 -16.084 35.974 -15.886 35.946 -15.824C34.724 -13.138 33.272 -10.693 31.453 -8.312C30.695 -7.32 29.823 -6.404 29.326 -5.341C28.958 -4.554 28.55 -3.588 28.8 -2.6C25.365 0.18 23.115 4.025 20.504 7.871C20.042 8.551 20.333 9.76 20.884 10.029C21.697 10.427 22.653 9.403 23.123 8.557C23.512 7.859 23.865 7.209 24.356 6.566C24.489 6.391 24.31 5.972 24.445 5.851C27.078 3.504 28.747 0.568 31.2 -1.8C33.15 -2.129 34.687 -3.127 36.435 -4.14C36.743 -4.319 37.267 -4.07 37.557 -4.265C39.31 -5.442 39.308 -7.478 39.414 -9.388C39.464 -10.272 39.66 -11.589 40.8 -12.2z"/>
 </g>
 <g style="fill: #000000">
  <path d="M31.959 -16.666C32.083 -16.743 31.928 -17.166 32.037 -17.382C32.199 -17.706 32.602 -17.894 32.764 -18.218C32.873 -18.434 32.71 -18.814 32.846 -18.956C35.179 -21.403 35.436 -24.427 34.4 -27.4C35.424 -28.02 35.485 -29.282 35.06 -30.129C34.207 -31.829 34.014 -33.755 33.039 -35.298C32.237 -36.567 30.659 -37.811 29.288 -36.508C28.867 -36.108 28.546 -35.321 28.824 -34.609C28.888 -34.446 29.173 -34.3 29.146 -34.218C29.039 -33.894 28.493 -33.67 28.487 -33.398C28.457 -31.902 27.503 -30.391 28.133 -29.062C28.905 -27.433 29.724 -25.576 30.4 -23.8C29.166 -21.684 30.199 -19.235 28.446 -17.358C28.31 -17.212 28.319 -16.826 28.441 -16.624C28.733 -16.138 29.139 -15.732 29.625 -15.44C29.827 -15.319 30.175 -15.317 30.375 -15.441C30.953 -15.803 31.351 -16.29 31.959 -16.666z"/>
 </g>
 <g style="fill: #000000">
  <path d="M94.771 -26.977C96.16 -25.185 96.45 -22.39 94.401 -21C94.951 -17.691 98.302 -19.67 100.401 -20.2C100.292 -20.588 100.519 -20.932 100.802 -20.937C101.859 -20.952 102.539 -21.984 103.601 -21.8C104.035 -23.357 105.673 -24.059 106.317 -25.439C108.043 -29.134 107.452 -33.407 104.868 -36.653C104.666 -36.907 104.883 -37.424 104.759 -37.786C104.003 -39.997 101.935 -40.312 100.001 -41C98.824 -44.875 98.163 -48.906 96.401 -52.6C94.787 -52.85 94.089 -54.589 92.752 -55.309C91.419 -56.028 90.851 -54.449 90.892 -53.403C90.899 -53.198 91.351 -52.974 91.181 -52.609C91.105 -52.445 90.845 -52.334 90.845 -52.2C90.846 -52.065 91.067 -51.934 91.201 -51.8C90.283 -50.98 88.86 -50.503 88.565 -49.358C87.611 -45.648 90.184 -42.523 91.852 -39.322C92.443 -38.187 91.707 -36.916 90.947 -35.708C90.509 -35.013 90.617 -33.886 90.893 -33.03C91.645 -30.699 93.236 -28.96 94.771 -26.977z"/>
 </g>
 <g style="fill: #000000">
  <path d="M57.611 -8.591C56.124 -6.74 52.712 -4.171 55.629 -2.243C55.823 -2.114 56.193 -2.11 56.366 -2.244C58.387 -3.809 60.39 -4.712 62.826 -5.294C62.95 -5.323 63.224 -4.856 63.593 -5.017C65.206 -5.72 67.216 -5.662 68.4 -7C72.167 -6.776 75.732 -7.892 79.123 -9.2C80.284 -9.648 81.554 -10.207 82.755 -10.709C84.131 -11.285 85.335 -12.213 86.447 -13.354C86.58 -13.49 86.934 -13.4 87.201 -13.4C87.161 -14.263 88.123 -14.39 88.37 -15.012C88.462 -15.244 88.312 -15.64 88.445 -15.742C90.583 -17.372 91.503 -19.39 90.334 -21.767C90.049 -22.345 89.8 -22.963 89.234 -23.439C88.149 -24.35 87.047 -23.496 86 -23.8C85.841 -23.172 85.112 -23.344 84.726 -23.146C83.867 -22.707 82.534 -23.292 81.675 -22.854C80.313 -22.159 79.072 -21.99 77.65 -21.613C77.338 -21.531 76.56 -21.627 76.4 -21C76.266 -21.134 76.118 -21.368 76.012 -21.346C74.104 -20.95 72.844 -20.736 71.543 -19.044C71.44 -18.911 70.998 -19.09 70.839 -18.955C69.882 -18.147 69.477 -16.913 68.376 -16.241C68.175 -16.118 67.823 -16.286 67.629 -16.157C66.983 -15.726 66.616 -15.085 65.974 -14.638C65.645 -14.409 65.245 -14.734 65.277 -14.99C65.522 -16.937 66.175 -18.724 65.6 -20.6C67.677 -23.12 70.194 -25.069 72 -27.8C72.015 -29.966 72.707 -32.112 72.594 -34.189C72.584 -34.382 72.296 -35.115 72.17 -35.462C71.858 -36.316 72.764 -37.382 71.92 -38.106C70.516 -39.309 69.224 -38.433 68.4 -37C66.562 -36.61 64.496 -35.917 62.918 -37.151C61.911 -37.938 61.333 -38.844 60.534 -39.9C59.549 -41.202 59.884 -42.638 59.954 -44.202C59.96 -44.33 59.645 -44.466 59.645 -44.6C59.646 -44.735 59.866 -44.866 60 -45C59.294 -45.626 59.019 -46.684 58 -47C58.305 -48.092 57.629 -48.976 56.758 -49.278C54.763 -49.969 53.086 -48.057 51.194 -47.984C50.68 -47.965 50.213 -49.003 49.564 -49.328C49.132 -49.544 48.428 -49.577 48.066 -49.311C47.378 -48.807 46.789 -48.693 46.031 -48.488C44.414 -48.052 43.136 -46.958 41.656 -46.103C40.171 -45.246 39.216 -43.809 38.136 -42.489C37.195 -41.337 37.059 -38.923 38.479 -38.423C40.322 -37.773 41.626 -40.476 43.592 -40.15C43.904 -40.099 44.11 -39.788 44 -39.4C44.389 -39.291 44.607 -39.52 44.8 -39.8C45.658 -38.781 46.822 -38.444 47.76 -37.571C48.73 -36.667 50.476 -37.085 51.491 -36.088C53.02 -34.586 52.461 -31.905 54.4 -30.6C53.814 -29.287 53.207 -28.01 52.872 -26.583C52.59 -25.377 53.584 -24.18 54.795 -24.271C56.053 -24.365 56.315 -25.124 56.8 -26.2C57.067 -25.933 57.536 -25.636 57.495 -25.42C57.038 -23.033 56.011 -21.04 55.553 -18.609C55.494 -18.292 55.189 -18.09 54.8 -18.2C54.332 -14.051 50.28 -11.657 47.735 -8.492C47.332 -7.99 47.328 -6.741 47.737 -6.338C49.14 -4.951 51.1 -6.497 52.8 -7C53.013 -8.206 53.872 -9.148 55.204 -9.092C55.46 -9.082 55.695 -9.624 56.019 -9.754C56.367 -9.892 56.869 -9.668 57.155 -9.866C58.884 -11.061 60.292 -12.167 62.03 -13.356C62.222 -13.487 62.566 -13.328 62.782 -13.436C63.107 -13.598 63.294 -13.985 63.617 -14.17C63.965 -14.37 64.207 -14.08 64.4 -13.8C63.754 -13.451 63.75 -12.494 63.168 -12.292C62.393 -12.024 61.832 -11.511 61.158 -11.064C60.866 -10.871 60.207 -11.119 60.103 -10.94C59.505 -9.912 58.321 -9.474 57.611 -8.591z"/>
 </g>
 <g style="fill: #000000">
  <path d="M2.2 -58C2.2 -58 -7.038 -60.872 -18.2 -35.2C-18.2 -35.2 -20.6 -30 -23 -28C-25.4 -26 -36.6 -22.4 -38.6 -18.4L-49 -2.4C-49 -2.4 -34.2 -18.4 -31 -20.8C-31 -20.8 -23 -29.2 -26.2 -22.4C-26.2 -22.4 -40.2 -11.6 -39 -2.4C-39 -2.4 -44.6 12 -45.4 14C-45.4 14 -29.4 -18 -27 -19.2C-24.6 -20.4 -23.4 -20.4 -24.6 -16.8C-25.8 -13.2 -26.2 3.2 -29 5.2C-29 5.2 -21 -15.2 -21.8 -18.4C-21.8 -18.4 -18.6 -22 -16.2 -16.8L-17.4 -0.8L-13 11.2C-13 11.2 -15.4 0 -13.8 -15.6C-13.8 -15.6 -15.8 -26 -11.8 -20.4C-7.8 -14.8 1.8 -8.8 1.8 -4C1.8 -4 -3.4 -21.6 -12.6 -26.4L-16.6 -20.4L-17.8 -22.4C-17.8 -22.4 -21.4 -23.2 -17 -30C-12.6 -36.8 -13 -37.6 -13 -37.6C-13 -37.6 -6.6 -30.4 -5 -30.4C-5 -30.4 8.2 -38 9.4 -13.6C9.4 -13.6 16.2 -28 7 -34.8C7 -34.8 -7.8 -36.8 -6.6 -42L0.6 -54.4C4.2 -59.6 2.6 -56.8 2.6 -56.8z"/>
 </g>
 <g style="fill: #000000">
  <path d="M-17.8 -41.6C-17.8 -41.6 -30.6 -41.6 -33.8 -36.4L-41 -26.8C-41 -26.8 -23.8 -36.8 -19.8 -38C-15.8 -39.2 -17.8 -41.6 -17.8 -41.6z"/>
 </g>
 <g style="fill: #000000">
  <path d="M-57.8 -35.2C-57.8 -35.2 -59.8 -34 -60.2 -31.2C-60.6 -28.4 -63 -28 -62.2 -25.2C-61.4 -22.4 -59.4 -20 -59.4 -24C-59.4 -28 -57.8 -30 -57 -31.2C-56.2 -32.4 -54.6 -36.8 -57.8 -35.2z"/>
 </g>
 <g style="fill: #000000">
  <path d="M-66.6 26C-66.6 26 -75 22 -78.2 18.4C-81.4 14.8 -80.948 19.966 -85.8 19.6C-91.647 19.159 -90.6 3.2 -90.6 3.2L-94.6 10.8C-94.6 10.8 -95.8 25.2 -87.8 22.8C-83.893 21.628 -82.6 23.2 -84.2 24C-85.8 24.8 -78.6 25.2 -81.4 26.8C-84.2 28.4 -69.8 23.2 -72.2 33.6L-66.6 26z"/>
 </g>
 <g style="fill: #000000">
  <path d="M-79.2 40.4C-79.2 40.4 -94.6 44.8 -98.2 35.2C-98.2 35.2 -103 37.6 -100.8 40.6C-98.6 43.6 -97.4 44 -97.4 44C-97.4 44 -92 45.2 -92.6 46C-93.2 46.8 -95.6 50.2 -95.6 50.2C-95.6 50.2 -85.4 44.2 -79.2 40.4z"/>
 </g>
 <g style="fill: #ffffff">
  <path d="M149.201 118.601C148.774 120.735 147.103 121.536 145.201 122.201C143.284 121.243 140.686 118.137 138.801 120.201C138.327 119.721 137.548 119.661 137.204 118.999C136.739 118.101 137.011 117.055 136.669 116.257C136.124 114.985 135.415 113.619 135.601 112.201C137.407 111.489 138.002 109.583 137.528 107.82C137.459 107.563 137.03 107.366 137.23 107.017C137.416 106.694 137.734 106.467 138.001 106.2C137.866 106.335 137.721 106.568 137.61 106.548C137 106.442 137.124 105.805 137.254 105.418C137.839 103.672 139.853 103.408 141.201 104.6C141.457 104.035 141.966 104.229 142.401 104.2C142.351 103.621 142.759 103.094 142.957 102.674C143.475 101.576 145.104 102.682 145.901 102.07C146.977 101.245 148.04 100.546 149.118 101.149C150.927 102.162 152.636 103.374 153.835 105.115C154.41 105.949 154.65 107.23 154.592 108.188C154.554 108.835 153.173 108.483 152.83 109.412C152.185 111.16 154.016 111.679 154.772 113.017C154.97 113.366 154.706 113.67 154.391 113.768C153.98 113.896 153.196 113.707 153.334 114.16C154.306 117.353 151.55 118.031 149.201 118.601z"/>
 </g>
 <g style="fill: #ffffff">
  <path d="M139.6 138.201C139.593 136.463 137.992 134.707 139.201 133.001C139.336 133.135 139.467 133.356 139.601 133.356C139.736 133.356 139.867 133.135 140.001 133.001C141.496 135.217 145.148 136.145 145.006 138.991C144.984 139.438 143.897 140.356 144.801 141.001C142.988 142.349 142.933 144.719 142.001 146.601C140.763 146.315 139.551 145.952 138.401 145.401C138.753 143.915 138.636 142.231 139.456 140.911C139.89 140.213 139.603 139.134 139.6 138.201z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M-26.6 129.201C-26.6 129.201 -43.458 139.337 -29.4 124.001C-20.6 114.401 -10.6 108.801 -10.6 108.801C-10.6 108.801 -0.2 104.4 3.4 103.2C7 102 22.2 96.8 25.4 96.4C28.6 96 38.2 92 45 96C51.8 100 59.8 104.4 59.8 104.4C59.8 104.4 43.4 96 39.8 98.4C36.2 100.8 29 100.4 23 103.6C23 103.6 8.2 108.001 5 110.001C1.8 112.001 -8.6 123.601 -10.2 122.801C-11.8 122.001 -9.8 121.601 -8.6 118.801C-7.4 116.001 -9.4 114.401 -17.4 120.801C-25.4 127.201 -26.6 129.201 -26.6 129.201z"/>
 </g>
 <g style="fill: #000000">
  <path d="M-19.195 123.234C-19.195 123.234 -17.785 110.194 -9.307 111.859C-9.307 111.859 -1.081 107.689 1.641 105.721C1.641 105.721 9.78 104.019 11.09 103.402C29.569 94.702 44.288 99.221 44.835 98.101C45.381 96.982 65.006 104.099 68.615 108.185C69.006 108.628 58.384 102.588 48.686 100.697C40.413 99.083 18.811 100.944 7.905 106.48C4.932 107.989 -4.013 113.773 -6.544 113.662C-9.075 113.55 -19.195 123.234 -19.195 123.234z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M-23 148.801C-23 148.801 -38.2 146.401 -21.4 144.801C-21.4 144.801 -3.4 142.801 0.6 137.601C0.6 137.601 14.2 128.401 17 128.001C19.8 127.601 49.8 120.401 50.2 118.001C50.6 115.601 56.2 115.601 57.8 116.401C59.4 117.201 58.6 118.401 55.8 119.201C53 120.001 21.8 136.401 15.4 137.601C9 138.801 -2.6 146.401 -7.4 147.601C-12.2 148.801 -23 148.801 -23 148.801z"/>
 </g>
 <g style="fill: #000000">
  <path d="M-3.48 141.403C-3.48 141.403 -12.062 140.574 -3.461 139.755C-3.461 139.755 5.355 136.331 7.403 133.668C7.403 133.668 14.367 128.957 15.8 128.753C17.234 128.548 31.194 124.861 31.399 123.633C31.604 122.404 65.67 109.823 70.09 113.013C73.001 115.114 63.1 113.437 53.466 117.847C52.111 118.467 18.258 133.054 14.981 133.668C11.704 134.283 5.765 138.174 3.307 138.788C0.85 139.403 -3.48 141.403 -3.48 141.403z"/>
 </g>
 <g style="fill: #000000">
  <path d="M-11.4 143.601C-11.4 143.601 -6.2 143.201 -7.4 144.801C-8.6 146.401 -11 145.601 -11 145.601L-11.4 143.601z"/>
 </g>
 <g style="fill: #000000">
  <path d="M-18.6 145.201C-18.6 145.201 -13.4 144.801 -14.6 146.401C-15.8 148.001 -18.2 147.201 -18.2 147.201L-18.6 145.201z"/>
 </g>
 <g style="fill: #000000">
  <path d="M-29 146.801C-29 146.801 -23.8 146.401 -25 148.001C-26.2 149.601 -28.6 148.801 -28.6 148.801L-29 146.801z"/>
 </g>
 <g style="fill: #000000">
  <path d="M-36.6 147.601C-36.6 147.601 -31.4 147.201 -32.6 148.801C-33.8 150.401 -36.2 149.601 -36.2 149.601L-36.6 147.601z"/>
 </g>
 <g style="fill: #000000">
  <path d="M1.8 108.001C1.8 108.001 6.2 108.001 5 109.601C3.8 111.201 0.6 110.801 0.6 110.801L1.8 108.001z"/>
 </g>
 <g style="fill: #000000">
  <path d="M-8.2 113.601C-8.2 113.601 -1.694 111.46 -4.2 114.801C-5.4 116.401 -7.8 115.601 -7.8 115.601L-8.2 113.601z"/>
 </g>
 <g style="fill: #000000">
  <path d="M-19.4 118.401C-19.4 118.401 -14.2 118.001 -15.4 119.601C-16.6 121.201 -19 120.401 -19 120.401L-19.4 118.401z"/>
 </g>
 <g style="fill: #000000">
  <path d="M-27 124.401C-27 124.401 -21.8 124.001 -23 125.601C-24.2 127.201 -26.6 126.401 -26.6 126.401L-27 124.401z"/>
 </g>
 <g style="fill: #000000">
  <path d="M-33.8 129.201C-33.8 129.201 -28.6 128.801 -29.8 130.401C-31 132.001 -33.4 131.201 -33.4 131.201L-33.8 129.201z"/>
 </g>
 <g style="fill: #000000">
  <path d="M5.282 135.598C5.282 135.598 12.203 135.066 10.606 137.195C9.009 139.325 5.814 138.26 5.814 138.26L5.282 135.598z"/>
 </g>
 <g style="fill: #000000">
  <path d="M15.682 130.798C15.682 130.798 22.603 130.266 21.006 132.395C19.409 134.525 16.214 133.46 16.214 133.46L15.682 130.798z"/>
 </g>
 <g style="fill: #000000">
  <path d="M26.482 126.398C26.482 126.398 33.403 125.866 31.806 127.995C30.209 130.125 27.014 129.06 27.014 129.06L26.482 126.398z"/>
 </g>
 <g style="fill: #000000">
  <path d="M36.882 121.598C36.882 121.598 43.803 121.066 42.206 123.195C40.609 125.325 37.414 124.26 37.414 124.26L36.882 121.598z"/>
 </g>
 <g style="fill: #000000">
  <path d="M9.282 103.598C9.282 103.598 16.203 103.066 14.606 105.195C13.009 107.325 9.014 107.06 9.014 107.06L9.282 103.598z"/>
 </g>
 <g style="fill: #000000">
  <path d="M19.282 100.398C19.282 100.398 26.203 99.866 24.606 101.995C23.009 104.125 18.614 103.86 18.614 103.86L19.282 100.398z"/>
 </g>
 <g style="fill: #000000">
  <path d="M-3.4 140.401C-3.4 140.401 1.8 140.001 0.6 141.601C-0.6 143.201 -3 142.401 -3 142.401L-3.4 140.401z"/>
 </g>
 <g style="fill: #992600">
  <path d="M-76.6 41.2C-76.6 41.2 -81 50 -81.4 53.2C-81.4 53.2 -80.6 44.4 -79.4 42.4C-78.2 40.4 -76.6 41.2 -76.6 41.2z"/>
 </g>
 <g style="fill: #992600">
  <path d="M-95 55.2C-95 55.2 -98.2 69.6 -97.8 72.4C-97.8 72.4 -99 60.8 -98.6 59.6C-98.2 58.4 -95 55.2 -95 55.2z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M-74.2 -19.4L-74.4 -16.2L-76.6 -16C-76.6 -16 -62.4 -3.4 -61.8 4.2C-61.8 4.2 -61 -4 -74.2 -19.4z"/>
 </g>
 <g style="fill: #000000">
  <path d="M-70.216 -18.135C-70.647 -18.551 -70.428 -19.296 -70.836 -19.556C-71.645 -20.072 -69.538 -20.129 -69.766 -20.845C-70.149 -22.051 -69.962 -22.072 -70.084 -23.348C-70.141 -23.946 -69.553 -25.486 -69.168 -25.926C-67.722 -27.578 -69.046 -30.51 -67.406 -32.061C-67.102 -32.35 -66.726 -32.902 -66.441 -33.32C-65.782 -34.283 -64.598 -34.771 -63.648 -35.599C-63.33 -35.875 -63.531 -36.702 -62.962 -36.61C-62.248 -36.495 -61.007 -36.625 -61.052 -35.784C-61.165 -33.664 -62.494 -31.944 -63.774 -30.276C-63.323 -29.572 -63.781 -28.937 -64.065 -28.38C-65.4 -25.76 -65.211 -22.919 -65.385 -20.079C-65.39 -19.994 -65.697 -19.916 -65.689 -19.863C-65.336 -17.528 -64.752 -15.329 -63.873 -13.1C-63.507 -12.17 -63.036 -11.275 -62.886 -10.348C-62.775 -9.662 -62.672 -8.829 -63.08 -8.124C-61.045 -5.234 -62.354 -2.583 -61.185 0.948C-60.978 1.573 -59.286 3.487 -59.749 3.326C-62.262 2.455 -62.374 2.057 -62.551 1.304C-62.697 0.681 -63.027 -0.696 -63.264 -1.298C-63.328 -1.462 -63.499 -3.346 -63.577 -3.468C-65.09 -5.85 -63.732 -5.674 -65.102 -8.032C-66.53 -8.712 -67.496 -9.816 -68.619 -10.978C-68.817 -11.182 -67.674 -11.906 -67.855 -12.119C-68.947 -13.408 -70.1 -14.175 -69.764 -15.668C-69.609 -16.358 -69.472 -17.415 -70.216 -18.135z"/>
 </g>
 <g style="fill: #000000">
  <path d="M-73.8 -16.4C-73.8 -16.4 -73.4 -9.6 -71 -8C-68.6 -6.4 -69.8 -7.2 -73 -8.4C-76.2 -9.6 -75 -10.4 -75 -10.4C-75 -10.4 -77.8 -10 -75.4 -8C-73 -6 -69.4 -3.6 -71 -3.6C-72.6 -3.6 -80.2 -7.6 -80.2 -10.4C-80.2 -13.2 -81.2 -17.3 -81.2 -17.3C-81.2 -17.3 -80.1 -18.1 -75.3 -18C-75.3 -18 -73.9 -17.3 -73.8 -16.4z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.1">
  <path d="M-74.6 2.2C-74.6 2.2 -83.12 -0.591 -101.6 2.8C-101.6 2.8 -92.569 0.722 -73.8 3C-63.5 4.25 -74.6 2.2 -74.6 2.2z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.1">
  <path d="M-72.502 2.129C-72.502 2.129 -80.748 -1.389 -99.453 0.392C-99.453 0.392 -90.275 -0.897 -71.774 2.995C-61.62 5.131 -72.502 2.129 -72.502 2.129z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.1">
  <path d="M-70.714 2.222C-70.714 2.222 -78.676 -1.899 -97.461 -1.514C-97.461 -1.514 -88.213 -2.118 -70.052 3.14C-60.086 6.025 -70.714 2.222 -70.714 2.222z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.1">
  <path d="M-69.444 2.445C-69.444 2.445 -76.268 -1.862 -93.142 -2.96C-93.142 -2.96 -84.803 -2.79 -68.922 3.319C-60.206 6.672 -69.444 2.445 -69.444 2.445z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.1">
  <path d="M45.84 12.961C45.84 12.961 44.91 13.605 45.124 12.424C45.339 11.243 73.547 -1.927 77.161 -1.677C77.161 -1.677 46.913 11.529 45.84 12.961z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.1">
  <path d="M42.446 13.6C42.446 13.6 41.57 14.315 41.691 13.121C41.812 11.927 68.899 -3.418 72.521 -3.452C72.521 -3.452 43.404 12.089 42.446 13.6z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.1">
  <path d="M39.16 14.975C39.16 14.975 38.332 15.747 38.374 14.547C38.416 13.348 58.233 -2.149 68.045 -4.023C68.045 -4.023 50.015 4.104 39.16 14.975z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.1">
  <path d="M36.284 16.838C36.284 16.838 35.539 17.532 35.577 16.453C35.615 15.373 53.449 1.426 62.28 -0.26C62.28 -0.26 46.054 7.054 36.284 16.838z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M4.6 164.801C4.6 164.801 -10.6 162.401 6.2 160.801C6.2 160.801 24.2 158.801 28.2 153.601C28.2 153.601 41.8 144.401 44.6 144.001C47.4 143.601 63.8 140.001 64.2 137.601C64.6 135.201 70.6 132.801 72.2 133.601C73.8 134.401 73.8 143.601 71 144.401C68.2 145.201 49.4 152.401 43 153.601C36.6 154.801 25 162.401 20.2 163.601C15.4 164.801 4.6 164.801 4.6 164.801z"/>
 </g>
 <g style="fill: #000000">
  <path d="M77.6 127.401C77.6 127.401 74.6 129.001 73.4 131.601C73.4 131.601 67 142.201 52.8 145.401C52.8 145.401 29.8 154.401 22 156.401C22 156.401 8.6 161.401 1.2 160.601C1.2 160.601 -5.8 160.801 0.4 162.401C0.4 162.401 20.6 160.401 24 158.601C24 158.601 39.6 153.401 42.6 150.801C45.6 148.201 63.8 143.201 66 141.201C68.2 139.201 78 130.801 77.6 127.401z"/>
 </g>
 <g style="fill: #000000">
  <path d="M18.882 158.911C18.882 158.911 24.111 158.685 22.958 160.234C21.805 161.784 19.357 160.91 19.357 160.91L18.882 158.911z"/>
 </g>
 <g style="fill: #000000">
  <path d="M11.68 160.263C11.68 160.263 16.908 160.037 15.756 161.586C14.603 163.136 12.155 162.263 12.155 162.263L11.68 160.263z"/>
 </g>
 <g style="fill: #000000">
  <path d="M1.251 161.511C1.251 161.511 6.48 161.284 5.327 162.834C4.174 164.383 1.726 163.51 1.726 163.51L1.251 161.511z"/>
 </g>
 <g style="fill: #000000">
  <path d="M-6.383 162.055C-6.383 162.055 -1.154 161.829 -2.307 163.378C-3.46 164.928 -5.908 164.054 -5.908 164.054L-6.383 162.055z"/>
 </g>
 <g style="fill: #000000">
  <path d="M35.415 151.513C35.415 151.513 42.375 151.212 40.84 153.274C39.306 155.336 36.047 154.174 36.047 154.174L35.415 151.513z"/>
 </g>
 <g style="fill: #000000">
  <path d="M45.73 147.088C45.73 147.088 51.689 143.787 51.155 148.849C50.885 151.405 46.362 149.749 46.362 149.749L45.73 147.088z"/>
 </g>
 <g style="fill: #000000">
  <path d="M54.862 144.274C54.862 144.274 62.021 140.573 60.287 146.035C59.509 148.485 55.493 146.935 55.493 146.935L54.862 144.274z"/>
 </g>
 <g style="fill: #000000">
  <path d="M64.376 139.449C64.376 139.449 68.735 134.548 69.801 141.21C70.207 143.748 65.008 142.11 65.008 142.11L64.376 139.449z"/>
 </g>
 <g style="fill: #000000">
  <path d="M26.834 155.997C26.834 155.997 32.062 155.77 30.91 157.32C29.757 158.869 27.308 157.996 27.308 157.996L26.834 155.997z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.1">
  <path d="M62.434 34.603C62.434 34.603 61.708 35.268 61.707 34.197C61.707 33.127 79.191 19.863 88.034 18.479C88.034 18.479 71.935 25.208 62.434 34.603z"/>
 </g>
 <g style="fill: #000000">
  <path d="M65.4 98.4C65.4 98.4 87.401 120.801 96.601 124.401C96.601 124.401 105.801 135.601 101.801 161.601C101.801 161.601 98.601 169.201 95.401 148.401C95.401 148.401 98.601 123.201 87.401 139.201C87.401 139.201 79 129.301 85.4 129.601C85.4 129.601 88.601 131.601 89.001 130.001C89.401 128.401 81.4 114.801 64.2 100.4C47 86 65.4 98.4 65.4 98.4z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.1">
  <path d="M7 137.201C7 137.201 6.8 135.401 8.6 136.201C10.4 137.001 104.601 143.201 136.201 167.201C136.201 167.201 91.001 144.001 7 137.201z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.1">
  <path d="M17.4 132.801C17.4 132.801 17.2 131.001 19 131.801C20.8 132.601 157.401 131.601 181.001 164.001C181.001 164.001 159.001 138.801 17.4 132.801z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.1">
  <path d="M29 128.801C29 128.801 28.8 127.001 30.6 127.801C32.4 128.601 205.801 115.601 229.401 148.001C229.401 148.001 219.801 122.401 29 128.801z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.1">
  <path d="M39 124.001C39 124.001 38.8 122.201 40.6 123.001C42.4 123.801 164.601 85.2 188.201 117.601C188.201 117.601 174.801 93 39 124.001z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.1">
  <path d="M-19 146.801C-19 146.801 -19.2 145.001 -17.4 145.801C-15.6 146.601 2.2 148.801 4.2 187.601C4.2 187.601 -3 145.601 -19 146.801z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.1">
  <path d="M-27.8 148.401C-27.8 148.401 -28 146.601 -26.2 147.401C-24.4 148.201 -10.2 143.601 -13 182.401C-13 182.401 -11.8 147.201 -27.8 148.401z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.1">
  <path d="M-35.8 148.801C-35.8 148.801 -36 147.001 -34.2 147.801C-32.4 148.601 -17 149.201 -29.4 171.601C-29.4 171.601 -19.8 147.601 -35.8 148.801z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.1">
  <path d="M11.526 104.465C11.526 104.465 11.082 106.464 12.631 105.247C28.699 92.622 61.141 33.72 116.826 28.086C116.826 28.086 78.518 15.976 11.526 104.465z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.1">
  <path d="M22.726 102.665C22.726 102.665 21.363 101.472 23.231 100.847C25.099 100.222 137.541 27.72 176.826 35.686C176.826 35.686 149.719 28.176 22.726 102.665z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.1">
  <path d="M1.885 108.767C1.885 108.767 1.376 110.366 3.087 109.39C12.062 104.27 15.677 47.059 59.254 45.804C59.254 45.804 26.843 31.09 1.885 108.767z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.1">
  <path d="M-18.038 119.793C-18.038 119.793 -19.115 121.079 -17.162 120.825C-6.916 119.493 14.489 78.222 58.928 83.301C58.928 83.301 26.962 68.955 -18.038 119.793z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.1">
  <path d="M-6.8 113.667C-6.8 113.667 -7.611 115.136 -5.742 114.511C4.057 111.237 17.141 66.625 61.729 63.078C61.729 63.078 27.603 55.135 -6.8 113.667z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.1">
  <path d="M-25.078 124.912C-25.078 124.912 -25.951 125.954 -24.369 125.748C-16.07 124.669 1.268 91.24 37.264 95.354C37.264 95.354 11.371 83.734 -25.078 124.912z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.1">
  <path d="M-32.677 130.821C-32.677 130.821 -33.682 131.866 -32.091 131.748C-27.923 131.439 2.715 98.36 21.183 113.862C21.183 113.862 9.168 95.139 -32.677 130.821z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.1">
  <path d="M36.855 98.898C36.855 98.898 35.654 97.543 37.586 97.158C39.518 96.774 160.221 39.061 198.184 51.927C198.184 51.927 172.243 41.053 36.855 98.898z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.1">
  <path d="M3.4 163.201C3.4 163.201 3.2 161.401 5 162.201C6.8 163.001 22.2 163.601 9.8 186.001C9.8 186.001 19.4 162.001 3.4 163.201z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.1">
  <path d="M13.8 161.601C13.8 161.601 13.6 159.801 15.4 160.601C17.2 161.401 35 163.601 37 202.401C37 202.401 29.8 160.401 13.8 161.601z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.1">
  <path d="M20.6 160.001C20.6 160.001 20.4 158.201 22.2 159.001C24 159.801 48.6 163.201 72.2 195.601C72.2 195.601 36.6 158.801 20.6 160.001z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.1">
  <path d="M28.225 157.972C28.225 157.972 27.788 156.214 29.678 156.768C31.568 157.322 52.002 155.423 90.099 189.599C90.099 189.599 43.924 154.656 28.225 157.972z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.1">
  <path d="M38.625 153.572C38.625 153.572 38.188 151.814 40.078 152.368C41.968 152.922 76.802 157.423 128.499 192.399C128.499 192.399 54.324 150.256 38.625 153.572z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.1">
  <path d="M-1.8 142.001C-1.8 142.001 -2 140.201 -0.2 141.001C1.6 141.801 55 144.401 85.4 171.201C85.4 171.201 50.499 146.426 -1.8 142.001z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.1">
  <path d="M-11.8 146.001C-11.8 146.001 -12 144.201 -10.2 145.001C-8.4 145.801 16.2 149.201 39.8 181.601C39.8 181.601 4.2 144.801 -11.8 146.001z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.1">
  <path d="M49.503 148.962C49.503 148.962 48.938 147.241 50.864 147.655C52.79 148.068 87.86 150.004 141.981 181.098C141.981 181.098 64.317 146.704 49.503 148.962z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.1">
  <path d="M57.903 146.562C57.903 146.562 57.338 144.841 59.264 145.255C61.19 145.668 96.26 147.604 150.381 178.698C150.381 178.698 73.317 143.904 57.903 146.562z"/>
 </g>
 <g style="fill: #ffffff; stroke:#000000; stroke-width:0.1">
  <path d="M67.503 141.562C67.503 141.562 66.938 139.841 68.864 140.255C70.79 140.668 113.86 145.004 203.582 179.298C203.582 179.298 82.917 138.904 67.503 141.562z"/>
 </g>
 <g style="fill: #000000">
  <path d="M-43.8 148.401C-43.8 148.401 -38.6 148.001 -39.8 149.601C-41 151.201 -43.4 150.401 -43.4 150.401L-43.8 148.401z"/>
 </g>
 <g style="fill: #000000">
  <path d="M-13 162.401C-13 162.401 -7.8 162.001 -9 163.601C-10.2 165.201 -12.6 164.401 -12.6 164.401L-13 162.401z"/>
 </g>
 <g style="fill: #000000">
  <path d="M-21.8 162.001C-21.8 162.001 -16.6 161.601 -17.8 163.201C-19 164.801 -21.4 164.001 -21.4 164.001L-21.8 162.001z"/>
 </g>
 <g style="fill: #000000">
  <path d="M-117.169 150.182C-117.169 150.182 -112.124 151.505 -113.782 152.624C-115.439 153.744 -117.446 152.202 -117.446 152.202L-117.169 150.182z"/>
 </g>
 <g style="fill: #000000">
  <path d="M-115.169 140.582C-115.169 140.582 -110.124 141.905 -111.782 143.024C-113.439 144.144 -115.446 142.602 -115.446 142.602L-115.169 140.582z"/>
 </g>
 <g style="fill: #000000">
  <path d="M-122.369 136.182C-122.369 136.182 -117.324 137.505 -118.982 138.624C-120.639 139.744 -122.646 138.202 -122.646 138.202L-122.369 136.182z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M-42.6 211.201C-42.6 211.201 -44.2 211.201 -48.2 213.201C-50.2 213.201 -61.4 216.801 -67 226.801C-67 226.801 -54.6 217.201 -42.6 211.201z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M45.116 303.847C45.257 304.105 45.312 304.525 45.604 304.542C46.262 304.582 47.495 304.883 47.37 304.247C46.522 299.941 45.648 295.004 41.515 293.197C40.876 292.918 39.434 293.331 39.36 294.215C39.233 295.739 39.116 297.088 39.425 298.554C39.725 299.975 41.883 299.985 42.8 298.601C43.736 300.273 44.168 302.116 45.116 303.847z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M34.038 308.581C34.786 309.994 34.659 311.853 36.074 312.416C36.814 312.71 38.664 311.735 38.246 310.661C37.444 308.6 37.056 306.361 35.667 304.55C35.467 304.288 35.707 303.755 35.547 303.427C34.953 302.207 33.808 301.472 32.4 301.801C31.285 304.004 32.433 306.133 33.955 307.842C34.091 307.994 33.925 308.37 34.038 308.581z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M-5.564 303.391C-5.672 303.014 -5.71 302.551 -5.545 302.23C-5.014 301.197 -4.221 300.075 -4.558 299.053C-4.906 297.997 -6.022 298.179 -6.672 298.748C-7.807 299.742 -7.856 301.568 -8.547 302.927C-8.743 303.313 -8.692 303.886 -9.133 304.277C-9.607 304.698 -10.047 306.222 -9.951 306.793C-9.898 307.106 -10.081 317.014 -9.859 316.751C-9.24 316.018 -6.19 306.284 -6.121 305.392C-6.064 304.661 -5.332 304.196 -5.564 303.391z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M-31.202 296.599C-28.568 294.1 -25.778 291.139 -26.22 287.427C-26.336 286.451 -28.111 286.978 -28.298 287.824C-29.1 291.449 -31.139 294.11 -33.707 296.502C-35.903 298.549 -37.765 304.893 -38 305.401C-34.303 300.145 -32.046 297.399 -31.202 296.599z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M-44.776 290.635C-44.253 290.265 -44.555 289.774 -44.338 289.442C-43.385 287.984 -42.084 286.738 -42.066 285C-42.063 284.723 -42.441 284.414 -42.776 284.638C-43.053 284.822 -43.395 284.952 -43.503 285.082C-45.533 287.531 -46.933 290.202 -48.376 293.014C-48.559 293.371 -49.703 297.862 -49.39 297.973C-49.151 298.058 -47.431 293.877 -47.221 293.763C-45.958 293.077 -45.946 291.462 -44.776 290.635z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M-28.043 310.179C-27.599 309.31 -26.023 308.108 -26.136 307.219C-26.254 306.291 -25.786 304.848 -26.698 305.536C-27.955 306.484 -31.404 307.833 -31.674 313.641C-31.7 314.212 -28.726 311.519 -28.043 310.179z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M-13.6 293.001C-13.2 292.333 -12.492 292.806 -12.033 292.543C-11.385 292.171 -10.774 291.613 -10.482 290.964C-9.512 288.815 -7.743 286.995 -7.6 284.601C-9.091 283.196 -9.77 285.236 -10.4 286.201C-11.723 284.554 -12.722 286.428 -14.022 286.947C-14.092 286.975 -14.305 286.628 -14.38 286.655C-15.557 287.095 -16.237 288.176 -17.235 288.957C-17.406 289.091 -17.811 288.911 -17.958 289.047C-18.61 289.65 -19.583 289.975 -19.863 290.657C-20.973 293.364 -24.113 295.459 -26 303.001C-25.619 303.91 -21.488 296.359 -21.001 295.661C-20.165 294.465 -20.047 297.322 -18.771 296.656C-18.72 296.629 -18.534 296.867 -18.4 297.001C-18.206 296.721 -17.988 296.492 -17.6 296.601C-17.6 296.201 -17.734 295.645 -17.533 295.486C-16.296 294.509 -16.38 293.441 -15.6 292.201C-15.142 292.99 -14.081 292.271 -13.6 293.001z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M46.2 347.401C46.2 347.401 53.6 327.001 49.2 315.801C49.2 315.801 60.6 337.401 56 348.601C56 348.601 55.6 338.201 51.6 333.201C51.6 333.201 47.6 346.001 46.2 347.401z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M31.4 344.801C31.4 344.801 36.8 336.001 28.8 317.601C28.8 317.601 28 338.001 21.2 349.001C21.2 349.001 35.4 328.801 31.4 344.801z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M21.4 342.801C21.4 342.801 21.2 322.801 21.6 319.801C21.6 319.801 17.8 336.401 7.6 346.001C7.6 346.001 22 334.001 21.4 342.801z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M11.8 310.801C11.8 310.801 17.8 324.401 7.8 342.801C7.8 342.801 14.2 330.601 9.4 323.601C9.4 323.601 12 320.201 11.8 310.801z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M-7.4 342.401C-7.4 342.401 -8.4 326.801 -6.6 324.601C-6.6 324.601 -6.4 318.201 -6.8 317.201C-6.8 317.201 -2.8 311.001 -2.6 318.401C-2.6 318.401 -1.2 326.201 1.6 330.801C1.6 330.801 5.2 336.201 5 342.601C5 342.601 -5 312.401 -7.4 342.401z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M-11 314.801C-11 314.801 -17.6 325.601 -19.4 344.601C-19.4 344.601 -20.8 338.401 -17 324.001C-17 324.001 -12.8 308.601 -11 314.801z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M-32.8 334.601C-32.8 334.601 -27.8 329.201 -26.4 324.201C-26.4 324.201 -22.8 308.401 -29.2 317.001C-29.2 317.001 -29 325.001 -37.2 332.401C-37.2 332.401 -32.4 330.001 -32.8 334.601z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M-38.6 329.601C-38.6 329.601 -35.2 312.201 -34.4 311.401C-34.4 311.401 -32.6 308.001 -35.4 311.201C-35.4 311.201 -44.2 330.401 -48.2 337.001C-48.2 337.001 -40.2 327.801 -38.6 329.601z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M-44.4 313.001C-44.4 313.001 -32.8 290.601 -54.6 316.401C-54.6 316.401 -43.6 306.601 -44.4 313.001z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M-59.8 298.401C-59.8 298.401 -55 279.601 -52.4 279.801C-52.4 279.801 -44.2 270.801 -50.8 281.401C-50.8 281.401 -56.8 291.001 -56.2 300.801C-56.2 300.801 -56.8 291.201 -59.8 298.401z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M270.5 287C270.5 287 258.5 277 256 273.5C256 273.5 269.5 292 269.5 299C269.5 299 272 291.5 270.5 287z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M276 265C276 265 255 250 251.5 242.5C251.5 242.5 278 272 278 276.5C278 276.5 278.5 267.5 276 265z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M293 111C293 111 281 103 279.5 105C279.5 105 290 111.5 292.5 120C292.5 120 291 111 293 111z"/>
 </g>
 <g style="fill: #cccccc">
  <path d="M301.5 191.5L284 179.5C284 179.5 303 196.5 303.5 200.5L301.5 191.5z"/>
 </g>
 <g style="stroke:#000000">
  <path d="M-89.25 169L-67.25 173.75"/>
 </g>
 <g style="stroke:#000000">
  <path d="M-39 331C-39 331 -39.5 327.5 -48.5 338"/>
 </g>
 <g style="stroke:#000000">
  <path d="M-33.5 336C-33.5 336 -31.5 329.5 -38 334"/>
 </g>
 <g style="stroke:#000000">
  <path d="M20.5 344.5C20.5 344.5 22 333.5 10.5 346.5"/>
 </g>
</g>
</svg>`

export const glyphsSVG = `
<svg xmlns="http://www.w3.org/2000/svg">
<defs>
<font id="DroidSans-Bold" horiz-adv-x="1261"><font-face font-family="Droid Sans" units-per-em="2048" panose-1="2 11 8 6 3 8 4 2 2 4" ascent="1901" descent="-483" alphabetic="0"/>
<missing-glyph horiz-adv-x="1229" d="M193 1462H1034V0H193V1462ZM297 104H930V1358H297V104Z"/>
<glyph unicode=" " glyph-name="space" horiz-adv-x="532"/>
<glyph unicode="!" glyph-name="exclam" horiz-adv-x="586" d="M416 485H172L121 1462H467L416 485ZM117 143Q117 190 130 222T168 275T224 304T293 313Q328 313 359 304T415 275T453 223T467 143Q467 98 453 66T415 13T360 -17T293 -27Q256 -27 224 -18T168 13T131 66T117 143Z"/>
<glyph unicode="&quot;" glyph-name="quotedbl" horiz-adv-x="967" d="M412 1462L371 934H174L133 1462H412ZM834 1462L793 934H596L555 1462H834Z"/>
<glyph unicode="#" glyph-name="numbersign" horiz-adv-x="1323" d="M999 844L952 612H1210V406H913L836 0H616L694 406H500L424 0H209L283 406H45V612H322L369 844H117V1053H406L483 1460H702L625 1053H823L901 1460H1116L1038 1053H1278V844H999ZM539 612H735L782 844H586L539 612Z"/>
<glyph unicode="$" glyph-name="dollar" horiz-adv-x="1128" d="M1061 457Q1061 382 1035 318T956 206T825 127T645 86V-119H508V82Q442 84 386 90T281 107T188 133T100 168V432Q142 411 191 392T294 358T401 331T508 317V635Q500 638 491 642Q483 645 475 648T461 653Q370 688 302 726T189 811T121 915T98 1044Q98 1119 126 1180T208 1287T337 1361T508 1399V1556H645V1405Q732 1400 823 1380T1014 1317L913 1083Q848 1109 778 1129T645 1155V862L684 848Q779 813 850 776T968 693T1038 590T1061 457ZM760 451Q760 475 754 493T733 526T698 553T645 580V328Q704 337 732 367T760 451ZM399 1051Q399 1004 425 973T508 920V1153Q454 1147 427 1123T399 1051Z"/>
<glyph unicode="%" glyph-name="percent" horiz-adv-x="1804" d="M315 1024Q315 897 337 835T410 772Q459 772 482 834T506 1024Q506 1274 410 1274Q360 1274 338 1213T315 1024ZM758 1026Q758 918 738 832T674 687T565 597T408 565Q323 565 259 596T151 687T85 832T63 1026Q63 1134 83 1219T145 1362T253 1452T408 1483Q494 1483 559 1452T669 1363T735 1219T758 1026ZM1425 1462L614 0H375L1186 1462H1425ZM1298 440Q1298 313 1320 251T1393 188Q1442 188 1465 250T1489 440Q1489 690 1393 690Q1343 690 1321 629T1298 440ZM1741 442Q1741 334 1721 249T1657 104T1548 14T1391 -18Q1306 -18 1242 13T1135 104T1069 248T1047 442Q1047 550 1067 635T1129 778T1236 868T1391 899Q1477 899 1542 868T1652 779T1718 635T1741 442Z"/>
<glyph unicode="&amp;" glyph-name="ampersand" horiz-adv-x="1479" d="M1475 0H1098L1001 100Q921 45 825 13T612 -20Q492 -20 395 10T228 94T120 225T82 395Q82 472 100 532T153 642T235 731T344 807Q306 853 280 895T237 979T214 1062T207 1149Q207 1227 237 1288T322 1393T452 1460T618 1483Q704 1483 776 1462T901 1401T984 1301T1014 1165Q1014 1096 992 1039T931 932T842 842T731 766L991 498Q1026 564 1052 637T1098 784H1415Q1400 727 1380 664T1332 538T1270 411T1192 291L1475 0ZM403 424Q403 380 419 345T463 286T530 249T614 236Q674 236 725 251T819 295L510 625Q459 583 431 535T403 424ZM731 1124Q731 1155 721 1176T695 1212T658 1232T616 1239Q594 1239 572 1233T531 1214T501 1178T489 1122Q489 1070 512 1024T575 932Q652 976 691 1020T731 1124Z"/>
<glyph unicode="'" glyph-name="quotesingle" horiz-adv-x="545" d="M412 1462L371 934H174L133 1462H412Z"/>
<glyph unicode="(" glyph-name="parenleft" horiz-adv-x="694" d="M82 561Q82 686 100 807T155 1043T248 1263T383 1462H633Q492 1269 420 1038T348 563Q348 444 366 326T420 95T509 -124T631 -324H383Q305 -234 249 -131T155 84T100 317T82 561Z"/>
<glyph unicode=")" glyph-name="parenright" horiz-adv-x="694" d="M612 561Q612 437 594 317T539 85T446 -131T311 -324H63Q132 -230 185 -124T274 95T328 326T346 563Q346 807 274 1038T61 1462H311Q389 1369 445 1264T539 1044T594 808T612 561Z"/>
<glyph unicode="*" glyph-name="asterisk" horiz-adv-x="1116" d="M688 1556L647 1188L1020 1292L1053 1040L713 1016L936 719L709 598L553 911L416 600L180 719L401 1016L63 1042L102 1292L467 1188L426 1556H688Z"/>
<glyph unicode="+" glyph-name="plus" horiz-adv-x="1128" d="M455 612H88V831H455V1200H674V831H1040V612H674V248H455V612Z"/>
<glyph unicode="," glyph-name="comma" horiz-adv-x="594" d="M459 215Q445 161 426 100T383 -23T334 -146T283 -264H63Q78 -203 92 -137T120 -6T145 122T164 238H444L459 215Z"/>
<glyph unicode="-" glyph-name="hyphen" horiz-adv-x="659" d="M61 424V674H598V424H61Z"/>
<glyph unicode="." glyph-name="period" horiz-adv-x="584" d="M117 143Q117 190 130 222T168 275T224 304T293 313Q328 313 359 304T415 275T453 223T467 143Q467 98 453 66T415 13T360 -17T293 -27Q256 -27 224 -18T168 13T131 66T117 143Z"/>
<glyph unicode="/" glyph-name="slash" horiz-adv-x="846" d="M836 1462L291 0H14L559 1462H836Z"/>
<glyph unicode="0" glyph-name="zero" horiz-adv-x="1128" d="M1065 731Q1065 554 1038 415T950 179T794 31T563 -20Q436 -20 342 31T186 179T94 415T63 731Q63 908 90 1048T178 1285T333 1433T563 1485Q689 1485 783 1434T940 1286T1034 1049T1065 731ZM371 731Q371 481 414 355T563 229Q667 229 712 354T758 731Q758 982 713 1108T563 1235Q510 1235 474 1203T414 1108T381 951T371 731Z"/>
<glyph unicode="1" glyph-name="one" horiz-adv-x="1128" d="M817 0H508V846Q508 872 508 908T510 984T513 1064T516 1137Q511 1131 499 1119T472 1093T441 1063T410 1036L242 901L92 1087L563 1462H817V0Z"/>
<glyph unicode="2" glyph-name="two" horiz-adv-x="1128" d="M1063 0H82V215L426 586Q491 656 544 715T635 830T694 944T715 1069Q715 1143 671 1184T551 1225Q472 1225 399 1186T246 1075L78 1274Q123 1315 172 1352T280 1419T410 1465T569 1483Q674 1483 757 1454T900 1372T990 1242T1022 1071Q1022 985 992 907T910 753T790 603T643 451L467 274V260H1063V0Z"/>
<glyph unicode="3" glyph-name="three" horiz-adv-x="1128" d="M1006 1135Q1006 1059 982 999T915 893T815 817T690 770V764Q867 742 958 657T1049 426Q1049 330 1015 249T909 107T729 14T473 -20Q355 -20 251 -1T57 59V322Q102 298 152 280T252 250T350 231T442 225Q528 225 585 241T676 286T724 355T739 444Q739 489 721 525T661 587T552 627T387 641H283V858H385Q477 858 538 874T635 919T687 986T702 1067Q702 1145 654 1189T500 1233Q452 1233 411 1224T334 1200T269 1168T215 1133L59 1339Q101 1370 150 1396T258 1441T383 1472T526 1483Q634 1483 722 1460T874 1392T971 1283T1006 1135Z"/>
<glyph unicode="4" glyph-name="four" horiz-adv-x="1128" d="M1085 303H909V0H608V303H4V518L625 1462H909V543H1085V303ZM608 543V791Q608 804 608 828T610 884T612 948T615 1011T618 1063T621 1096H612Q594 1054 572 1007T520 913L276 543H608Z"/>
<glyph unicode="5" glyph-name="five" horiz-adv-x="1128" d="M598 934Q692 934 773 905T914 820T1008 681T1042 489Q1042 370 1005 276T896 116T718 15T473 -20Q418 -20 364 -15T261 -1T167 24T86 59V326Q121 306 167 289T262 259T362 239T457 231Q591 231 661 286T731 463Q731 571 663 627T451 684Q425 684 396 681T338 673T283 663T238 651L115 717L170 1462H942V1200H438L414 913Q446 920 488 927T598 934Z"/>
<glyph unicode="6" glyph-name="six" horiz-adv-x="1128" d="M76 621Q76 726 87 830T128 1029T208 1207T336 1349T522 1444T776 1479Q797 1479 822 1478T872 1476T922 1471T965 1464V1217Q927 1226 885 1231T799 1237Q664 1237 577 1204T439 1110T367 966T340 780H352Q372 816 400 847T467 901T552 937T659 950Q754 950 830 919T958 829T1039 684T1067 487Q1067 368 1034 274T938 115T788 15T590 -20Q482 -20 388 18T225 136T116 335T76 621ZM584 227Q625 227 658 242T716 289T754 369T768 483Q768 590 724 651T588 713Q542 713 504 695T439 648T398 583T383 510Q383 459 395 409T433 318T496 252T584 227Z"/>
<glyph unicode="7" glyph-name="seven" horiz-adv-x="1128" d="M207 0L727 1200H55V1460H1063V1266L530 0H207Z"/>
<glyph unicode="8" glyph-name="eight" horiz-adv-x="1128" d="M565 1481Q656 1481 737 1459T879 1393T976 1283T1012 1128Q1012 1062 992 1009T937 912T854 834T750 772Q808 741 863 703T962 618T1031 511T1057 379Q1057 288 1021 214T920 88T765 8T565 -20Q447 -20 355 7T200 84T105 207T72 371Q72 446 94 506T154 614T243 699T352 764Q303 795 260 831T186 912T136 1011T117 1130Q117 1217 153 1282T252 1392T395 1459T565 1481ZM358 389Q358 349 371 316T409 258T473 221T561 207Q666 207 718 256T770 387Q770 429 753 462T708 524T645 577T575 623L553 637Q509 615 473 590T412 534T372 467T358 389ZM563 1255Q530 1255 502 1245T453 1216T420 1169T408 1106Q408 1064 420 1034T454 980T504 938T565 901Q596 917 624 936T673 979T708 1035T721 1106Q721 1141 709 1169T676 1216T626 1245T563 1255Z"/>
<glyph unicode="9" glyph-name="nine" horiz-adv-x="1128" d="M1055 838Q1055 733 1044 629T1003 429T923 252T795 109T609 15T354 -20Q333 -20 308 -19T258 -17T208 -13T166 -6V242Q203 232 245 227T332 221Q467 221 554 254T692 348T764 493T791 678H778Q758 642 730 611T664 557T578 521T471 508Q376 508 300 539T172 629T91 774T63 971Q63 1090 96 1184T192 1343T342 1444T541 1479Q649 1479 743 1441T906 1323T1015 1123T1055 838ZM547 1231Q506 1231 472 1216T414 1170T376 1090T362 975Q362 869 407 807T543 745Q589 745 627 763T692 810T733 875T748 948Q748 999 736 1049T698 1140T635 1206T547 1231Z"/>
<glyph unicode=":" glyph-name="colon" horiz-adv-x="584" d="M117 143Q117 190 130 222T168 275T224 304T293 313Q328 313 359 304T415 275T453 223T467 143Q467 98 453 66T415 13T360 -17T293 -27Q256 -27 224 -18T168 13T131 66T117 143ZM117 969Q117 1016 130 1048T168 1101T224 1130T293 1139Q328 1139 359 1130T415 1101T453 1049T467 969Q467 924 453 892T415 839T360 809T293 799Q256 799 224 808T168 838T131 891T117 969Z"/>
<glyph unicode=";" glyph-name="semicolon" horiz-adv-x="594" d="M444 238L459 215Q445 161 426 100T383 -23T334 -146T283 -264H63Q78 -203 92 -137T120 -6T145 122T164 238H444ZM117 969Q117 1016 130 1048T168 1101T224 1130T293 1139Q328 1139 359 1130T415 1101T453 1049T467 969Q467 924 453 892T415 839T360 809T293 799Q256 799 224 808T168 838T131 891T117 969Z"/>
<glyph unicode="&lt;" glyph-name="less" horiz-adv-x="1128" d="M1040 203L88 641V784L1040 1280V1040L397 723L1040 442V203Z"/>
<glyph unicode="=" glyph-name="equal" horiz-adv-x="1128" d="M88 807V1024H1040V807H88ZM88 418V637H1040V418H88Z"/>
<glyph unicode="&gt;" glyph-name="greater" horiz-adv-x="1128" d="M88 442L731 723L88 1040V1280L1040 784V641L88 203V442Z"/>
<glyph unicode="?" glyph-name="question" horiz-adv-x="940" d="M264 485V559Q264 610 274 651T306 730T362 803T444 877Q486 910 515 936T562 987T588 1041T596 1106Q596 1163 558 1200T440 1237Q371 1237 292 1208T127 1137L25 1358Q68 1383 118 1405T223 1445T334 1473T444 1483Q546 1483 628 1459T767 1387T854 1273T885 1120Q885 1057 871 1008T830 916T761 834T664 750Q622 717 596 693T554 646T534 601T528 545V485H264ZM231 143Q231 190 244 222T282 275T338 304T408 313Q443 313 474 304T530 275T568 223T582 143Q582 98 568 66T530 13T475 -17T408 -27Q371 -27 339 -18T282 13T245 66T231 143Z"/>
<glyph unicode="@" glyph-name="at" horiz-adv-x="1774" d="M1673 752Q1673 657 1651 564T1582 398T1467 279T1303 233Q1265 233 1232 242T1170 269T1122 310T1090 362H1075Q1056 337 1031 314T975 272T907 244T825 233Q742 233 678 261T569 342T502 468T479 631Q479 734 510 820T599 968T740 1065T926 1100Q971 1100 1019 1095T1111 1082T1195 1064T1262 1044L1241 625Q1239 603 1239 582T1239 555Q1239 513 1245 486T1262 444T1286 422T1315 416Q1350 416 1376 443T1419 516T1445 623T1454 754Q1454 882 1416 982T1311 1151T1150 1256T948 1292Q795 1292 679 1241T484 1099T365 882T324 608Q324 470 359 364T463 185T633 75T866 37Q922 37 981 44T1098 63T1213 92T1321 129V-63Q1227 -105 1113 -129T868 -154Q687 -154 545 -103T304 46T154 283T102 602Q102 726 129 839T207 1050T331 1227T499 1363T706 1450T948 1481Q1106 1481 1239 1431T1468 1286T1619 1056T1673 752ZM711 627Q711 515 749 466T850 416Q892 416 922 435T972 490T1002 575T1016 686L1028 907Q1008 912 981 915T926 918Q867 918 826 893T760 827T723 734T711 627Z"/>
<glyph unicode="A" glyph-name="A" horiz-adv-x="1331" d="M1018 0L918 348H414L313 0H0L475 1468H854L1331 0H1018ZM846 608L752 928Q746 946 734 987T709 1077T683 1177T666 1262Q662 1240 656 1210T641 1147T623 1079T606 1015T592 962T582 928L489 608H846Z"/>
<glyph unicode="B" glyph-name="B" horiz-adv-x="1315" d="M184 1462H612Q750 1462 854 1443T1028 1380T1133 1266T1169 1092Q1169 1030 1154 976T1110 881T1040 813T944 776V766Q999 754 1046 732T1129 670T1185 570T1206 424Q1206 324 1171 246T1071 113T912 29T700 0H184V1462ZM494 883H655Q713 883 752 893T815 925T849 977T860 1051Q860 1135 808 1171T641 1208H494V883ZM494 637V256H676Q737 256 778 270T845 310T882 373T893 455Q893 496 882 529T845 587T775 624T668 637H494Z"/>
<glyph unicode="C" glyph-name="C" horiz-adv-x="1305" d="M805 1225Q716 1225 648 1191T533 1092T462 935T438 727Q438 610 459 519T525 366T639 271T805 238Q894 238 983 258T1178 315V55Q1130 35 1083 21T987 -2T887 -15T776 -20Q607 -20 483 34T278 186T158 422T119 729Q119 895 164 1033T296 1272T511 1427T805 1483Q914 1483 1023 1456T1233 1380L1133 1128Q1051 1167 968 1196T805 1225Z"/>
<glyph unicode="D" glyph-name="D" horiz-adv-x="1434" d="M1315 745Q1315 560 1265 421T1119 188T885 47T569 0H184V1462H612Q773 1462 902 1416T1124 1280T1265 1055T1315 745ZM1001 737Q1001 859 977 947T906 1094T792 1180T637 1208H494V256H608Q804 256 902 376T1001 737Z"/>
<glyph unicode="E" glyph-name="E" horiz-adv-x="1147" d="M1026 0H184V1462H1026V1208H494V887H989V633H494V256H1026V0Z"/>
<glyph unicode="F" glyph-name="F" horiz-adv-x="1124" d="M489 0H184V1462H1022V1208H489V831H985V578H489V0Z"/>
<glyph unicode="G" glyph-name="G" horiz-adv-x="1483" d="M739 821H1319V63Q1261 44 1202 29T1080 3T947 -14T799 -20Q635 -20 509 28T296 172T164 408T119 733Q119 905 169 1044T316 1280T556 1430T883 1483Q1000 1483 1112 1458T1317 1393L1214 1145Q1146 1179 1061 1202T881 1225Q779 1225 698 1190T558 1089T469 932T438 727Q438 619 459 530T527 375T645 274T819 238Q885 238 930 244T1016 258V563H739V821Z"/>
<glyph unicode="H" glyph-name="H" horiz-adv-x="1485" d="M1300 0H991V631H494V0H184V1462H494V889H991V1462H1300V0Z"/>
<glyph unicode="I" glyph-name="I" horiz-adv-x="797" d="M731 0H66V176L244 258V1204L66 1286V1462H731V1286L553 1204V258L731 176V0Z"/>
<glyph unicode="J" glyph-name="J" horiz-adv-x="678" d="M-2 -430Q-67 -430 -116 -424T-199 -408V-150Q-162 -158 -122 -164T-33 -170Q13 -170 52 -160T121 -126T167 -60T184 43V1462H494V53Q494 -73 458 -164T356 -314T199 -402T-2 -430Z"/>
<glyph unicode="K" glyph-name="K" horiz-adv-x="1298" d="M1298 0H946L610 608L494 522V0H184V1462H494V758L616 965L950 1462H1294L827 803L1298 0Z"/>
<glyph unicode="L" glyph-name="L" horiz-adv-x="1096" d="M184 0V1462H494V256H1026V0H184Z"/>
<glyph unicode="M" glyph-name="M" horiz-adv-x="1870" d="M772 0L451 1147H442Q448 1055 452 969Q454 932 455 893T458 816T460 743T461 680V0H184V1462H606L922 344H928L1264 1462H1686V0H1397V692Q1397 718 1397 751T1399 821T1401 896T1404 970Q1408 1054 1411 1145H1403L1057 0H772Z"/>
<glyph unicode="N" glyph-name="N" horiz-adv-x="1604" d="M1419 0H1026L451 1106H442Q448 1029 452 953Q456 888 458 817T461 688V0H184V1462H575L1149 367H1155Q1152 443 1148 517Q1147 549 1146 582T1143 649T1142 714T1141 770V1462H1419V0Z"/>
<glyph unicode="O" glyph-name="O" horiz-adv-x="1548" d="M1430 733Q1430 564 1391 425T1270 187T1066 34T774 -20Q606 -20 483 34T279 187T159 425T119 735Q119 905 158 1043T279 1280T483 1431T776 1485Q944 1485 1067 1432T1270 1280T1390 1043T1430 733ZM438 733Q438 618 458 527T519 372T624 274T774 240Q863 240 926 274T1030 371T1090 526T1110 733Q1110 848 1091 939T1031 1095T927 1193T776 1227Q689 1227 625 1193T520 1095T458 940T438 733Z"/>
<glyph unicode="P" glyph-name="P" horiz-adv-x="1225" d="M494 774H555Q686 774 752 826T819 995Q819 1104 760 1156T573 1208H494V774ZM1133 1006Q1133 910 1104 822T1009 667T834 560T565 520H494V0H184V1462H590Q731 1462 833 1431T1002 1341T1101 1198T1133 1006Z"/>
<glyph unicode="Q" glyph-name="Q" horiz-adv-x="1548" d="M1430 733Q1430 614 1411 510T1352 319T1253 166T1112 55L1473 -348H1075L807 -18Q800 -18 794 -19Q789 -20 784 -20T774 -20Q606 -20 483 34T279 187T159 425T119 735Q119 905 158 1043T279 1280T483 1431T776 1485Q944 1485 1067 1432T1270 1280T1390 1043T1430 733ZM438 733Q438 618 458 527T519 372T624 274T774 240Q863 240 926 274T1030 371T1090 526T1110 733Q1110 848 1091 939T1031 1095T927 1193T776 1227Q689 1227 625 1193T520 1095T458 940T438 733Z"/>
<glyph unicode="R" glyph-name="R" horiz-adv-x="1290" d="M494 813H578Q707 813 763 864T819 1016Q819 1120 759 1164T573 1208H494V813ZM494 561V0H184V1462H584Q865 1462 999 1354T1133 1024Q1133 949 1113 888T1060 780T983 697T891 637Q1002 459 1090 319Q1128 259 1163 202T1227 100T1273 28L1290 0H946L629 561H494Z"/>
<glyph unicode="S" glyph-name="S" horiz-adv-x="1073" d="M985 406Q985 308 952 230T854 96T696 10T481 -20Q375 -20 277 2T94 68V356Q142 333 191 312T290 273T391 246T492 236Q543 236 579 247T638 279T671 328T682 391Q682 432 665 463T616 522T540 576T440 631Q394 655 337 689T230 773T145 895T111 1067Q111 1165 143 1242T236 1373T381 1455T573 1483Q626 1483 676 1476T776 1456T876 1424T979 1380L879 1139Q834 1160 795 1176T719 1203T647 1219T575 1225Q497 1225 456 1184T414 1073Q414 1036 426 1008T466 954T537 903T643 844Q718 804 781 763T889 671T960 556T985 406Z"/>
<glyph unicode="T" glyph-name="T" horiz-adv-x="1124" d="M717 0H408V1204H41V1462H1083V1204H717V0Z"/>
<glyph unicode="U" glyph-name="U" horiz-adv-x="1466" d="M1292 1462V516Q1292 402 1258 304T1153 134T976 21T727 -20Q592 -20 489 18T316 128T210 298T174 520V1462H483V543Q483 462 499 405T546 311T625 257T735 240Q866 240 924 316T983 545V1462H1292Z"/>
<glyph unicode="V" glyph-name="V" horiz-adv-x="1249" d="M936 1462H1249L793 0H455L0 1462H313L561 582Q566 565 574 525T592 437T611 341T625 260Q630 293 639 341T658 436T677 524T692 582L936 1462Z"/>
<glyph unicode="W" glyph-name="W" horiz-adv-x="1898" d="M1546 0H1194L1014 721Q1010 736 1005 763T992 824T978 895T965 967T955 1031T948 1079Q946 1061 942 1032T931 968T919 896T906 825T893 763T883 719L705 0H352L0 1462H305L471 664Q474 648 479 618T492 549T506 469T521 387T534 313T543 256Q546 278 551 312T563 384T576 464T590 540T601 603T610 643L813 1462H1085L1288 643Q1291 631 1296 604T1308 541T1322 464T1335 385T1347 312T1356 256Q1359 278 1364 312T1377 387T1391 469T1406 549T1418 617T1427 664L1593 1462H1898L1546 0Z"/>
<glyph unicode="X" glyph-name="X" horiz-adv-x="1284" d="M1284 0H930L631 553L332 0H0L444 754L31 1462H373L647 936L915 1462H1249L831 737L1284 0Z"/>
<glyph unicode="Y" glyph-name="Y" horiz-adv-x="1196" d="M598 860L862 1462H1196L752 569V0H444V559L0 1462H336L598 860Z"/>
<glyph unicode="Z" glyph-name="Z" horiz-adv-x="1104" d="M1055 0H49V201L668 1206H68V1462H1036V1262L418 256H1055V0Z"/>
<glyph unicode="[" glyph-name="bracketleft" horiz-adv-x="678" d="M627 -324H143V1462H627V1251H403V-113H627V-324Z"/>
<glyph unicode="\" glyph-name="backslash" horiz-adv-x="846" d="M289 1462L834 0H557L12 1462H289Z"/>
<glyph unicode="]" glyph-name="bracketright" horiz-adv-x="678" d="M51 -113H274V1251H51V1462H535V-324H51V-113Z"/>
<glyph unicode="^" glyph-name="asciicircum" horiz-adv-x="1090" d="M8 520L446 1470H590L1085 520H846L524 1163Q455 1002 384 839T244 520H8Z"/>
<glyph unicode="_" glyph-name="underscore" horiz-adv-x="842" d="M846 -324H-4V-184H846V-324Z"/>

<glyph unicode="a" glyph-name="a" horiz-adv-x="1176" d="M809 0L750 152H741Q708 107 675 75T603 21T516 -10T403 -20Q335 -20 277 1T177 66T110 176T86 334Q86 512 200 596T541 690L719 696V780Q719 849 679 882T567 915Q495 915 427 894T289 838L190 1040Q274 1087 376 1114T590 1141Q799 1141 910 1043T1022 745V0H809ZM719 518L618 514Q557 512 515 498T448 461T411 405T399 332Q399 262 433 233T522 203Q564 203 600 217T662 260T704 330T719 426V518Z"/>
<glyph unicode="b" glyph-name="b" horiz-adv-x="1245" d="M756 1139Q842 1139 913 1102T1035 992T1114 811T1143 561Q1143 417 1115 309T1034 127T909 17T748 -20Q692 -20 649 -8T571 24T512 69T465 123H444L393 0H160V1556H465V1194Q465 1161 463 1123T459 1051Q456 1012 453 973H465Q486 1008 513 1038T575 1090T656 1126T756 1139ZM653 895Q602 895 567 877T509 821T477 728T465 596V563Q465 482 474 419T506 314T564 249T655 227Q746 227 788 313T831 565Q831 730 789 812T653 895Z"/>
<glyph unicode="c" glyph-name="c" horiz-adv-x="1022" d="M625 -20Q505 -20 409 13T244 115T139 293T102 553Q102 720 139 832T245 1013T410 1110T625 1139Q711 1139 796 1118T956 1059L868 827Q802 856 741 874T625 893Q514 893 464 809T414 555Q414 387 464 307T621 227Q708 227 779 249T924 307V53Q887 35 852 21T782 -2T708 -15T625 -20Z"/>
<glyph unicode="d" glyph-name="d" horiz-adv-x="1245" d="M489 -20Q403 -20 332 17T210 126T131 307T102 557Q102 701 130 809T211 991T337 1102T498 1139Q552 1139 597 1127T678 1092T742 1040T793 975H803Q797 1014 792 1054Q787 1088 784 1126T780 1198V1556H1085V0H852L793 145H780Q759 111 732 81T670 28T590 -7T489 -20ZM600 223Q654 223 692 241T753 297T788 391T801 522V555Q801 636 791 699T758 804T696 869T598 891Q502 891 457 805T412 553Q412 388 457 306T600 223Z"/>
<glyph unicode="e" glyph-name="e" horiz-adv-x="1190" d="M612 922Q531 922 478 865T416 686H805Q804 737 792 780T756 854T696 904T612 922ZM651 -20Q531 -20 430 15T256 120T143 298T102 551Q102 698 139 808T242 991T402 1102T610 1139Q721 1139 810 1106T962 1007T1058 848T1092 631V483H410Q412 419 430 368T482 281T563 226T672 207Q723 207 768 212T857 229T942 256T1028 295V59Q988 38 948 24T862 -1T765 -15T651 -20Z"/>
<glyph unicode="f" glyph-name="f" horiz-adv-x="793" d="M741 889H514V0H209V889H41V1036L209 1118V1200Q209 1307 235 1377T309 1490T425 1549T578 1567Q670 1567 733 1553T840 1520L768 1296Q737 1307 703 1316T623 1325Q563 1325 539 1287T514 1188V1118H741V889Z"/>
<glyph unicode="g" glyph-name="g" horiz-adv-x="1130" d="M1085 1116V950L922 899Q942 865 950 829T958 750Q958 665 931 595T851 474T718 397T532 369Q509 369 482 371T442 377Q422 360 411 342T399 297Q399 276 412 264T446 244T495 234T553 231H727Q808 231 872 213T980 156T1049 60T1073 -80Q1073 -175 1035 -251T922 -381T734 -463T475 -492Q361 -492 276 -471T134 -409T49 -311T20 -182Q20 -121 41 -76T97 1T176 53T268 84Q247 93 227 109T190 146T163 192T152 246Q152 278 161 304T189 352T234 395T295 436Q207 474 156 558T104 756Q104 846 132 917T214 1037T348 1113T532 1139Q552 1139 577 1137T626 1131T672 1123T705 1116H1085ZM285 -158Q285 -183 295 -206T330 -248T393 -276T489 -287Q645 -287 724 -243T803 -125Q803 -62 754 -41T602 -20H461Q434 -20 403 -26T346 -49T303 -91T285 -158ZM395 752Q395 661 429 611T532 561Q604 561 636 611T668 752Q668 842 637 895T532 948Q395 948 395 752Z"/>
<glyph unicode="h" glyph-name="h" horiz-adv-x="1284" d="M1130 0H825V653Q825 774 788 834T672 895Q613 895 573 871T509 800T475 684T465 526V0H160V1556H465V1239Q465 1197 463 1151T458 1065Q454 1019 451 975H467Q516 1062 592 1100T764 1139Q847 1139 914 1116T1030 1042T1104 915T1130 729V0Z"/>
<glyph unicode="i" glyph-name="i" horiz-adv-x="625" d="M147 1407Q147 1450 160 1478T195 1524T248 1549T313 1556Q347 1556 377 1549T429 1525T465 1479T479 1407Q479 1365 466 1336T430 1290T377 1265T313 1257Q279 1257 249 1264T196 1289T160 1336T147 1407ZM465 0H160V1118H465V0Z"/>
<glyph unicode="j" glyph-name="j" horiz-adv-x="625" d="M102 -492Q54 -492 3 -485T-82 -467V-227Q-51 -237 -24 -241T37 -246Q62 -246 84 -239T123 -212T150 -160T160 -76V1118H465V-121Q465 -198 446 -265T383 -383T270 -463T102 -492ZM147 1407Q147 1450 160 1478T195 1524T248 1549T313 1556Q347 1556 377 1549T429 1525T465 1479T479 1407Q479 1365 466 1336T430 1290T377 1265T313 1257Q279 1257 249 1264T196 1289T160 1336T147 1407Z"/>
<glyph unicode="k" glyph-name="k" horiz-adv-x="1208" d="M453 608L565 778L838 1118H1182L778 633L1208 0H856L584 430L465 348V0H160V1556H465V862L449 608H453Z"/>
<glyph unicode="l" glyph-name="l" horiz-adv-x="625" d="M465 0H160V1556H465V0Z"/>
<glyph unicode="m" glyph-name="m" horiz-adv-x="1929" d="M1120 0H815V653Q815 774 779 834T666 895Q608 895 570 871T508 800T475 684T465 526V0H160V1118H393L434 975H451Q475 1018 508 1049T582 1100T667 1129T758 1139Q873 1139 953 1100T1077 975H1102Q1126 1018 1160 1049T1235 1100T1321 1129T1413 1139Q1593 1139 1684 1042T1776 729V0H1470V653Q1470 774 1434 834T1321 895Q1212 895 1166 809T1120 561V0Z"/>
<glyph unicode="n" glyph-name="n" horiz-adv-x="1284" d="M1130 0H825V653Q825 774 789 834T672 895Q612 895 572 871T509 800T475 684T465 526V0H160V1118H393L434 975H451Q475 1018 509 1049T585 1100T672 1129T766 1139Q848 1139 915 1116T1030 1042T1104 915T1130 729V0Z"/>
<glyph unicode="o" glyph-name="o" horiz-adv-x="1227" d="M414 561Q414 394 461 310T614 225Q719 225 766 310T813 561Q813 728 766 810T612 893Q507 893 461 811T414 561ZM1124 561Q1124 421 1089 313T987 131T825 19T610 -20Q499 -20 406 18T246 131T140 313T102 561Q102 700 137 808T239 989T401 1101T616 1139Q727 1139 820 1101T980 990T1086 808T1124 561Z"/>
<glyph unicode="p" glyph-name="p" horiz-adv-x="1245" d="M748 -20Q693 -20 650 -8T572 24T512 69T465 123H449Q453 88 457 57Q460 31 462 4T465 -39V-492H160V1118H408L451 973H465Q486 1007 513 1037T575 1089T656 1125T756 1139Q843 1139 914 1102T1036 992T1115 811T1143 561Q1143 418 1114 310T1033 128T908 17T748 -20ZM653 895Q602 895 567 877T509 821T477 728T465 596V563Q465 482 474 419T506 314T564 249T655 227Q746 227 788 313T831 565Q831 730 789 812T653 895Z"/>
<glyph unicode="q" glyph-name="q" horiz-adv-x="1245" d="M602 219Q657 219 694 237T755 293T789 386T801 518V555Q801 636 792 699T759 804T697 869T600 891Q504 891 459 805T414 553Q414 385 459 302T602 219ZM489 -20Q402 -20 331 17T209 126T130 307T102 557Q102 700 130 808T211 990T337 1101T498 1139Q554 1139 599 1127T680 1092T745 1040T795 975H803L827 1118H1085V-492H780V-23Q780 -4 782 24T787 80Q790 112 793 145H780Q760 111 733 81T671 28T590 -7T489 -20Z"/>
<glyph unicode="r" glyph-name="r" horiz-adv-x="889" d="M743 1139Q755 1139 769 1139T797 1137T822 1134T840 1130V844Q832 846 818 848T789 851T758 853T733 854Q674 854 625 839T540 791T485 703T465 569V0H160V1118H391L436 950H451Q475 993 503 1028T565 1087T643 1125T743 1139Z"/>
<glyph unicode="s" glyph-name="s" horiz-adv-x="985" d="M905 332Q905 244 873 178T782 68T639 2T451 -20Q396 -20 349 -17T260 -5T179 15T100 45V297Q142 276 188 259T281 230T370 210T451 203Q492 203 521 210T568 231T595 263T604 303Q604 324 598 340T568 375T501 417T381 475Q308 508 255 540T167 613T115 704T98 827Q98 905 128 963T213 1061T345 1119T518 1139Q618 1139 708 1116T893 1047L801 831Q725 867 656 890T518 913Q456 913 429 891T401 831Q401 811 408 796T436 764T495 728T594 680Q665 649 722 619T820 549T883 458T905 332Z"/>
<glyph unicode="t" glyph-name="t" horiz-adv-x="848" d="M614 223Q659 223 699 233T782 258V31Q739 9 676 -5T537 -20Q464 -20 401 -3T292 56T220 170T193 350V889H47V1018L215 1120L303 1356H498V1118H770V889H498V350Q498 285 530 254T614 223Z"/>
<glyph unicode="u" glyph-name="u" horiz-adv-x="1284" d="M891 0L850 143H834Q809 100 775 70T699 19T612 -10T518 -20Q436 -20 369 3T254 77T180 204T154 389V1118H459V465Q459 344 495 284T612 223Q672 223 712 247T775 318T809 434T819 592V1118H1124V0H891Z"/>
<glyph unicode="v" glyph-name="v" horiz-adv-x="1104" d="M395 0L0 1118H319L504 481Q521 424 533 363T549 252H555Q558 305 570 364T600 481L784 1118H1104L709 0H395Z"/>
<glyph unicode="w" glyph-name="w" horiz-adv-x="1651" d="M1014 0L928 391Q924 408 918 439T903 510T887 594T869 683Q849 786 825 905H819Q796 786 777 682Q769 638 761 593T744 509T730 437T719 387L629 0H301L0 1118H303L416 623Q425 584 434 530T452 420T468 315T479 236H485Q486 255 489 285T498 351T508 422T519 491T529 547T537 582L659 1118H995L1112 582Q1117 560 1125 514T1141 416T1156 314T1163 236H1169Q1172 261 1179 310T1196 415T1215 528T1235 623L1352 1118H1651L1346 0H1014Z"/>
<glyph unicode="x" glyph-name="x" horiz-adv-x="1122" d="M389 571L29 1118H375L561 782L750 1118H1096L731 571L1112 0H766L561 362L356 0H10L389 571Z"/>
<glyph unicode="y" glyph-name="y" horiz-adv-x="1104" d="M0 1118H334L514 489Q530 437 537 378T547 272H553Q555 295 558 323T567 380T578 437T592 489L768 1118H1104L662 -143Q600 -320 493 -406T225 -492Q173 -492 135 -487T70 -475V-233Q91 -238 123 -242T190 -246Q238 -246 272 -233T330 -197T372 -140T403 -66L422 -10L0 1118Z"/>
<glyph unicode="z" glyph-name="z" horiz-adv-x="936" d="M877 0H55V180L512 885H86V1118H858V920L416 233H877V0Z"/>
<glyph unicode="{" glyph-name="braceleft" horiz-adv-x="745" d="M287 367T222 408T31 449V688Q93 688 141 697T223 728T272 784T287 866V1184Q287 1258 306 1310T374 1396T509 1446T725 1462V1237Q685 1236 653 1230T598 1209T563 1166T551 1096V797Q545 610 317 575V563Q432 546 493 491T551 342V43Q551 0 563 -27T597 -69T652 -91T725 -98V-324Q594 -324 509 -308T375 -259T306 -172T287 -45V270Q287 367 222 408Z"/>
<glyph unicode="|" glyph-name="bar" horiz-adv-x="1128" d="M455 1550H674V-465H455V1550Z"/>
<glyph unicode="}" glyph-name="braceright" horiz-adv-x="745" d="M469 -45Q469 -119 450 -172T382 -258T247 -308T31 -324V-98Q71 -97 103 -91T157 -70T192 -27T205 43V342Q202 436 263 491T438 563V575Q211 610 205 797V1096Q205 1139 193 1166T158 1208T103 1230T31 1237V1462Q162 1462 247 1446T381 1397T450 1311T469 1184V866Q468 818 484 784T533 729T614 698T725 688V449Q600 449 535 408T469 270V-45Z"/>
<glyph unicode="~" glyph-name="asciitilde" horiz-adv-x="1128" d="M528 616Q491 632 463 643T411 660T366 669T322 672Q293 672 262 663T201 637T143 598T88 551V782Q139 836 202 863T344 891Q374 891 399 889T453 879T517 860T600 827Q638 811 666 801T719 784T764 775T807 772Q836 772 867 781T928 807T986 845T1040 893V662Q939 553 784 553Q754 553 729 555T675 564T611 583T528 616Z"/>
</font>
</defs>
<g style="font-family:  Droid Sans ; font-size:18;fill:black"> 
<text x="20" y="60"> !"#$%&amp;'()*+,-./0123456789:;&lt;&gt;?</text> 
<text x="20" y="120">@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_</text> 
<text x="20" y="180">abcdefghijklmnopqrstuvwxyz|{}~</text> 
</g>
</svg>`

export const phpSVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 136 72">
 <defs>
   <radialGradient id="phpg" gradientUnits="userSpaceOnUse" cx="250" cy="0" r="300" fx="16" fy="0">
     <stop offset="0.3" stop-color="#CCF"/>
     <stop offset="0.6" stop-color="#334"/>
   </radialGradient>
 </defs>
 <g fill="#000" fill-rule="evenodd" stroke="#FFF" stroke-width="2" transform="scale(0.45)">
   <ellipse stroke="url(#phpg)" stroke-width="8" fill="#6C7EB7" cx="150" cy="80" rx="143" ry="73"/>
   <path d="M116 104l16-81 19 0-4 21 18 0c16,1 22,9 20,19l-7 41-20 0 7-37c1,-5 1,-8-6,-8l-15 0-9 45-19 0z"/>
   <path d="M45 125l16-81 37 0c16,1 24,9 24,23 0,24-19,38-36,37l-18 0-4 21-19 0zm27-36l5-30 13 0c7,0 12,3 12,9-1,17-9,20-18,21l-12 0z"/>
   <path d="M179 125l15-81 38 0c16,1 24,9 24,23-1,24-20,38-37,37l-17 0-4 21-19 0zm26-36l6-30 12 0c8,0 13,3 12,9 0,17-8,20-18,21l-12 0z"/>
 </g>
</svg>
`

export const redSign = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M30,1h40l29,29v40l-29,29h-40l-29-29v-40z" stroke="#000" fill="none"/> 
  <path d="M31,3h38l28,28v38l-28,28h-38l-28-28v-38z" fill="#a23"/> 
  <text x="50" y="68" font-size="48" fill="#FFF" text-anchor="middle"><![CDATA[410]]></text>
</svg>`
