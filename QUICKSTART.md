# Quick Start Guide

## Installation

1. **Install dependencies:**
   ```powershell
   npm install
   ```

2. **Run the extension:**
   ```powershell
   # Press F5 in VS Code, or manually:
   npm run compile
   ```

## 5-Minute Demo

### 1. Choose Your Mode (30 seconds)

Press `Ctrl+Shift+P` → Type "Kiro" → Select "Kiro: Select Coding Mode"

- Choose **Vibe** for rapid iteration
- Choose **Spec** for formal planning

### 2. Create a Task File (1 minute)

Create `tasks.md` in your workspace:

```markdown
# Tasks

- [ ] 1. Build user login system
- [ ] 2. Add product reviews
```

### 3. Start Working (3 minutes)

**In Vibe Mode:**
1. Open the Kiro Assistant panel (click icon in activity bar)
2. Click on "Build user login system"
3. Chat naturally about implementation
4. Iterate quickly

**In Spec Mode:**
1. Open the Kiro Assistant panel
2. Click on "Add product reviews"
3. Answer: "a product review system"
4. Review generated requirements
5. Approve or request changes

### 4. Use Chat Commands (30 seconds)

In any chat:
```
@kiro /spec       # Switch to Spec mode
@kiro /vibe       # Switch to Vibe mode
@kiro /task       # Work on current task
```

## Key Concepts

### Vibe Coding
- **When:** Prototyping, learning, unclear requirements
- **How:** Chat → Explore → Iterate → Refine
- **Output:** Working code quickly

### Spec Mode
- **When:** Complex features, team projects, formal docs
- **How:** Context → Requirements → Design → Code
- **Output:** Documented, approved specifications

## What's Next?

1. **Read the full guide:** See [USAGE_GUIDE.md](USAGE_GUIDE.md)
2. **Set up prompts:** Add your own in `C:\Users\josee\AppData\Roaming\Code\User\prompts`
3. **Create steering files:** Add context in `.kiro/steering/`
4. **Try both modes:** Compare Vibe vs Spec workflows

## Need Help?

- Check [SETUP.md](SETUP.md) for development setup
- See [examples/tasks.md](examples/tasks.md) for task examples
- Read [USAGE_GUIDE.md](USAGE_GUIDE.md) for detailed documentation
