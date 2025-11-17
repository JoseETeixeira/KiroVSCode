# Project Structure

- `src/extension.ts` bootstraps the VS Code extension, registers commands, chat participants, and services.
- `src/services/` holds core service classes (mode manager, prompt manager, setup service) that are shared between commands.
- `src/views/` contains tree data providers and UI-specific helpers for mode selector and task context panels.
- `prompts/` stores canonical prompt templates (requirements, design, execute task, etc.) that the extension can sync into `.github/prompts/` inside a user workspace.
- `.github/prompts/` in each workspace mirrors the shipped prompt templates so GitHub Copilot Chat can load them; repo-level `.github/instructions/` carry system guidance.
- `.kiro/steering/` stores high-level guidance (product, tech, structure) while `.kiro/specs/<feature>/` holds requirements, design docs, and tasks for each feature.
- Docs like `README.md`, `START_HERE.md`, and `USAGE_GUIDE.md` explain workflows, while `resources/` contains icons/assets and `mcp-server/` exposes optional MCP automation.
