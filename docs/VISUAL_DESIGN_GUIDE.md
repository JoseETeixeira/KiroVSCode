# Kiro Visual Design Guide

This document describes the visual design system for the Kiro extension, ensuring consistent styling across all UI components.

## Color Palette

### Primary Colors

-   **Primary Purple**: `#8b5cf6` - Main brand color, used for highlights and selected states
-   **Primary Indigo**: `#6366f1` - Gradient start color
-   **Accent Pink**: `#f472b6` - Accent color for special elements

### Status Colors

-   **Success**: `#10b981` (Green) - Completed tasks, success messages
-   **Warning**: `#f59e0b` (Amber) - Warnings, missing files
-   **Error**: `#ef4444` (Red) - Errors, failed operations
-   **Info**: `#3b82f6` (Blue) - Informational messages

### Theme-Adaptive Colors

The extension automatically adapts to VS Code's light and dark themes:

-   **Light Theme**: Dark text on light background
-   **Dark Theme**: Light text on dark background

## Iconography

### Mode Icons

-   **Vibe Mode**: 🎯 Rocket icon (`rocket`) - Represents rapid exploration
-   **Spec Mode**: 📋 Notebook icon (`notebook`) - Represents structured planning

### Progress Icons

-   **Completed**: ✓ (`check`) - Green color
-   **In Progress**: ⟳ (`sync~spin`) - Blue color, animated
-   **Pending**: ○ (`circle-outline`) - Gray color
-   **Failed**: ✗ (`error`) - Red color
-   **Waiting Approval**: ⏸ (`debug-pause`) - Orange color

### Document Icons

-   **Requirements**: `file-code` - Code file icon
-   **Design**: `symbol-structure` - Structure icon
-   **Tasks**: `checklist` - Checklist icon

### Section Icons

-   **Specs**: `folder-library` - Library folder icon (purple)
-   **Steering**: `compass` - Compass icon (purple)
-   **Hooks**: `zap` - Lightning bolt icon (purple)

## Typography

### Headers

Use the `KiroMarkdownFormatter.header()` method for consistent headers:

```typescript
stream.markdown(KiroMarkdownFormatter.header("Title", "🎯"));
// Output: ### 🎯 Title
```

### Mode Badges

Display mode badges with proper styling:

```typescript
stream.markdown(KiroMarkdownFormatter.modeBadge("vibe", true));
// Output: **🎯 Vibe Coding** (bold when active)
```

### Progress Indicators

Format progress steps consistently:

```typescript
stream.markdown(KiroMarkdownFormatter.progress(2, 5, "Design", "in-progress"));
// Output: ⟳ 2/5: Design
```

## UI Components

### Mode Selector

The mode selector uses a card-based layout with:

-   Purple gradient background for selected mode
-   Hover effects with subtle elevation
-   Clear visual distinction between modes
-   Emoji icons for quick recognition

### Tree Views

Tree views use:

-   Colored icons based on item type
-   Purple theme color for section headers
-   Warning colors for missing files
-   Consistent spacing and indentation

### Progress Display

Progress indicators show:

-   Workflow name as header with gear icon
-   Step list with status icons
-   Current step highlighted
-   Optional expandable details section

## Hover Effects

All interactive elements include hover effects:

-   Subtle background color change
-   Border color change to purple
-   Slight elevation (2px translateY)
-   Box shadow with purple tint

## Transitions

Use smooth transitions for all interactive elements:

-   Duration: 200ms
-   Easing: ease
-   Properties: all (background, border, transform, box-shadow)

## Markdown Formatting

### Callouts

Use callouts for important messages:

```typescript
stream.markdown(KiroMarkdownFormatter.callout("Important message", "info"));
// Types: info, warning, success, error
```

### Code Blocks

Format code consistently:

```typescript
stream.markdown(KiroMarkdownFormatter.code("const x = 1;", "typescript"));
stream.markdown(KiroMarkdownFormatter.inlineCode("variable"));
```

### Lists

Use consistent list formatting:

```typescript
stream.markdown(KiroMarkdownFormatter.listItem("Item text", "✓"));
```

### Dividers

Add visual separation:

```typescript
stream.markdown(KiroMarkdownFormatter.divider());
// Output: ---
```

## Accessibility

### Color Contrast

All color combinations meet WCAG AA standards:

-   Text on background: minimum 4.5:1 ratio
-   Large text: minimum 3:1 ratio
-   Interactive elements: clear focus indicators

### Icon Semantics

Icons are paired with text labels for clarity:

-   Never rely on color alone
-   Provide text alternatives
-   Use consistent icon meanings

### Keyboard Navigation

All interactive elements support:

-   Tab navigation
-   Enter/Space activation
-   Arrow key navigation in lists

## Theme Compatibility

### Light Theme

-   Dark text (#1f2937) on light background (#ffffff)
-   Subtle borders (#e5e7eb)
-   Light hover states (#f3f4f6)

### Dark Theme

-   Light text (#f9fafb) on dark background (#1e1e1e)
-   Visible borders (#3e3e3e)
-   Dark hover states (#2a2a2a)

### High Contrast

The extension respects VS Code's high contrast themes:

-   Increased border visibility
-   Enhanced color contrast
-   Clear focus indicators

## Usage Examples

### Chat Mode Display

```typescript
const mode = this.modeManager.getCurrentMode();
stream.markdown(KiroMarkdownFormatter.header(`${modeName} Mode`, modeIcon));
stream.markdown(`*${this.modeManager.getModeDescription(mode)}*\n\n`);
stream.markdown(KiroMarkdownFormatter.divider());
```

### Progress Update

```typescript
stream.markdown(KiroMarkdownFormatter.header("Workflow Progress", "⚙️"));
for (let i = 0; i < steps.length; i++) {
    const status =
        i < currentStep
            ? "completed"
            : i === currentStep
            ? "in-progress"
            : "pending";
    stream.markdown(
        KiroMarkdownFormatter.progress(
            i + 1,
            steps.length,
            steps[i].name,
            status
        )
    );
}
```

### Success Message

```typescript
stream.markdown(
    KiroMarkdownFormatter.callout("Task completed successfully!", "success")
);
```

## Best Practices

1. **Consistency**: Always use the `KiroMarkdownFormatter` and theme utilities
2. **Clarity**: Pair icons with text labels
3. **Feedback**: Provide visual feedback for all interactions
4. **Accessibility**: Ensure all UI is keyboard navigable
5. **Theme Awareness**: Test with both light and dark themes
6. **Performance**: Use CSS transitions, not JavaScript animations
7. **Simplicity**: Keep UI clean and uncluttered

## Testing Checklist

-   [ ] Test with light theme
-   [ ] Test with dark theme
-   [ ] Test with high contrast theme
-   [ ] Verify all icons are visible
-   [ ] Check hover effects work
-   [ ] Verify keyboard navigation
-   [ ] Test with screen reader
-   [ ] Check color contrast ratios
-   [ ] Verify responsive layout
-   [ ] Test all interactive elements

## Resources

-   **Icon Library**: VS Code Codicons (https://microsoft.github.io/vscode-codicons/dist/codicon.html)
-   **Color Palette**: Tailwind CSS colors (https://tailwindcss.com/docs/customizing-colors)
-   **Design Inspiration**: GitHub Copilot Chat, Kiro IDE

## Maintenance

When adding new UI components:

1. Use existing theme utilities
2. Follow established patterns
3. Add to this guide
4. Test with all themes
5. Update examples
