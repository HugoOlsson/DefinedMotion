# Spherical triangle explainer usage notes

These notes record the experience of building `spherical_triangle_explainer.scene.ts`. This scene deliberately differs from the quadratic explainer: its mathematical content lives in 3D world space while the title and changing equation remain attached to the audience camera.

## Visual and authoring intent

- Keep the blackboard hierarchy established while polishing the quadratic scene: one centered title, one large equation, no decorative cards, and no secondary header lines.
- Use physically meaningful 3D geometry rather than a sphere-shaped illustration. The spherical example is the positive-coordinate octant bounded by three quarter great circles.
- Compare the cases over time and together in the final frame. The flat construction should remain recognizably Euclidean; the spherical construction should make curvature and great-circle paths unmistakable.
- Reserve accent colors for mathematical identity: three angle/edge families use coral, gold, and mint while surfaces and grids remain quiet.

## Contracts being exercised

- Global beats and pointer restoration for a background timeline-progress animation.
- Perspective camera movement between flat, comparison, spherical-detail, and final-comparison poses.
- Camera-attached text and a morphing semantic LaTeX equation without panels.
- World-space LaTeX angle labels, including camera-facing labels on a curved surface.
- Exact 3D geometry checks for planar angle sum, spherical angle sum, great-circle radius, shared endpoints, and final projected separation.
- Projected verification that 3D world content remains between the camera-attached title and formula.

## Initial implementation observations

- The octant construction is a strong authoring target because its explanation and verification use the same invariant: the three vertex axes are mutually perpendicular, so tangent directions meet at 90° at every vertex.
- Three.js remains the right escape hatch for mathematical surfaces. A normalized barycentric subdivision produced a clean spherical patch without requiring a new DefinedMotion primitive.
- Camera-attached typography is straightforward for static text, but prepared `latex.morphTo()` destinations are attached after the initial material traversal. The scene currently reasserts overlay depth settings on the formula during ticks. This repeats the camera-attached UI friction already found in the Fourier machine and strengthens the case for a dedicated library helper.
- The scene uses authored screen-space separation checks in addition to world-space correctness. A valid spherical triangle can still become unreadable if a camera move places it behind the title or equation.
- The first exact trace rejected a simultaneous sphere reveal and camera move: while the audience camera still framed the flat case, the emerging sphere projected partly offscreen and briefly entered the title region. Sequencing the overview move before the reveal fixed the composition at its cause. The same trace found the bottom formula two pixels inside the intended safe margin, so the overlay was moved upward rather than weakening the margin.
- A bounds-center check incorrectly described a semantically marked equation as off-center because the mark intentionally surrounds only the selected left-hand terms. The stable centering invariant is the camera projection of the centered visual's anchor; complete bounds remain the correct invariant for viewport safety. The trace also showed that the initial long titles were oversized relative to the established blackboard hierarchy, so their camera-space font size was reduced.
- The complete spherical grid missed the bottom formula's 18-pixel clearance by roughly one pixel during the focus transition. Reducing the sphere's authored display scale from `0.90` to `0.86` created a stable margin without changing its mathematical radius, topology, or camera choreography.
- A targeted endpoint check then showed that the original sphere-detail camera was fundamentally too close once the three external `90°` labels appeared: the complete annotated object crossed both overlays and the viewport. The focus pose was moved farther away and aimed slightly below the sphere center so all authored geometry—not merely the surface mesh—fits in the middle band.
- After the wider focus pose, the moving grid still missed the bottom separation threshold by less than one pixel at an intermediate frame. Moving the formula exposed a tradeoff rather than solving it: downward movement improved world separation but consumed the formula's viewport margin. The stable fix was to preserve the formula's safe position and correct the camera path.
- Adjusting only the camera target moved the near miss to another frame because the path still dollied from `z=20` to `z=16.5`, enlarging the sphere during the transition. The final focus move changes lateral and vertical viewpoint while retaining approximately the overview distance. This communicates curvature through orbit rather than through an unnecessary close-up.
- Inspection cameras are valuable for checking the 3D topology, but camera-attached typography is authored specifically for the main camera. It consequently appears oblique or cropped through auxiliary cameras. That is expected and argues for treating inspection-camera composition separately from the audience-view UI contract.
- Visual review found that the original equation competed with the sphere and that aiming the focus camera below the sphere pushed the construction above the visual center. Reducing the equation font size, centering the camera target on the sphere, and using a slightly smaller authored sphere scale produced a balanced middle band while retaining clearance throughout the camera transition.
- Colored world-space `90°` labels were difficult to read where their edge colors crossed the shaded sphere. The underlying text renderer already supported glyph outlines, but `createText()` did not expose them. The primitive now accepts measured `outlineColor` and `outlineWidth` options, allowing the scene to use a real dark outline instead of duplicate text or offset shadows. Radially positioning all three labels by the same geometric rule also keeps them clear of their corner markers.
- The first right-angle symbols reused the generic multi-point tube helper. Because that helper intentionally fits a Catmull–Rom curve through three points, it rounded and bulged an inherently square mathematical mark. The replacement is a dedicated tangent-plane construction made from two thin rectangular bars. The markers use neutral ivory so they remain distinct from both adjoining colored edges, and small neutral junction caps replace the oversized colored vertex spheres. This is a useful boundary: smooth tubes are appropriate for great-circle paths, while symbolic geometry needs primitives that preserve exact corners.
- The first straight-marker pass placed the tangent plane at `R + 0.18` while the colored edges use `R + 0.07`. A close viewer inspection made the resulting air gap obvious even though the overview looked acceptable. The marker plane now shares the edge lift and adds only a `0.01` anti-flicker clearance, so its legs visibly meet the two paths.
- The flat construction initially used a shaded rectangular plane and coordinate grid to signal Euclidean space. In practice it read as another UI panel and was unnecessary: the straight triangle already communicates the flat case. Removing both makes the comparison more consistent with the minimal blackboard style. The planar angle arcs were also reduced below the edge stroke width so annotations no longer overpower the triangle itself.
- Close inspection also showed that the spherical great-circle tubes carried more visual weight than the flat triangle edges. Reducing their radius from `0.075` to `0.06`, with proportionally smaller junction caps, preserves the 3D form while making the two cases feel like parts of the same visual system.
- Replacing the opaque shaded sphere with a blue triangulated wireframe made curvature readable without introducing a large filled mass into the blackboard composition. The existing latitude/longitude guide remains at much lower opacity, while the colored great-circle edges and octant patch retain the mathematical hierarchy.

## Validation log

- Exact verification passed across all `2,280` frames: `13` authored verifications and `8,468` executed checks.
- The generic collision layout check passed across all frames with no incidents.
- A 16-frame timeline grid and four large keyframes were reviewed. They confirmed the intended progression from a flat construction, through a great-circle construction, to the simultaneous `180°`/`270°` comparison.
- Main, comparison, polar, and topology camera views were inspected at the fully annotated spherical stage. The audience composition is clean, while the auxiliary views confirm that the patch and edge paths are genuinely three-dimensional.
- After typography and label refinement, the exact all-frame verification and generic layout check were repeated successfully.
