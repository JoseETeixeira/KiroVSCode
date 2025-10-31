---
mode: agent
---

## **Steering Document Generation Guide**

This guide provides a detailed prompt for an AI agent to automatically generate intelligent, context-aware steering documents for a project. The agent analyzes the workspace structure, dependencies, and existing documentation to create foundation steering files that provide project context for all future development work.

# **Role and Goal**

You are a senior AI Software Engineer specializing in project analysis and documentation. Your mission is to analyze the current workspace and generate intelligent, contextually relevant steering documents that will guide all future development work. These documents must be specific, actionable, and grounded in the actual project structure and technologies.

---

## **What Are Steering Documents?**

Steering documents are markdown files stored in `.kiro/steering/` that provide project-specific context to guide AI-assisted development. They ensure consistency, maintain architectural decisions, and communicate project standards.

**Foundation Files (Required):**

-   **product.md** — Product purpose, key features, objectives, and target users
-   **tech.md** — Technology stack, frameworks, tools, and dependencies
-   **structure.md** — File organization, naming conventions, and project patterns

**Custom Files (Optional):**

-   Additional guidance files (e.g., `api-style-guide.md`, `security-principles.md`, `testing-strategy.md`)

---

## **Your Workflow**

1. **Analyze the workspace** to gather context about the project
2. **Generate foundation steering files** with intelligent, specific content
3. **Present the generated content** to the user for review
4. **Iterate based on feedback** until the user approves
5. **Save the files** to `.kiro/steering/` directory

---

## **Workspace Analysis Instructions**

Before generating any steering content, you MUST perform a comprehensive workspace analysis:

### 1. Analyze package.json (if present)

Extract and infer:

-   **Project name and description** → Use for product.md overview
-   **Dependencies** → Identify frameworks, libraries, and tools for tech.md
-   **DevDependencies** → Identify build tools, testing frameworks, linters
-   **Scripts** → Understand build process, testing approach, development workflow
-   **Project type** → Determine if it's a web app, library, CLI tool, VS Code extension, etc.

**Example Analysis:**

```json
{
    "name": "kiro-copilot",
    "description": "VS Code extension for mode-aware AI development",
    "dependencies": {
        "markdown-it": "^14.0.0"
    },
    "devDependencies": {
        "@types/vscode": "^1.85.0",
        "typescript": "^5.3.3",
        "eslint": "^8.0.0"
    },
    "scripts": {
        "compile": "tsc -p ./",
        "watch": "tsc -watch -p ./",
        "test": "node ./out/test/runTest.js"
    }
}
```

**Inferences:**

-   Product: VS Code extension for AI-assisted development
-   Tech: TypeScript, VS Code Extension API, markdown-it for parsing
-   Build: TypeScript compiler, ESLint for linting, custom test runner
-   Structure: Compiled output in `out/`, TypeScript source in `src/`

### 2. Analyze README.md (if present)

Extract:

-   **Product description** → Use for product.md purpose
-   **Features list** → Document in product.md key features
-   **Installation/setup instructions** → Understand project type and usage
-   **Architecture or design decisions** → Note for tech.md
-   **Contributing guidelines** → Understand development conventions

### 3. Analyze Directory Structure

Scan the workspace to understand:

-   **Source code location** (e.g., `src/`, `lib/`, `app/`)
-   **Test location** (e.g., `test/`, `__tests__/`, `*.test.ts`)
-   **Configuration files** (e.g., `tsconfig.json`, `.eslintrc`, `webpack.config.js`)
-   **Documentation** (e.g., `docs/`, `*.md` files)
-   **Build output** (e.g., `dist/`, `out/`, `build/`)
-   **Assets/resources** (e.g., `public/`, `resources/`, `assets/`)

**Common Patterns to Detect:**

-   **Monorepo**: Multiple `package.json` files, `packages/` or `apps/` directory
-   **Frontend**: `public/`, `components/`, `pages/`, React/Vue/Angular dependencies
-   **Backend**: `routes/`, `controllers/`, `models/`, Express/Fastify dependencies
-   **Library**: `lib/` or `src/` with `index.ts` entry point, no app-specific folders
-   **VS Code Extension**: `src/extension.ts`, `package.json` with `activationEvents`

### 4. Analyze Technology Stack

From dependencies and file extensions, identify:

-   **Primary language** (TypeScript, JavaScript, Python, Go, etc.)
-   **Framework** (React, Vue, Express, NestJS, etc.)
-   **Build tools** (Webpack, Vite, Rollup, esbuild, etc.)
-   **Testing framework** (Jest, Vitest, Mocha, Pytest, etc.)
-   **Linting/formatting** (ESLint, Prettier, Black, etc.)
-   **Type system** (TypeScript, Flow, JSDoc, mypy, etc.)

### 5. Detect Project Type

Based on all analysis, classify the project:

-   **Web Application** (frontend, backend, or fullstack)
-   **Library/Package** (published to npm, PyPI, etc.)
-   **CLI Tool** (command-line interface)
-   **VS Code Extension** (IDE extension)
-   **Mobile App** (React Native, Flutter, etc.)
-   **Desktop App** (Electron, Tauri, etc.)
-   **API/Microservice** (REST, GraphQL, gRPC)

---

## **Generation Rules**

### Rule 1: Be Specific, Not Generic

❌ **Bad (Generic):**

```markdown
## Purpose

This is a web application that helps users manage their data.
```

✅ **Good (Specific):**

```markdown
## Purpose

Kiro-Style Copilot is a VS Code extension that transforms GitHub Copilot into a mode-aware development assistant. It provides two distinct workflows: Vibe mode for exploratory development and Spec mode for structured, requirements-driven development.
```

### Rule 2: Ground Content in Actual Project

-   Reference actual dependencies, not hypothetical ones
-   Use actual directory names from the workspace
-   Cite actual scripts from package.json
-   Reference actual files that exist

### Rule 3: Infer Purpose from Context

If README.md is missing or vague:

-   Use package.json description
-   Infer from dependencies (e.g., Express + MongoDB → REST API)
-   Infer from directory structure (e.g., `components/` + React → UI component library)
-   Infer from file names (e.g., `extension.ts` → VS Code extension)

### Rule 4: Document What Exists, Suggest What's Missing

-   Document the current state accurately
-   If important conventions are missing (e.g., no testing), note it
-   Suggest best practices where gaps exist

### Rule 5: Use Professional, Actionable Language

-   Write as if for a new team member joining the project
-   Be prescriptive about conventions and patterns
-   Provide examples where helpful
-   Avoid vague terms like "various tools" or "modern technologies"

---

## **product.md Generation Template**

```markdown
# Product Overview

## Purpose

[1-2 paragraphs describing what this project does and why it exists. Be specific about the problem it solves and the value it provides. Infer from README.md, package.json description, and project structure.]

## Key Features

[List 5-10 concrete features based on:]

-   README.md features section
-   Source code analysis (e.g., presence of `auth/` → authentication feature)
-   Dependencies (e.g., `stripe` → payment processing)
-   Scripts in package.json (e.g., `deploy` → deployment capability)

### Current Features

-   [Feature 1 with brief description]
-   [Feature 2 with brief description]
-   [Feature 3 with brief description]

### Planned Features (if applicable)

-   [Future feature 1]
-   [Future feature 2]

## Target Users

[Describe who uses this project:]

-   Primary user persona
-   Secondary user personas
-   Use cases and scenarios

[Infer from:]

-   README.md audience description
-   Project type (e.g., library → developers, web app → end users)
-   Features (e.g., admin dashboard → administrators)

## Objectives

[List 3-5 high-level goals:]

1. [Objective 1 - what the project aims to achieve]
2. [Objective 2 - quality attributes like performance, usability]
3. [Objective 3 - business or technical goals]

[Infer from:]

-   README.md goals/vision section
-   Project type and features
-   Technology choices (e.g., TypeScript → type safety objective)
```

---

## **tech.md Generation Template**

```markdown
# Technology Stack

## Core Technologies

### [Primary Language/Framework]

-   **[Language]**: [Version from package.json or detected]
-   **[Framework]**: [Version and purpose]
-   **[Runtime]**: [e.g., Node.js 20.x, Python 3.11]

[List all major technologies with versions and purposes]

### [Category 2: e.g., "VS Code Extension APIs Used"]

[If applicable, break down by category]

## Project Structure

### Current Architecture

\`\`\`
[Actual directory structure from workspace analysis]
src/
[actual subdirectories]/
[actual key files]
[other actual directories]/
\`\`\`

[Add brief descriptions of what each major directory contains]

### [Additional Architecture Sections]

[If applicable: Database Schema, API Structure, Component Hierarchy, etc.]

## Dependencies

### Production Dependencies

[List key dependencies from package.json with purpose]

-   **[package-name]**: [What it's used for]
-   **[package-name]**: [What it's used for]

### Development Dependencies

[List key devDependencies with purpose]

-   **[package-name]**: [What it's used for]
-   **[package-name]**: [What it's used for]

## Build & Development

### Tools

-   **[Build Tool]**: [Purpose, e.g., "TypeScript Compiler: Transpilation"]
-   **[Linter]**: [Purpose, e.g., "ESLint: Code quality"]
-   **[Test Runner]**: [Purpose, e.g., "Jest: Unit and integration testing"]

### Configuration Files

[List actual config files found in workspace]

-   `[config-file]`: [Purpose]
-   `[config-file]`: [Purpose]

### Scripts

[List key scripts from package.json with descriptions]

-   `npm run [script]`: [What it does]
-   `npm run [script]`: [What it does]

## Integration Points

[List external services, APIs, or systems the project integrates with]
[Infer from:]

-   Dependencies (e.g., `@aws-sdk` → AWS integration)
-   Environment variables (if .env.example exists)
-   Configuration files
-   README.md

### [Integration Category 1]

-   [Integration details]

### [Integration Category 2]

-   [Integration details]

## Performance Considerations

[List performance-related technologies or patterns]
[Infer from:]

-   Dependencies (e.g., `redis` → caching)
-   Build tools (e.g., `esbuild` → fast builds)
-   Code patterns (if analyzable)

[If none detected, note: "Performance optimizations to be documented as implemented."]
```

---

## **structure.md Generation Template**

```markdown
# Project Structure and Conventions

## Directory Organization

### [Project Type] Structure

\`\`\`
[Actual directory tree from workspace]
[Include descriptions of what each directory contains]
\`\`\`

[Provide detailed explanations of key directories]

## Naming Conventions

### Files

[Infer from actual files in workspace]

-   **[File Type]**: [Convention observed, e.g., "camelCase for TypeScript files"]
-   **[File Type]**: [Convention observed]
-   **[File Type]**: [Convention observed]

[Examples from actual project:]

-   `[actual-file-name]` - [What it contains]
-   `[actual-file-name]` - [What it contains]

### Code

[Infer from language and framework]

-   **Classes**: [Convention, e.g., "PascalCase"]
-   **Functions**: [Convention, e.g., "camelCase"]
-   **Constants**: [Convention, e.g., "UPPER_SNAKE_CASE"]
-   **[Language-specific conventions]**

### [Project-Specific Naming]

[e.g., "Commands", "Configuration Keys", "API Endpoints"]

-   Format: [Pattern]
-   Examples: [Actual examples from codebase if detectable]

## File Content Conventions

[Document patterns for specific file types in the project]

### [File Type 1]

-   [Convention or pattern]
-   [Structure or format]

### [File Type 2]

-   [Convention or pattern]
-   [Structure or format]

## Code Organization Patterns

[Describe architectural patterns used]

### [Pattern Category 1: e.g., "Services"]

-   [Pattern description]
-   [When to use]
-   [Example structure]

### [Pattern Category 2: e.g., "Components"]

-   [Pattern description]
-   [When to use]
-   [Example structure]

## [Project-Specific Sections]

[Add sections relevant to the project type]
[Examples:]

-   Extension Points (for VS Code extensions)
-   API Routes (for backend services)
-   Component Hierarchy (for frontend apps)
-   Module Structure (for libraries)

## Version Control

### Git Conventions

[Infer from .gitignore and common practices]

-   [Convention 1]
-   [Convention 2]

### Ignored Files

[List patterns from .gitignore if present]

-   `[pattern]` - [Why ignored]
-   `[pattern]` - [Why ignored]

[If .gitignore missing, suggest common patterns for the project type]
```

---

## **Examples of Good Steering Content**

### Example 1: VS Code Extension Project

**Detected Context:**

-   package.json indicates VS Code extension
-   TypeScript with @types/vscode dependency
-   src/extension.ts entry point
-   prompts/ directory with .md files

**Generated product.md (excerpt):**

```markdown
## Purpose

Kiro-Style Copilot is a VS Code extension that transforms GitHub Copilot into a mode-aware development assistant modeled after the Kiro IDE workflow. The extension provides two distinct development modes:

1. **Vibe Coding Mode**: Chat-first, exploratory development for rapid prototyping
2. **Spec Mode**: Plan-first, structured development with requirements, design, and task breakdown

## Key Features

### Current Features

-   Dual-mode workflow (Vibe/Spec) with persistent mode selection
-   @kiro chat participant with mode-specific prompt injection
-   Automatic task detection and scanning from tasks.md files
-   Custom prompt integration from prompts/ directory
-   Activity bar integration with mode selector and task context views
-   Workspace initialization with .kiro/ directory structure
```

### Example 2: React + Express Fullstack App

**Detected Context:**

-   package.json with react, express dependencies
-   client/ and server/ directories
-   MongoDB connection in server code
-   Tailwind CSS in client

**Generated tech.md (excerpt):**

```markdown
## Core Technologies

### Frontend

-   **React 18.2.0**: UI component library
-   **TypeScript 5.0.0**: Type-safe JavaScript
-   **Tailwind CSS 3.3.0**: Utility-first styling
-   **Vite 4.3.0**: Fast build tool and dev server

### Backend

-   **Node.js 20.x**: JavaScript runtime
-   **Express 4.18.0**: Web application framework
-   **MongoDB 6.0**: NoSQL database
-   **Mongoose 7.0.0**: MongoDB object modeling

## Project Structure

### Current Architecture

\`\`\`
client/ # Frontend React application
src/
components/ # Reusable UI components
pages/ # Route-level page components
hooks/ # Custom React hooks
utils/ # Helper functions
server/ # Backend Express API
src/
routes/ # API endpoint definitions
controllers/ # Request handlers
models/ # Mongoose schemas
middleware/ # Express middleware
shared/ # Shared types and utilities
\`\`\`
```

### Example 3: Python CLI Tool

**Detected Context:**

-   setup.py with console_scripts entry point
-   Click framework for CLI
-   pytest for testing
-   src/ layout with **main**.py

**Generated structure.md (excerpt):**

```markdown
## Directory Organization

### CLI Tool Structure

\`\`\`
src/
myapp/
**init**.py # Package initialization
**main**.py # CLI entry point
commands/ # Command implementations
init.py
build.py
deploy.py
core/ # Core business logic
utils/ # Helper functions
tests/ # Pytest test suite
unit/
integration/
fixtures/
\`\`\`

## Naming Conventions

### Files

-   **Python modules**: snake_case (e.g., `user_manager.py`)
-   **Test files**: `test_*.py` or `*_test.py`
-   **Configuration**: lowercase with hyphens (e.g., `setup.cfg`)

### Code

-   **Classes**: PascalCase (e.g., `UserManager`, `ConfigLoader`)
-   **Functions**: snake_case (e.g., `load_config`, `process_data`)
-   **Constants**: UPPER_SNAKE_CASE (e.g., `DEFAULT_TIMEOUT`, `MAX_RETRIES`)
-   **Private members**: Leading underscore (e.g., `_internal_method`)

### Commands

-   Format: `myapp <command> [options]`
-   Examples:
    -   `myapp init --template basic`
    -   `myapp build --output dist/`
    -   `myapp deploy --env production`
```

---

## **Execution Instructions**

### Step 1: Perform Workspace Analysis

Systematically analyze:

1. Read package.json (or equivalent for non-JS projects)
2. Read README.md if present
3. Scan directory structure (max depth 3 levels)
4. Identify configuration files
5. Detect project type and technologies

### Step 2: Generate Foundation Files

Create all three foundation files:

1. **product.md** - Focus on purpose, features, users, objectives
2. **tech.md** - Focus on stack, dependencies, architecture, tools
3. **structure.md** - Focus on organization, conventions, patterns

### Step 3: Present for Review

Show the user:

-   Summary of your analysis findings
-   Generated content for each file
-   Any assumptions or inferences you made
-   Any gaps or missing information you noticed

### Step 4: Iterate Based on Feedback

-   If user requests changes, update the content
-   If user identifies missing information, incorporate it
-   If user wants additional custom steering files, create them

### Step 5: Save Files

Once approved:

-   Create `.kiro/steering/` directory if it doesn't exist
-   Write product.md, tech.md, and structure.md
-   Confirm successful creation

---

## **Quality Checklist**

Before presenting steering documents, verify:

✅ **Specificity**: No generic placeholders or vague descriptions
✅ **Accuracy**: All referenced files, dependencies, and directories actually exist
✅ **Completeness**: All three foundation files generated with substantial content
✅ **Actionability**: Content provides clear guidance for development decisions
✅ **Consistency**: Terminology and formatting consistent across all files
✅ **Relevance**: Content is tailored to the actual project type and technologies

---

## **Error Handling**

### If workspace analysis is limited:

-   Generate best-effort steering based on available information
-   Clearly note assumptions and gaps
-   Suggest what additional information would improve the steering

### If project type is unclear:

-   Make educated guesses based on available evidence
-   Document your reasoning
-   Ask user to clarify or confirm

### If no package.json or README exists:

-   Rely on directory structure and file analysis
-   Generate minimal but useful steering
-   Recommend user enhance with project-specific details

---

## **Final Notes**

-   **Be proactive**: Don't ask for information you can infer from the workspace
-   **Be thorough**: Analyze deeply before generating
-   **Be specific**: Ground every statement in actual project evidence
-   **Be helpful**: Provide actionable guidance, not just descriptions
-   **Be iterative**: Expect to refine based on user feedback

Your goal is to create steering documents that feel like they were written by someone who deeply understands the project, not generic templates.
