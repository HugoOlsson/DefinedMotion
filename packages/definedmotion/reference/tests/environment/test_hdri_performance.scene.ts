

import { defineScene } from 'definedmotion'

export default defineScene({
  id: 'test-hdri-performance',
  name: 'HDRI Performance',
  isTest: true,
  create: test_hdri_performance
})
import { addHDRI, HDRIs, loadHDRIData } from "definedmotion/rendering";
import { AnimatedScene, HotReloadSetting, SpaceSetting } from "definedmotion";

export function test_hdri_performance(): AnimatedScene {
    return new AnimatedScene(2000, 2000, SpaceSetting.ThreeDim, HotReloadSetting.TraceFromStart, async (dm) => {
         const hdriData = await loadHDRIData(HDRIs.outdoor1, 2)
         await addHDRI(dm, hdriData, 1, 1)

         dm.addWait(20)
    })
}
