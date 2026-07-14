# DefinedMotion

DefinedMotion contains the animation runtime, visual Studio, automation CLI, and the matching
versioned reference corpus used by people and coding agents.

Consumer projects own their `definedmotion.config.ts`, `src/scenes`, and `src/assets`; updating the
dependency does not replace them. Run the Studio with `definedmotion dev` and list all packaged and
project scenes with `definedmotion scenes`.

See `reference/INDEX.md` for examples, executable visual tests, and the agent workflow.

Final video renders are written to the consumer project's `renders/` directory. Temporary frame
and audio data stay under `.definedmotion/cache/`.
