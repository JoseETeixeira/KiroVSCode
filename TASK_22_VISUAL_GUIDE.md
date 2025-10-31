# Task 22: Mode Selection - Visual Guide

## What Users Will See

### 1. First Interaction - Mode Selection Prompt

When a user types `@kiro` for the first time, they see:

```
## Let's build

Plan, search, or build anything

---

### Choose your coding mode:

**🎯 Vibe Coding** (current)

*Chat first, then build. Explore ideas and iterate as you discover needs.*

Great for:
- Rapid exploration and testing
- Building when requirements are unclear
- Implementing a task

Use `/vibe` to switch to this mode

---

**📋 Spec Mode**

*Plan first, then build. Create requirements and design before coding starts.*

Great for:
- Thinking through features
- Projects needing planning
- Building in a structured way

Use `/spec` to switch to this mode

---

**Current mode:** 🎯 Vibe Coding

You can switch modes anytime using `/vibe` or `/spec` commands.
```

### 2. Mode Status Display (Every Interaction)

At the start of each chat interaction:

```
### 🎯 Vibe Coding Mode

*Chat first, then build. Explore ideas and iterate as you discover needs.*

---

[User's message and AI response follow...]
```

Or for Spec mode:

```
### 📋 Spec Mode

*Plan first, then build. Create requirements and design before coding starts.*

---

[User's message and AI response follow...]
```

### 3. Switching Modes with Slash Commands

**User types:** `@kiro /spec`

**System responds:**

```
Switched to **Spec** mode 📋

*Plan first, then build. Create requirements and design before coding starts.*

Great for:
- Structured feature development
- Requirements-driven development
- Complex features requiring formal specs

💡 *Your chat history has been preserved and will continue in Spec mode.*
```

**User types:** `@kiro /vibe`

**System responds:**

```
Switched to **Vibe Coding** mode 🎯

*Chat first, then build. Explore ideas and iterate as you discover needs.*

Great for:
- Rapid exploration and testing
- Building when requirements are unclear
- Implementing a task

💡 *Your chat history has been preserved and will continue in Vibe mode.*
```

### 4. Status Bar Display

Bottom left of VS Code window:

```
🎯 Kiro: Vibe    [clickable]
```

or

```
📋 Kiro: Spec    [clickable]
```

**Tooltip on hover:** "Click to change Kiro coding mode"

### 5. Mode Selector Quick Pick (Click Status Bar or Use Command)

```
┌─────────────────────────────────────────────────────────────┐
│ Kiro Coding Mode                                            │
├─────────────────────────────────────────────────────────────┤
│ 🚀 Vibe Coding                                    ✓ Currently active │
│ Chat first, then build. Explore ideas and iterate...       │
├─────────────────────────────────────────────────────────────┤
│ 📓 Spec                                                     │
│ Plan first, then build. Create requirements and design...  │
└─────────────────────────────────────────────────────────────┘
```

## User Workflows

### Workflow 1: New User Starting Fresh

1. Opens VS Code with Kiro extension
2. Sees status bar: `🎯 Kiro: Vibe` (default)
3. Types `@kiro I want to build a login system`
4. Sees mode selection prompt explaining both modes
5. Continues with Vibe mode or switches using `/spec`
6. Mode preference is saved for future sessions

### Workflow 2: Experienced User Switching Modes

1. Working in Vibe mode
2. Realizes they need structured planning
3. Types `@kiro /spec` in chat
4. Sees confirmation and history preservation notice
5. Status bar updates to `📋 Kiro: Spec`
6. Continues conversation in Spec mode with full context

### Workflow 3: Quick Mode Check

1. User forgets current mode
2. Looks at status bar: `📋 Kiro: Spec`
3. Or starts typing `@kiro` and sees mode header
4. Knows immediately which mode is active

### Workflow 4: Mode Selection via UI

1. User clicks status bar item `🎯 Kiro: Vibe`
2. Quick pick menu opens showing both modes
3. Current mode marked with ✓
4. Selects different mode
5. Status bar updates immediately
6. Notification confirms switch

## Key Visual Elements

### Icons

-   🎯 (Rocket) = Vibe Coding Mode
-   📋 (Notebook) = Spec Mode
-   ✓ (Checkmark) = Currently active
-   💡 (Light bulb) = Helpful tip/notice

### Color Coding (via VS Code themes)

-   Mode headers use markdown heading style (###)
-   Italic text for mode descriptions
-   Bold text for mode names
-   Horizontal rules (---) for visual separation

### Positioning

-   Status bar: Bottom left, always visible
-   Mode header: Top of each chat response
-   Mode selection prompt: Full chat panel width
-   Quick pick: Center of screen (VS Code standard)

## Accessibility

-   All mode indicators use both icons and text
-   Status bar item has descriptive tooltip
-   Quick pick shows full descriptions
-   Keyboard navigation supported throughout
-   Screen reader friendly with semantic markdown

## Consistency

-   Same icons used everywhere (🎯 for Vibe, 📋 for Spec)
-   Same descriptions across all UI elements
-   Consistent terminology ("Vibe Coding" vs "Spec")
-   Unified visual language throughout extension
