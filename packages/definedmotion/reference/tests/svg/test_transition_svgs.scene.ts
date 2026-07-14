import { defineScene } from 'definedmotion'
import { AnimatedScene, HotReloadSetting, SpaceSetting } from "definedmotion";

export default defineScene({
  id: 'test-transition-svgs',
  name: 'Transition Svgs',
  isTest: true,
  create: test_transition_svgs
})
import { createSVGShape } from "definedmotion/latex";
import { updateSVGShape } from "definedmotion/latex";
import { fadeOut, setOpacity, updateSVGAnim } from "definedmotion/animation";
import { latexToSVG } from "definedmotion/latex";


export function test_transition_svgs(): AnimatedScene {
    return new AnimatedScene(1000, 1000, SpaceSetting.ThreeDim, HotReloadSetting.TraceFromStart, async (dm) => {
        const gravityTextSVG = await dm.asset('svg/gravity_text.svg').text()
        const gripSVG = await dm.asset('svg/grip_figure.svg').text()
        const svgObject = createSVGShape(gravityTextSVG, 15)
        dm.add(svgObject)

        dm.addWait(500)
        const anim = updateSVGAnim(svgObject, gripSVG, 300, 10)
        dm.addAnims(anim)
        dm.addWait(500)
           const raw = latexToSVG(String.raw`
        \begin{aligned}
        \hat{f}(\omega) &= \int_{-\infty}^{\infty} f(t)\,e^{-i\omega t}\,dt,\\
        f(t) &= \frac{1}{2\pi}\int_{-\infty}^{\infty} \hat{f}(\omega)\,e^{i\omega t}\,d\omega,\\[6pt]
        \Gamma(z) &= \int_{0}^{\infty} t^{z-1} e^{-t}\,dt,\qquad
        \zeta(s) = \prod_{p\in\mathbb{P}} \frac{1}{1-p^{-s}}
        \end{aligned}
        `, { display: true });
        const anim2 = updateSVGAnim(svgObject, raw, 300, 20)
        dm.addAnims(anim2)
        dm.addWait(500)
        const anim3 = fadeOut(svgObject, 300)
        dm.addAnims(anim3)
    })
}
