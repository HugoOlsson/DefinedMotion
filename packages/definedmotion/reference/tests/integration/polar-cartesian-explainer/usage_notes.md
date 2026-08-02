# Polar versus Cartesian explainer usage notes

These notes record the experience of adapting the supplied vertical Instagram animation into a horizontal DefinedMotion scene. The source establishes the mathematical action—one sine function sampled simultaneously in Cartesian and polar coordinates—but not the final composition.

## Visual and authoring intent

- Use the horizontal frame to show the two coordinate systems side by side instead of stacking them.
- Keep the established minimal blackboard style: one title, one equation, quiet guides, and no decorative panels.
- Trace `r(θ) = 2.8 sin(1.6θ)` over `0 ≤ θ ≤ 10π`. Because `1.6 = 8/5`, five angular turns produce eight radial oscillations and one closed polar curve.
- Keep both moving points synchronized to the same exact `θ` value so the relationship is explanatory rather than merely decorative.

## DefinedMotion usage experience

- `createCurve()` is a strong fit for both representations. The polar and Cartesian paths share one parameter domain and differ only in `pointAt()`. `visibleAt()` reveals accumulated samples without rebuilding scene objects.
- `setPath()` works well inside `beat.onEachTick()` for exact mathematical motion. The scene evaluates the real function at the current non-integer `θ`; no animation endpoint approximation or accumulated state is needed.
- Foreground paths, the live polar radius, and the Cartesian value guide use the portable ribbon curve primitive. Thin static axes and spokes use `createLine`, where browser line-width limitations are harmless.
- `layout.flex()` works naturally for the header, plot captions, and final summary. It is not used to position the complete plots because groups containing arbitrary guide geometry are not measurable layout items.
- Static LaTeX is appropriate for axis labels and tick values. Updating a text or LaTeX primitive every frame would involve asynchronous reshaping, so exact live values are exposed through the semantic state probe instead of rendered as rapidly changing typography.
- Negative polar radii require no special rendering branch: applying the signed radius directly to `(cos θ, sin θ)` produces the correct opposite-direction points.
- The first build overran the final beat because `latex.mark()` was longer than the parallel summary fade; the next wait therefore started after the mark, not after the fade. `ANIMATION_OUTSIDE_BEAT` reported the exact ranges before rendering. The fix was simply to size the final hold from the actual longest parallel animation.
- The first full-resolution still passed containment checks but showed that the plot captions and tick labels were visually too quiet. Increasing their type sizes and moving both caption layouts upward improved hierarchy while preserving the verified header/plot separation.
- Close viewer inspection exposed a render-pass issue that ordinary Z positioning did not prevent: fully opaque curve ribbons had `depthWrite = false`, while translucent plot guides rendered later and painted dark cuts across them. The foreground traces and live markers now opt into the transparent pass, disable depth testing, and use explicit render orders above the guides. This is reliable for a deliberately planar diagram, but it is an important curve-material behavior to consider for the general primitive.

## Contracts

- The scene verifies duration and beat ownership, public primitive usage, semantic LaTeX selection, exact point synchronization, finite dynamic buffers, viewport containment, plot separation, and the final `8/5` closure relationship.
- Collision watches cover the header and final summary, while authored screen-space verification checks the complete plot regions.

## Validation log

- Exact verification passed across all `1,560` frames: `7` authored verifications and `6,602` executed checks.
- The generic collision layout check passed across all frames with no incidents.
- A nine-frame progression grid, an eight-frame polishing grid, and full-resolution midpoint/final stills were reviewed. They confirmed synchronized drawing, readable final geometry, and a stable horizontal hierarchy.
