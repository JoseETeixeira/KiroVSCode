# Kiro-Style Copilot Extension - User Guide

## Overview

This extension brings Kiro IDE's powerful dual-mode workflow to Visual Studio Code, integrating seamlessly with GitHub Copilot.

## Two Coding Modes

### 🎯 Vibe Coding Mode

**Philosophy:** Chat first, then build. Explore ideas and iterate as you discover needs.

**Best For:**
- Rapid exploration and prototyping
- Building when requirements are unclear
- Quick implementation tasks
- Learning new technologies
- Experimental features

**Workflow:**
1. Start chatting about your idea
2. Iterate quickly with AI assistance
3. Refine as you discover needs
4. Test and adjust on the fly

### 📋 Spec Mode

**Philosophy:** Plan first, then build. Create requirements and design before coding starts.

**Best For:**
- Complex feature development
- Team collaboration
- Formal documentation requirements
- Enterprise projects
- Mission-critical features

**Workflow:**
1. Gather project context from `.kiro/steering/`
2. Generate formal `requirements.md` using EARS syntax
3. Get approval before proceeding
4. Iterate on requirements
5. Move to design phase
6. Implement with clear specifications

## Getting Started

### Installation

1. Package the extension:
   ```powershell
   npm install
   npm run compile
   ```

2. Install in VS Code:
   - Press `F5` to run in debug mode, or
   - Package with `vsce package` and install the `.vsix` file

### First Use

1. **Select Your Mode:**
   - Open Command Palette (`Ctrl+Shift+P`)
   - Type "Kiro: Select Coding Mode"
   - Choose Vibe or Spec

2. **Configure Prompts Path (Optional):**
   - Open Settings
   - Search for "Kiro Copilot"
   - Set `kiroCopilot.promptsPath` if different from default

## Working with Tasks

### Creating a tasks.md File

Create a file named `tasks.md` in your workspace:

```markdown
# My Tasks

- [ ] 1. Build authentication system
- [ ] 2. Add product review feature
- [ ] 3. Implement search
- [x] 4. Setup database (completed)
```

### Task Detection

When you open `tasks.md`:

1. The **Task Context** view appears automatically
2. Shows current mode (Vibe 🎯 or Spec 📋)
3. Lists all detected tasks
4. Click any task to start working on it

### Supported Task Formats

- `- [ ] Task description` (checkbox)
- `- [x] Completed task` (checked)
- `1. Numbered task`
- `- [ ] 1. Combined format`

## Using the Chat Participant

### Basic Commands

In any VS Code chat:

```
@kiro /vibe          # Switch to Vibe Coding mode
@kiro /spec          # Switch to Spec mode
@kiro /task          # Start working on current task
@kiro Help me...     # Regular chat with mode context
```

### Chat Behavior by Mode

**In Vibe Mode:**
- Conversational, exploratory approach
- Quick iterations and suggestions
- Focus on rapid implementation
- Encourages experimentation

**In Spec Mode:**
- Structured, methodical approach
- Requirements-first thinking
- EARS syntax for acceptance criteria
- Approval gates for progression

## Spec Mode Workflow

### Requirements Generation

When you ask to plan a feature in Spec mode:

1. **Context Gathering:**
   - Reads all files in `.kiro/steering/`
   - Understands product goals, tech stack, personas

2. **Requirements Generation:**
   - Creates `.kiro/specs/[feature-name]/`
   - Generates `requirements.md` with:
     - Introduction and objectives
     - User stories
     - EARS-formatted acceptance criteria

3. **Approval Gate:**
   - Shows generated requirements
   - Asks: "Do the requirements look good? If so, we can move on to the next phase."
   - Waits for your explicit approval

4. **Iteration:**
   - Makes requested changes
   - Returns to approval gate
   - Continues until approved

### EARS Syntax Example

```markdown
**As a** customer, **I want** to submit a rating and comment, **so that** I can share my feedback.

**Acceptance Criteria:**
1. IF the user is logged in, THEN the system SHALL display the review form.
2. WHEN the user submits a rating between 1 and 5 stars, THEN the system SHALL accept it.
3. IF the comment exceeds 500 characters, THEN the system SHALL show a validation error.
```

## Custom Prompts

### Default Prompts Location

```
C:\Users\josee\AppData\Roaming\Code\User\prompts\
```

### Prompt Files

- `requirements.prompt.md` - Used in Spec mode for requirements generation
- `BASE_SYSTEM_PROMPT.instructions.md` - Base instructions for both modes
- Add your own custom prompts as needed

### How Prompts Are Applied

**Vibe Mode:**
- Loads `BASE_SYSTEM_PROMPT.instructions.md`
- Applies conversational, iterative style

**Spec Mode:**
- Loads `requirements.prompt.md` first
- Then loads `BASE_SYSTEM_PROMPT.instructions.md`
- Follows structured workflow

## Steering Files

Create project context in `.kiro/steering/`:

```
.kiro/
└── steering/
    ├── product.md      # Product goals and vision
    ├── tech.md         # Technology stack
    ├── personas.md     # User personas
    └── api-style.md    # API guidelines
```

These files are automatically read in Spec mode to provide context for requirements generation.

## Commands Reference

| Command | Description |
|---------|-------------|
| `Kiro: Select Coding Mode` | Open mode picker |
| `Kiro: Switch to Vibe Coding Mode` | Activate Vibe mode |
| `Kiro: Switch to Spec Mode` | Activate Spec mode |
| `Kiro: Start Task from Current File` | Begin working on selected task |

## Configuration Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `kiroCopilot.mode` | `vibe` | Current coding mode |
| `kiroCopilot.promptsPath` | User prompts folder | Custom prompts directory |
| `kiroCopilot.autoDetectTasks` | `true` | Auto-detect tasks.md files |

## Tips and Best Practices

### When to Use Vibe Mode
- ✅ Prototyping new ideas
- ✅ Learning and experimentation
- ✅ Quick bug fixes
- ✅ One-off scripts or tools
- ✅ Unclear requirements

### When to Use Spec Mode
- ✅ New major features
- ✅ Team projects
- ✅ Customer-facing functionality
- ✅ Regulated environments
- ✅ Complex business logic

### Switching Between Modes
You can switch modes at any time:
- Use the sidebar panel
- Use chat commands (`@kiro /vibe` or `@kiro /spec`)
- Use Command Palette

### Organizing Your Work

**For Vibe Projects:**
```
project/
├── tasks.md
├── src/
└── experiments/
```

**For Spec Projects:**
```
project/
├── .kiro/
│   ├── steering/       # Project context
│   └── specs/          # Feature specs
│       └── feature-1/
│           ├── requirements.md
│           └── design.md
├── tasks.md
└── src/
```

## Troubleshooting

### Tasks not showing up
- Ensure file is named exactly `tasks.md`
- Check task format (use checkboxes or numbers)
- Refresh the Task Context view

### Prompts not loading
- Verify path in settings
- Check file permissions
- Ensure prompt files exist

### Mode not switching
- Check Output panel for errors
- Reload VS Code window
- Verify extension is activated

## Examples

See the `examples/` folder for:
- `tasks.md` - Example task file
- Sample project structures
- Common workflows

## Support

For issues or questions:
1. Check the Output panel (View → Output → Kiro-Style Copilot)
2. Review SETUP.md for development setup
3. Check example files in `examples/`
