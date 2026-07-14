# Working with DefinedMotion

The installed DefinedMotion implementation and its matching reference corpus have the same version.

Before creating or substantially modifying a scene:

1. Read `node_modules/definedmotion/reference/INDEX.md`.
2. Find examples covering similar behavior.
3. Read relevant executable tests for the APIs involved.
4. Import only from the public `definedmotion` entry points used by those references.
5. Validate the full animation with `timeline-grid` and important frames with `still`.

User scenes belong in `src/scenes`; user assets belong in `src/assets`. Do not edit files under
`node_modules/definedmotion`.
