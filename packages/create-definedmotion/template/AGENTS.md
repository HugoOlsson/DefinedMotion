# Working with DefinedMotion

The installed DefinedMotion implementation and its matching reference corpus have the same version.

Before creating or substantially modifying a scene:

1. Read `node_modules/definedmotion/reference/INDEX.md`.
2. Find examples covering similar behavior.
3. Read relevant executable tests for the APIs involved.
4. Import only from the public `definedmotion` entry points used by those references.
5. Validate the full animation with `timeline-grid` and important frames with `still`.

User scenes belong in `src/scenes`; user assets belong in `src/assets`. Do not edit files under
`node_modules/definedmotion`; update the dependency when a newer framework and reference corpus is
needed. Reference scenes are registered from the installed package and must not be copied into
`src/scenes` merely to make them available.

Use `scene.asset()` for project media. Examples may use `referenceAsset()` for sample files shipped
with the reference corpus; when replacing that media with a project file, copy it into `src/assets`
and switch to `scene.asset()`.

Run `npm run build` before handing off source or configuration changes. Keep generated automation
images, build output, and runtime state under `.definedmotion/`, and final videos under `renders/`;
do not commit either directory.
