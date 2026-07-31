# Working with DefinedMotion

The installed DefinedMotion implementation, documentation, and reference corpus have the same
version.

Before creating or substantially modifying a scene:

1. Read `node_modules/definedmotion/documentation/index.md` and the task-specific canonical guide.
2. Use curated examples from `node_modules/definedmotion/reference/examples` when helpful.
3. Import only from documented public `definedmotion` entry points.
4. Validate authored contracts with `verify`, progression with `timeline-grid`, semantic state with
   `inspect`, and important frames with `still`.

Frames are the scheduling source of truth; public animation durations are seconds. Preserve exact
seek/reset determinism. Do not treat proposals or regression fixtures as supported authoring
documentation.

User scenes belong in `src/scenes`; user assets belong in `src/assets`. Do not edit files under
`node_modules/definedmotion`; update the dependency when a newer framework and reference corpus is
needed. Reference scenes are registered from the installed package and must not be copied into
`src/scenes` merely to make them available.

Use `scene.asset()` for project media. Examples may use `referenceAsset()` for sample files shipped
with the reference corpus; when replacing that media with a project file, copy it into `src/assets`
and switch to `scene.asset()`.

Run `npm run typecheck` and `npm run build` before handing off source or configuration changes. Keep
generated automation images, build output, and runtime state under `.definedmotion/`, and final
videos under `renders/`; do not commit either directory.
