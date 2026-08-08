# create-definedmotion

Requires Node.js 24.11 or newer.

Create a thin DefinedMotion animation project:

```bash
npx create-definedmotion my-animation
cd my-animation
npm install
npm run dev
```

The generated project owns its configuration, scenes, and assets. The runtime, Studio, CLI, and
version-matched reference examples and tests come from its `definedmotion` dependency, so updating
the dependency does not replace project files.

Final videos are written to `renders/`; temporary rendering data remains hidden under
`.definedmotion/`.
