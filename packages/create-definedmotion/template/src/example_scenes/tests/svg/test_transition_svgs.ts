import { AnimatedScene, HotReloadSetting, SpaceSetting } from "$renderer/lib/scene/sceneClass";
import gravityTextSVG from '$assets/for_tests/svg/gravity_text.svg?raw'
import gripSVG from '$assets/for_tests/svg/grip_figure.svg?raw'
import { createSVGShape } from "$renderer/lib/rendering/svg/svgRendering";
import { updateSVGShape } from "$renderer/lib/rendering/svg/svgObjectHelpers";
import { fadeOut, setOpacity, updateSVGAnim } from "$renderer/lib/animation/animations";
import { latexToSVG } from "$renderer/lib/rendering/svg/latexToSVG";


export const test_transition_svgs = ():AnimatedScene => {
    return new AnimatedScene(1000, 1000, SpaceSetting.ThreeDim, HotReloadSetting.TraceFromStart, async (dm) => {
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