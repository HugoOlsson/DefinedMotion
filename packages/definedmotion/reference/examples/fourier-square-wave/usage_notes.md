# Fourier square wave usage notes

## Intent

- Rebuild the older rainbow-on-panel example in the established minimal blackboard style: one centered title, one equation, quiet guides, restrained accents, and no decorative surfaces.
- Preserve the useful epicycle construction, but make the relationship explicit by connecting its endpoint to the first sample of the unrolled Fourier sum.
- Use a fixed horizontal comparison: rotating odd harmonics on the left and the resulting partial sum on the right.

## DefinedMotion experience

- Named beat windows make the explanation much clearer than deriving every editorial event from raw global frame thresholds. The persistent phase and vector relationship remain an appropriate `scene.onEachTick()` calculation because they are mathematical functions of the exact global frame.
- `createCurve()` replaces the scene's custom mutable `THREE.Line` implementation for circles, radius vectors, the connector, the reconstructed wave, and the ideal target. `setPath()` is sufficient for all per-frame updates and keeps foreground depth behavior consistent with other reference scenes.
- A live trace must evaluate every horizontal sample using the scene state from the frame when that sample was produced. Reusing the current harmonic weights across the whole curve made new circles improve the past retroactively, contradicting the endpoint connector. The corrected plot carries historical weights forward as samples move from left to right.
- Curve resolution must follow the highest represented frequency. The original fixed 321 samples severely undersampled the 99th harmonic after the scene grew to fifty terms, producing aliased wedge segments and temporal flicker. The waveform now derives 2,377 samples from twelve samples per cycle of its highest harmonic.
- `layout.flex()` is a good fit for the centered header, plot captions, and final note. The two mathematical plots retain explicit authored centers because their coordinate origins and connecting line are meaningful.
- Pre-created term-count labels avoid asynchronous per-frame text shaping. A semantic state probe exposes the exact active term count and coefficients for inspection.
- The formula uses semantic LaTeX parts for the reciprocal amplitude and odd frequency. The comparison beat can therefore mark the mathematical reason higher harmonics become smaller without selecting glyph indices.
- The scene verifies both temporal ends of the defining invariant: the epicycle endpoint equals the newest waveform sample, while the oldest rendered sample equals the Fourier sum from its own historical frame.
- Exposure metadata accepts only flat finite JSON primitives. Semantic LaTeX structure should be exposed as a boolean capability flag; putting the part-name array in metadata aborted scene construction.
- Growing a curve from an almost-zero radius exposed a scale-dependent parallel-segment check in `createCurve()`. The primitive now compares directions independently of segment scale, with a regression test covering tiny valid circles.
- The full-frame verification caught a transient 1.3-pixel safe-margin violation that was not apparent at the inspection frame. This scene benefits materially from verifying the complete animation rather than only representative stills.

## Result

- The scene is 30 seconds at the project frame rate and uses four beats: `intro`, `assemble`, `compare`, and `resolve`.
- The construction grows from one to fifty odd harmonics. Later epicycle strokes become progressively finer and quieter so the small high-frequency terms remain legible instead of accumulating into a heavy knot.
- Dynamic paths use the public curve primitive; typography groups use the public layout system; all durations are authored in seconds while beat boundaries remain exact frames.
