# Kiro Quick Start

## Using `@kiro` (Recommended)

The `@kiro` command automatically sets up and uses the MCP server:

```
@kiro execute task 12
@kiro implement login feature
@kiro create requirements for auth system
```

**First time in a workspace:**
- The MCP server will be built automatically
- Configuration will be updated
- You may need to restart VS Code once

**After setup:**
- Just use `@kiro your-command`
- It opens Copilot with the right MCP tool
- Copilot executes with mode-specific prompts

## Modes

### Vibe Mode (Default) 🎯
*Chat first, then build*
```
@kiro /vibe                  # Switch to vibe mode
@kiro implement feature X    # Uses executeTask workflow
```

### Spec Mode 📋
*Plan first, then build*
```
@kiro /spec                      # Switch to spec mode
@kiro create requirements for X  # Uses requirements workflow
```

## What Happens

1. **@kiro command** → Sets up MCP if needed
2. **Opens Copilot** → With MCP tool command
3. **MCP server** → Injects mode-specific prompt
4. **Copilot** → Executes in native context with full capabilities

## Benefits

✅ Automatic setup
✅ No manual configuration
✅ Native Copilot execution
✅ Direct file editing
✅ Mode-specific prompts automatically applied

## Direct MCP Tool Usage

You can also use MCP tools directly in Copilot:

```
Use kiro_execute_task to execute task 12
Use kiro_create_requirements for feature X
Use kiro_set_mode with mode "vibe"
```

This gives you the same result without going through `@kiro`.
