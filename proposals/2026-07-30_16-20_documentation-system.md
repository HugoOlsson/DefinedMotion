# Documentation system

## Goal

Make small, task-focused files under `packages/definedmotion/documentation/` the source of truth for the shipped library. README and `AGENTS.md` provide overview and routing rather than duplicate API explanations.

## Structure

```text
DefinedMotion/
  README.md
  proposals/
  packages/
    definedmotion/
      README.md
      AGENTS.md
      documentation/
        index.md
        getting-started.md
        scenes-and-timeline.md
        animation-effects.md
        beats.md
        text-and-latex.md
        latex-effects.md
        layout.md
        verification.md
        camera-and-3d.md
        assets-and-audio.md
        cli.md
        advanced/
          custom-animations.md
      reference/
        examples/
        tests/
```

The exact file list may change, but each core concept has one canonical owner.

## Roles

### README files

The package README contains:

- a short description of DefinedMotion;
- installation;
- one minimal scene;
- a brief capability overview;
- links into `documentation/`.

It does not repeat complete feature semantics or command references.

The repository root README remains a short repository and development overview that links to the package documentation.

### Documentation

`packages/definedmotion/documentation/` describes only currently shipped behavior. Each feature file follows a compact structure:

```text
What it solves
Minimal example
API
Rules and guarantees
Common mistakes
Related advanced features
```

Rules such as coordinate space, frame ranges, binding time, reset behavior, and layout effects are stated in the feature's canonical file.

`documentation/index.md` provides recommended reading paths:

```text
First scene:
  getting started → scenes and timeline → animation effects

UI-heavy explainer:
  text and LaTeX → LaTeX effects → layout → beats → verification

Procedural or 3D scene:
  camera and 3D → custom animations → verification
```

### AGENTS.md

The package `AGENTS.md` remains short and contains:

- required repository commands;
- deterministic-seeking and authoring rules;
- file locations and project constraints;
- a task-to-document routing table.

It links to canonical documentation instead of restating it. It explicitly tells agents not to treat proposals or regression tests as supported authoring examples.

### Proposals

The repository-level `proposals/` directory describes possible future behavior and is never presented as current API documentation or shipped as part of the authoring guide.

When a proposal is implemented:

1. Update its canonical documentation file.
2. Add or update an executable example.
3. Add regression coverage.
4. Mark or archive the proposal as implemented.

### Examples and tests

`reference/examples/` contains a small curated set of executable authoring examples. Documentation links only to these canonical examples.

`reference/tests/` contains implementation regression fixtures. Tests remain available to maintainers but are excluded from the normal documentation catalog and agent reading path.

## Source-of-truth rule

Each concept is fully explained in one place:

```text
Timeline and AnimationPlan → scenes-and-timeline.md
Viewer preview             → scenes-and-timeline.md
Core animation helpers    → animation-effects.md
Beat windows              → beats.md
Text and LaTeX            → text-and-latex.md
LaTeX animation effects   → latex-effects.md
Flex and grid             → layout.md
Scene verification        → verification.md
```

README, `AGENTS.md`, and other feature files may summarize and link but do not reproduce the complete rules.

## Advanced material

Low-level capabilities live under `documentation/advanced/`. A normal scene should not require reading raw animation binding, renderer internals, SVG internals, or other implementation details. Pedagogical LaTeX effects remain part of the primary documentation.

Advanced features remain documented and supported without enlarging the primary reading path.

## Validation

Documentation is included in the package allowlist and ships with the matching package version. Canonical examples are typechecked and exercised in CI. Documentation link validation prevents stale paths.

Generated or exhaustive API reference may exist separately, but it does not replace the task-focused canonical documents.

## Migration

The existing README and agent workflow are split by concept into `documentation/`. Duplicate explanations are removed rather than copied.

Outdated examples using deprecated APIs are migrated or removed from the canonical example set. Internal regression scenes no longer appear beside authoring examples in the public index.
