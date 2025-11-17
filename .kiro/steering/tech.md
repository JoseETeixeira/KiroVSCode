# Technology Stack

- **Runtime & Language**: TypeScript compiled to JavaScript via `tsc` (Node.js 18+) for VS Code extension APIs.
- **Build Tooling**: `npm run compile` runs `tsc` with `tsconfig.json`; `npm run watch` keeps the extension rebuilt incrementally.
- **VS Code APIs**: Uses `vscode` extension points for commands, tree data providers, chat participants, configuration inspection, and workspace file access.
- **Kiro Integration**: Chat participant (`@kiro`) pipes user commands through prompt templates stored in `.github/prompts` or user overrides; `.kiro` folder mirrors spec artifacts and steering docs.
- **Testing & Validation**: Lightweight manual verification through the Extension Development Host; automated tests are currently minimal, so changes should include targeted unit coverage where practical.
- **Packaging**: Extension metadata and activation scripts reside in `package.json` and `src/extension.ts`; assets under `resources/` feed UI components.
