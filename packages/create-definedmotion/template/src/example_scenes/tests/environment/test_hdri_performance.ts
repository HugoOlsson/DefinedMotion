

import { addHDRI, HDRIs, loadHDRIData } from "$renderer/lib/rendering/hdri";
import { AnimatedScene, HotReloadSetting, SpaceSetting } from "$renderer/lib/scene/sceneClass";

const hdriData = await loadHDRIData(HDRIs.outdoor1, 2)

export const test_hdri_performance = (): AnimatedScene => {
    return new AnimatedScene(2000, 2000, SpaceSetting.ThreeDim, HotReloadSetting.TraceFromStart, async (dm) => {
         await addHDRI(dm, hdriData, 1, 1)

         dm.addWait(20)
    })
}