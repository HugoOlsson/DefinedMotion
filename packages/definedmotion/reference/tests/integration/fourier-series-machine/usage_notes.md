# Fourier Series Machine usage notes

These notes record the experience of building `fourier_series_machine.scene.ts`. They describe the final idiomatic solution and the mistakes found while rendering and verifying it.

## What worked well

- `defineBeats()` and `timeline.beat()` made the six-part, 30-second structure easy to read. Beat-local authoring still produced one global frame timeline, and `beatProgress` was useful for the convergence demonstration.
- Saving the pointer, scheduling one 30-second `createAnimation()` for the camera-attached progress rail, and restoring the pointer cleanly expressed a background animation without another scheduling primitive.
- Late `bind()` state worked as intended. The harmonic reveal captured its current term count when the beat began rather than when the scene was built.
- A single deterministic `scene.onEachTick()` could derive all rotor transforms and every waveform sample from the current frame. Exact seeks, scrubbing, stills, and verification therefore agreed without accumulated state.
- Semantic LaTeX parts remained usable across two `morphTo()` calls. `write()`, `mark()`, and `highlight()` composed cleanly when they controlled separate time ranges.
- Continuous LaTeX morph bounds propagated into the containing layout. The formula stayed centered while its geometry changed.
- Layout-owned backgrounds and borders were reliable for both world-space plaques and camera-attached UI. Runtime `append()` reflowed the camera panel correctly.
- Camera `moveToPose()` was predictable and reached exact position and quaternion endpoints, which made frame-specific verification straightforward.
- `scene.expose()`, the state probe, and three inspection cameras made the apparatus easy to inspect without changing the audience render.
- Verification was fast enough to use repeatedly. After the physical contracts were added, 16 checks produced 12,317 assertion executions across 1,800 frames in about 0.8 seconds.
- The generic collision pass found a real camera-UI/rotor overlap that was not covered by the original viewport and containment assertions.
- A manual side view exposed physical mistakes that the audience cameras and original contracts missed. Adding a dedicated depth-inspection camera made the stepped rotor planes and their axle spacers directly inspectable.

## Unintuitive or laborious parts

- A layout resolves inside `layout.flex()`, before the returned object can be named. The first overflow therefore reported only `DefinedMotionLayout`; later overflows could use `FourierFormulaPlaque` because it had been named by then. A `name` option would make initial errors much easier to locate.
- Explicit layout dimensions include the content and padding. This is correct, but long LaTeX made it easy to underestimate the required size by a very small amount. Some overflows appeared only during a later morph, so build success at frame 0 was not meaningful evidence.
- Camera-attached UI was originally assembled manually by parenting geometry to the camera and traversing materials again after appends. `scene.addCameraAttachedUI()` now mounts the complete layout in an audience-only pass, so appended notes inherit the behavior without material repair.
- Per-frame text is not a natural fit because `setText()` is asynchronous. The scene pre-creates stable text items, appends them at beat boundaries, and exposes changing numerical state through an inspection probe instead of rewriting visible text on every tick.
- A production-looking 3D apparatus still requires substantial raw Three.js code for materials, lighting, rounded housings, gears, shadows, and grounding. DefinedMotion coordinates it well but does not reduce that modeling boilerplate.
- Mathematical continuity and physical plausibility are separate concerns. The original planar joint check could pass while coplanar rings intersected one another and crossed the stage. Physical scenes need explicit clearance and depth-separation contracts in addition to animation-state contracts.
- The core line helper represents a segment, not a thick changing polyline. The waveform therefore uses `three.meshline` directly. A measurable dynamic polyline would be a useful small rendering primitive.
- Continuously revealing a variable number of nested rotors required custom material-opacity and scale logic. The one-shot core entrance effects were not the right abstraction for a value that changes forward and backward during a later beat.
- The video encoder requires even output dimensions. The first full render originally spent time rendering all 1,800 frames at 1200×675 before H.264 rejected the odd height. The render path now rejects invalid dimensions before it changes render state, traces a frame, creates frame files, or starts the encoder. The final scene uses 1280×720.

## Things that failed during construction

- The first fixed title and formula plaque heights were too small. The layout engine rejected them immediately instead of allowing text to escape the panel.
- The expanded and final formulas exceeded the initial fixed formula width during morphing. Full-frame tracing caught this; checking only the starting formula would not have.
- The first camera-attached panel was technically inside the viewport and internally valid, but it covered the physical title plaque during close camera moves. Those verifications were true but incomplete. A timeline grid and collision watch exposed the missing visual relationship.
- Moving the panel to the lower left improved the composition, but its first version still covered the lowest part of the large rotor. The collision checker found the exact frame range. Making the panel concise and narrower removed the overlap rather than adding it to an ignore list.
- A collision watch on camera-attached UI initially reported the floor and backplate behind it as obstacles. The studio root had to be explicitly ignored; otherwise intentional background projection obscured the useful incidents.
- The first kinematic continuity assertion compared the visible bearing's small z offset with the planar linkage center. A second version also used a nonzero hidden scale, so a hidden rotor still contributed a tiny measured distance. The final contract checks planar continuity and gives hidden rotors exactly zero scale.
- The first end-to-end MP4 encode failed after frame rendering because 1200×675 is not valid input for the configured H.264 pixel format. Exact stills, grids, inspection, and verification did not exercise that final constraint.
- The first machine was composed from a mathematically correct epicycle diagram rather than a buildable mechanism. Its axis was too low for the sum of the nested radii, all rotors shared one plane, and the lower plaque was positioned through the stage. The revised model raises the axis on a pedestal and cantilever, offsets each rotor by a fixed depth step, bridges the steps with visible axle spacers, and mounts the plaque above the stage on two posts.
- The original `fourier-machine-physical-grounding` check only proved that the stage touched the floor. Its name sounded broader than its actual contract, which made it easy to overestimate the physical validation. Separate rotor-clearance, rotor-depth, and plaque-clearance checks now state the real invariants.
- The first staggered-depth update used a visibility threshold to choose the connector endpoint, while the waveform included every nonzero reveal value. At the first harmonic-reveal frame this created a tiny endpoint mismatch. The connector now takes exact x/y from the full mathematical sum and depth from the last visibly active axle, keeping numerical continuity and physical placement distinct.

## Resulting authoring rules

- Derive simulation state from global frames; use beats to describe windows, not to create separate timelines.
- Use pointer restoration for the few genuinely background plans, and keep the narrative cursor readable.
- Prefer fit-content layout until a fixed physical surface is intentional. When dimensions are fixed, verify all morph and append ranges.
- Treat camera-attached containment, viewport safety, and separation from world content as three different checks.
- Ignore only known background groups in collision watches. Do not ignore the apparatus merely to obtain a clean result.
- Pre-create text for discrete states. Reserve asynchronous text replacement for scheduled scene actions, not per-frame dependencies.
- Expose both semantic objects and diagnostic state so an agent can understand failures without relying only on screenshots.
- In a physical 3D scene, inspect at least one side-oblique camera. A frontal production camera can hide coplanar intersections and depth mistakes completely.
- Verify moving geometry against fixed surfaces over the full frame range. Checking only the initial pose is insufficient when nested linkages can reach a larger combined radius later.

## Final validation

- Duration: 1,800 frames at 60 FPS.
- Output: 1280×720; the complete 1,800-frame MP4 render and encode succeeded in the final check.
- Beats: `establish`, `fundamental`, `harmonics`, `synthesis`, `convergence`, `resolve`.
- Authored verifications: 16, including full-range rotor/stage and plaque/stage clearance plus rotor-plane separation.
- Collision watches: 2, zero incidents across all frames.
- Visual review: 12-frame timeline grid plus audience, overview, mechanism-detail, wave-recorder, and rotor-depth cameras.
