# DefinedMotion project

Run the Studio with `npm run dev`. Create `*.scene.ts` files under `src/scenes` and place project
media under `src/assets`.

Start with the installed, version-matched documentation:

- `node_modules/definedmotion/documentation/getting-started.md`
- `node_modules/definedmotion/documentation/index.md`

Use `npm run dm -- scenes --json` to list scenes and `npm run dm -- verify --scene <id> --json`
to run the checks authored inside a scene.

Final videos appear under `renders/`. DefinedMotion keeps temporary frames, mixed audio, builds,
and runtime state under `.definedmotion/`.

Curated examples live under `node_modules/definedmotion/reference/examples`; regression fixtures
under `reference/tests` are not authoring documentation.

Update the framework and its matching reference corpus with `npm install definedmotion@latest`.
This does not replace `definedmotion.config.ts`, `src/scenes`, or `src/assets`.
