# Kiro Visual Design Reference

Quick reference guide for Kiro extension visual design elements.

## Color Swatches

```
Primary Purple:  ████ #8b5cf6
Primary Indigo:  ████ #6366f1
Accent Pink:     ████ #f472b6

Success Green:   ████ #10b981
Warning Amber:   ████ #f59e0b
Error Red:       ████ #ef4444
Info Blue:       ████ #3b82f6
```

## Icon Reference

### Mode Icons

```
🎯 Vibe Coding (rocket)
📋 Spec Mode (notebook)
```

### Progress Icons

```
✓ Completed (green)
⟳ In Progress (blue, spinning)
○ Pending (gray)
✗ Failed (red)
⏸ Waiting Approval (orange)
```

### Document Icons

```
📄 requirements.md (file-code)
🏗️ design.md (symbol-structure)
✅ tasks.md (checklist)
```

### Section Icons

```
📚 Specs (folder-library, purple)
🧭 Steering (compass, purple)
⚡ Hooks (zap, purple)
```

## Typography Examples

### Headers

```markdown
### 🎯 Vibe Coding Mode

### 📋 Spec Mode

### ⚙️ Workflow Progress
```

### Mode Badges

```markdown
**🎯 Vibe Coding** (active)
🎯 Vibe Coding (inactive)

**📋 Spec** (active)
📋 Spec (inactive)
```

### Progress Steps

```markdown
✓ 1/5: Requirements (completed)
⟳ 2/5: Design (in progress)
○ 3/5: Tasks (pending)
```

### Lists

```markdown
✓ Rapid exploration and testing
✓ Building when requirements are unclear
✓ Implementing a task
```

### Callouts

```markdown
💡 _Info: Your chat history has been preserved._
⚠️ _Warning: This action cannot be undone._
✓ _Success: Task completed successfully!_
❌ _Error: Failed to load file._
```

## Component Styling

### Mode Selector Button

```
┌─────────────────────────────┐
│ 🎯 Vibe Coding              │ ← Purple gradient when selected
│ Chat first, then build...   │   White text on purple
│                             │   Box shadow with purple tint
└─────────────────────────────┘
```

### Tree View Item

```
📚 SPECS                        ← Purple icon
  📁 my-feature                 ← Blue icon
    📄 requirements.md          ← File icon
    📄 design.md                ← File icon
    ⚠️ tasks.md (not created)   ← Warning icon
```

### Progress Indicator

```
### ⚙️ Workflow Progress

✓ 1. Requirements
✓ 2. Steering Setup
⟳ 3. Design (in progress...)
○ 4. Create Tasks
○ 5. Execute Tasks
```

## Hover States

### Button Hover

```
Normal:   border: 2px solid #e5e7eb
Hover:    border: 2px solid #8b5cf6
          transform: translateY(-2px)
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.15)
```

### Tree Item Hover

```
Normal:   background: transparent
Hover:    background: var(--vscode-list-hoverBackground)
```

## Theme Variations

### Light Theme

```
Background: #ffffff
Text:       #1f2937
Border:     #e5e7eb
Hover:      #f3f4f6
```

### Dark Theme

```
Background: #1e1e1e
Text:       #f9fafb
Border:     #3e3e3e
Hover:      #2a2a2a
```

## Code Examples

### Import Theme Utilities

```typescript
import {
    KiroColors,
    KiroIcons,
    getModeIcon,
    getProgressIcon,
    getDocumentIcon,
    createThemedIcon,
    KiroMarkdownFormatter,
} from "../styles/kiroTheme";
```

### Create Mode Icon

```typescript
// Selected mode (purple highlight)
const icon = getModeIcon("vibe", true);

// Unselected mode
const icon = getModeIcon("spec", false);
```

### Format Markdown

```typescript
// Header with icon
stream.markdown(KiroMarkdownFormatter.header("Title", "🎯"));

// Mode badge
stream.markdown(KiroMarkdownFormatter.modeBadge("vibe", true));

// Progress step
stream.markdown(KiroMarkdownFormatter.progress(2, 5, "Design", "in-progress"));

// List item
stream.markdown(KiroMarkdownFormatter.listItem("Feature", "✓"));

// Callout
stream.markdown(KiroMarkdownFormatter.callout("Message", "info"));

// Divider
stream.markdown(KiroMarkdownFormatter.divider());
```

### Create Themed Icon

```typescript
// Icon without color
const icon = createThemedIcon("folder");

// Icon with purple color
const icon = createThemedIcon("folder-library", "charts.purple");

// Icon with semantic color
const icon = createThemedIcon("error", "testing.iconFailed");
```

## Accessibility

### Color Contrast Ratios

-   Text on background: 4.5:1 minimum (WCAG AA)
-   Large text: 3:1 minimum
-   Interactive elements: Clear focus indicators

### Icon + Text

Always pair icons with text labels:

```markdown
✓ Completed (not just ✓)
🎯 Vibe Coding (not just 🎯)
```

### Keyboard Navigation

-   All interactive elements are keyboard accessible
-   Tab navigation supported
-   Enter/Space for activation
-   Arrow keys for tree navigation

## Best Practices

1. **Always use theme utilities** - Don't hardcode colors or icons
2. **Pair icons with text** - Never rely on icons alone
3. **Test both themes** - Verify light and dark theme compatibility
4. **Use semantic colors** - Success=green, Error=red, etc.
5. **Consistent spacing** - Use standard markdown spacing
6. **Smooth transitions** - 200ms ease for all animations
7. **Purple for brand** - Use purple for Kiro-specific elements

## Quick Copy-Paste

### Mode Selection Prompt

```typescript
stream.markdown(KiroMarkdownFormatter.header("Let's build", "🚀"));
stream.markdown("Plan, search, or build anything\n\n");
stream.markdown(KiroMarkdownFormatter.divider());
```

### Success Message

```typescript
stream.markdown(
    KiroMarkdownFormatter.callout("Task completed successfully!", "success")
);
```

### Progress Display

```typescript
stream.markdown(KiroMarkdownFormatter.header("Workflow Progress", "⚙️"));
stream.markdown(
    KiroMarkdownFormatter.progress(1, 3, "Requirements", "completed")
);
stream.markdown(KiroMarkdownFormatter.progress(2, 3, "Design", "in-progress"));
stream.markdown(KiroMarkdownFormatter.progress(3, 3, "Tasks", "pending"));
```

### Feature List

```typescript
stream.markdown("Great for:\n");
stream.markdown(KiroMarkdownFormatter.listItem("Rapid exploration", "✓"));
stream.markdown(KiroMarkdownFormatter.listItem("Unclear requirements", "✓"));
stream.markdown(KiroMarkdownFormatter.listItem("Quick iteration", "✓"));
```
