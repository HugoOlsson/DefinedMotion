# Quadratic formula explainer usage notes

These notes record the experience of building `quadratic_formula_explainer.scene.ts`. They are intentionally separate from the Fourier machine notes because this scene stresses sustained 2D mathematical explanation rather than physical 3D construction.

## Visual and authoring intent

- Treat the derivation as the dominant visual object. Supporting text, proof steps, and geometry exist only to explain the current algebraic move.
- Follow the VideoFactory references through hierarchy, negative space, restrained accents, and purposeful motion rather than copying a particular palette or composition.
- Use one stable LaTeX root for the entire derivation so semantic selections and layout measurement are tested across substantial rearrangements.
- Synchronize the unusual algebraic operation—adding the squared half-coefficient—with a literal geometric completion of a square.

## Initial expectations to test

- Whether a long sequence of `latex.morphTo()` plans remains comfortable to author and inspect.
- Whether semantic LaTeX parts remain reliable when their identities change between proof stages.
- Whether one fixed equation stage can contain every intermediate expression without visual jumps.
- Whether runtime-appended proof steps make a longer explanation clearer or introduce layout friction.
- Whether core transform plans are sufficient for a geometric rearrangement involving simultaneous movement and rotation.
- Whether scene verifications can express mathematical checkpoints and exact geometric relationships without excessive machinery.

## Observations during construction

- The scene could be organized cleanly as seven global beat windows. The derivation reads naturally in code because each beat owns one mathematical operation.
- Prebuilding all LaTeX morph plans keeps beat authoring synchronous, but it also creates a long block of target expressions before the choreography. This is explicit and inspectable, though slightly separated from the moment each expression is used.
- The geometric construction uses ordinary measurable rectangles plus `moveTo()` and `rotateTo()`. No proof-specific animation primitive was needed.
- A fixed equation layout surface is valuable for a derivation: it prevents different expression widths from shifting the visual center between steps.
- Runtime `append()` is a good fit for accumulating proof steps. Nested invalidation lets the list and its containing panel update on the same evaluated frame.
- Focused orthographic inspection cameras are useful even in a fixed-camera 2D explainer. They let an agent inspect formula morphs and exact tile boundaries without altering the audience composition.
- The first full trace rejected the fixed equation stage because the longest intermediate expression required `9.5041` world units while the authored height was `9.5`. The failure was precise and useful. It also confirms that fitting the initial equation says nothing about later morph states; fixed mathematical stages must be exercised over the complete derivation.
- Raising the stage to `10.2` still failed at `10.2006` while a semantic mark was active. Selection geometry participates in the LaTeX visual's measured bounds, so a fixed stage needs deliberate effect clearance rather than a dimension fitted tightly to the bare glyphs. The stage now reserves visible breathing room for both formulas and their marks.
- The first authored-verification pass found that layout containment and editorial breathing room are different thresholds. The formula technically fit, but an active mark left less than the requested 18 screen pixels. The stage was enlarged rather than weakening the check. A second region gap landed exactly on a 12-pixel boundary; the proof panel was moved lower to create real separation instead of relying on floating-point equality.
- Two `still` commands were accidentally issued concurrently against the persistent runtime. One returned a PNG with the wrong composition even though its JSON metadata named the requested frame and main camera; serial inspection showed the scene state was correct, and a serial still produced the correct image. The agent workflow says scene-contract requests should be serial, but the CLI currently permits this unsafe concurrency. It would be safer to serialize requests in the runtime or reject overlapping commands explicitly.
- The first collision pass distinguished intentional contact from poor choreography. The equation accent deliberately touches the equation card and is now an explicit ignore relationship. The final note, however, initially faded in over the still-fading diagram and proof panel for 37 frames. The animation was changed to remove the old explanation before introducing the conclusion rather than suppressing those incidents.
- The first visual review exposed a larger editorial failure that automated containment could not identify: the equation, proof steps, and conclusion were all placed in technically valid panels, but the result read as a dashboard rather than a minimal mathematical explainer. The revision keeps invisible layout stages for stability while removing rendered cards and row surfaces. This preserves layout guarantees without making layout machinery visible in the design.
- The first proof-step typography and geometric edge labels were valid and non-overlapping but too small for comfortable viewing. The scene now treats legibility as an explicit contract: proof rows have a minimum projected height and gap, while the square and its LaTeX labels are materially larger.
- The mark effect itself amplified the style problem. Its padding and horizontal bracket stubs were proportional to the selected expression's full width, so wide terms received excessive side margins, and `LineBasicMaterial` remained effectively one pixel wide in WebGL. An initial mesh-based revision used selection height instead, but visual review showed that tall fractions and radicals then received much heavier strokes than simple expressions. The library now bases padding, stub length, and stroke thickness on the LaTeX visual's authored font size and renders the brackets as filled meshes. This was a primitive-level defect, not something the scene should compensate for.
- Short scene-specific mark durations also made semantic emphasis feel like a flash. The explainer now uses the library's longer default mark instead of repeatedly restating tuned durations and padding.
- Enlarging the geometric labels made their algebra readable but exposed an unsafe editorial choice: the expressions were centered inside narrow edge areas without any containment relationship. Rather than shrinking important mathematics to satisfy incidental geometry, the revision treats them as external dimension annotations. An authored verification now requires each label to remain outside its associated tile with a deliberate gap.
- External annotations should optimize for reading rather than imitate the orientation of the area they describe. The right-side fraction was initially rotated with the vertical strip; review showed that an upright expression is clearer and still associates naturally by proximity. The title also works without an eyebrow or explanatory subtitle, so both secondary header lines were removed.
- The final header uses actual centered text and a center-anchored layout rather than a manually estimated x-position. External geometric annotations also reserve a verified `0.75`-unit minimum gap from their tiles, keeping the association clear without crowding the construction.

## Resulting assessment

- The proposed animation, beat, text, LaTeX, layout, and verification APIs are sufficient for a polished sustained algebra explainer. This scene did not reveal a need for proof-specific primitives.
- The strongest repeated authoring rule is to give changing LaTeX a stable visual stage and validate every frame. Formula glyphs, morph particles, marks, and highlights all matter to the visible footprint.
- Layout-owned surfaces and strict overflow are useful safeguards, but authored verification is still needed for optical spacing between complete regions.
- Semantic part IDs work well as local meaning attached to a particular equation state. They do not need to remain identical across every line of a derivation as long as effects and verifications reference the current state deliberately.
- Generic collision checking is valuable during transitions. It caught a visually unnecessary cross-fade that containment and endpoint checks could not detect.
- The most concrete hardening candidate from this scene is CLI concurrency safety for the persistent runtime. This is more important for agents than adding another math animation helper.

## Final validation

- Duration: 2,640 frames, 44 seconds at 60 FPS.
- Resolution: 1280×720.
- Beats: `setup`, `normalize`, `complete-square`, `factor`, `square-root`, `isolate`, and `resolve`.
- Authored verification: 14 contracts, 15,366 assertion executions, zero failures.
- Generic layout check: 4 watched regions, zero incidents after the resolution choreography was corrected.
- Inspection: 14-frame timeline grid plus main, equation-focus, and geometry-focus cameras.
- Package validation: complete `npm test` passed, including type checking, unit tests, documentation validation, and public-reference imports.
- Render: all 2,640 frames rendered and encoded successfully to a 44-second MP4 in the final check.
