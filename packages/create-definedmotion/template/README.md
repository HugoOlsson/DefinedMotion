# DefinedMotion project

Run the Studio with `npm run dev`. Create `*.scene.ts` files under `src/scenes` and place project
media under `src/assets`.

Final videos appear under `renders/`. DefinedMotion keeps temporary frames, mixed audio, builds,
and runtime state under `.definedmotion/`.

The installed version-specific examples, tests, and agent workflow live under
`node_modules/definedmotion/reference`.

Update the framework and its matching reference corpus with `npm install definedmotion@latest`.
This does not replace `definedmotion.config.ts`, `src/scenes`, or `src/assets`.
