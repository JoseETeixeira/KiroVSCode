# Product Overview

KiroVSCode is a Visual Studio Code extension that mirrors the dual-mode Kiro IDE experience so that developers can run spec-driven workflows directly inside VS Code. The extension exposes dedicated commands, tree views, and chat participants that let engineers switch between Vibe and Spec modes, synchronize with `.kiro` specs, and surface tasks from `tasks.md` files.

## Core Objectives
- Keep spec-driven development approachable by automating repetitive workflow steps (requirements, design, tasks, and implementation execution).
- Provide tight integration between GitHub Copilot Chat and Kiro prompts so that users can trigger `/vibe`, `/spec`, and `/task` flows without leaving the editor.
- Maintain an opinionated but flexible structure that encourages requirements-first coding while still supporting rapid experimentation.

## Key Personas
- VS Code users who want guided, gated workflows instead of free-form prompting.
- Teams standardizing on Kiro-style specs (.kiro/steering + .kiro/specs) and needing consistency across projects.
- Maintainers expanding Kiro prompts or adding automation hooks that react to workspace files.

## Success Criteria
- Switching modes updates UI state, context passing, and chat instructions reliably.
- Tasks discovered from `tasks.md` files stay synchronized with tree views and commands.
- Prompt management remains simple: users point to a `prompts/` directory and the extension handles copying/loading.
- Setup flows keep new workspaces aligned with `.github/prompts` and `.kiro` structures automatically.
