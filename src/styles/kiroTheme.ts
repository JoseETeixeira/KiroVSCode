/**
 * Kiro Visual Design System
 * Defines colors, icons, and styling constants for consistent UI
 */

import * as vscode from "vscode";

/**
 * Kiro brand colors
 */
export const KiroColors = {
    // Primary purple gradient (from kiro-icon.svg)
    primaryStart: "#6366f1", // Indigo
    primaryEnd: "#8b5cf6", // Purple
    primary: "#8b5cf6", // Main purple for highlights

    // Accent colors
    accent: "#f472b6", // Pink accent (from icon dot)

    // Status colors
    success: "#10b981", // Green
    warning: "#f59e0b", // Amber
    error: "#ef4444", // Red
    info: "#3b82f6", // Blue

    // Neutral colors (adapt to theme)
    text: {
        light: "#1f2937",
        dark: "#f9fafb",
    },
    background: {
        light: "#ffffff",
        dark: "#1e1e1e",
    },
} as const;

/**
 * Kiro iconography - consistent icons across all components
 */
export const KiroIcons = {
    // Mode icons
    vibe: "rocket",
    spec: "notebook",

    // Progress/status icons
    completed: "check",
    inProgress: "sync~spin",
    pending: "circle-outline",
    failed: "error",
    waitingApproval: "debug-pause",

    // Document icons
    requirements: "file-code",
    design: "symbol-structure",
    tasks: "checklist",

    // Section icons
    specs: "folder-library",
    steering: "compass",
    hooks: "zap",

    // Action icons
    create: "add",
    edit: "edit",
    delete: "trash",
    refresh: "refresh",
    navigate: "arrow-right",
    update: "sync",
} as const;

/**
 * Get themed color based on current VS Code theme
 */
export function getThemedColor(
    lightColor: string,
    darkColor: string
): vscode.ThemeColor {
    return new vscode.ThemeColor(
        vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light ||
        vscode.window.activeColorTheme.kind ===
            vscode.ColorThemeKind.HighContrastLight
            ? lightColor
            : darkColor
    );
}

/**
 * Create a themed icon with Kiro styling
 */
export function createThemedIcon(
    iconId: string,
    color?: string
): vscode.ThemeIcon {
    if (color) {
        return new vscode.ThemeIcon(iconId, new vscode.ThemeColor(color));
    }
    return new vscode.ThemeIcon(iconId);
}

/**
 * Create a Kiro-styled icon for mode selection
 */
export function getModeIcon(
    mode: "vibe" | "spec",
    isSelected: boolean = false
): vscode.ThemeIcon {
    const iconId = mode === "vibe" ? KiroIcons.vibe : KiroIcons.spec;

    if (isSelected) {
        // Use purple color for selected mode
        return new vscode.ThemeIcon(
            iconId,
            new vscode.ThemeColor("charts.purple")
        );
    }

    return new vscode.ThemeIcon(iconId);
}

/**
 * Create a progress status icon
 */
export function getProgressIcon(
    status:
        | "completed"
        | "in-progress"
        | "pending"
        | "failed"
        | "waiting-approval"
): vscode.ThemeIcon {
    const iconMap = {
        completed: KiroIcons.completed,
        "in-progress": KiroIcons.inProgress,
        pending: KiroIcons.pending,
        failed: KiroIcons.failed,
        "waiting-approval": KiroIcons.waitingApproval,
    };

    const colorMap = {
        completed: "testing.iconPassed",
        "in-progress": "charts.blue",
        pending: "editorLineNumber.foreground",
        failed: "testing.iconFailed",
        "waiting-approval": "charts.orange",
    };

    return new vscode.ThemeIcon(
        iconMap[status],
        new vscode.ThemeColor(colorMap[status])
    );
}

/**
 * Create a document icon with appropriate styling
 */
export function getDocumentIcon(
    stage: "requirements" | "design" | "tasks",
    exists: boolean
): vscode.ThemeIcon {
    const iconMap = {
        requirements: KiroIcons.requirements,
        design: KiroIcons.design,
        tasks: KiroIcons.tasks,
    };

    if (!exists) {
        return new vscode.ThemeIcon(
            "file-add",
            new vscode.ThemeColor("editorWarning.foreground")
        );
    }

    return new vscode.ThemeIcon(iconMap[stage]);
}

/**
 * Format markdown with Kiro styling
 */
export class KiroMarkdownFormatter {
    /**
     * Format a header with icon
     */
    static header(text: string, icon?: string): string {
        return icon ? `### ${icon} ${text}\n\n` : `### ${text}\n\n`;
    }

    /**
     * Format a mode badge
     */
    static modeBadge(mode: "vibe" | "spec", isActive: boolean = false): string {
        const icon = mode === "vibe" ? "🎯" : "📋";
        const name = mode === "vibe" ? "Vibe Coding" : "Spec";
        const badge = isActive ? `**${icon} ${name}**` : `${icon} ${name}`;
        return badge;
    }

    /**
     * Format a progress indicator
     */
    static progress(
        current: number,
        total: number,
        stepName: string,
        status: "completed" | "in-progress" | "pending" = "pending"
    ): string {
        const icons = {
            completed: "✓",
            "in-progress": "⟳",
            pending: "○",
        };

        const icon = icons[status];
        return `${icon} ${current}/${total}: ${stepName}`;
    }

    /**
     * Format a list item with icon
     */
    static listItem(text: string, icon: string = "•"): string {
        return `${icon} ${text}\n`;
    }

    /**
     * Format a divider
     */
    static divider(): string {
        return "---\n\n";
    }

    /**
     * Format a code block
     */
    static code(code: string, language: string = ""): string {
        return `\`\`\`${language}\n${code}\n\`\`\`\n\n`;
    }

    /**
     * Format an inline code snippet
     */
    static inlineCode(code: string): string {
        return `\`${code}\``;
    }

    /**
     * Format a callout/note
     */
    static callout(
        text: string,
        type: "info" | "warning" | "success" | "error" = "info"
    ): string {
        const icons = {
            info: "💡",
            warning: "⚠️",
            success: "✓",
            error: "❌",
        };

        return `${icons[type]} *${text}*\n\n`;
    }
}

/**
 * CSS-like styling for webviews
 */
export function getWebviewStyles(isDark: boolean): string {
    const colors = isDark
        ? {
              background: KiroColors.background.dark,
              text: KiroColors.text.dark,
              border: "#3e3e3e",
              hover: "#2a2a2a",
          }
        : {
              background: KiroColors.background.light,
              text: KiroColors.text.light,
              border: "#e5e7eb",
              hover: "#f3f4f6",
          };

    return `
        :root {
            --kiro-primary: ${KiroColors.primary};
            --kiro-accent: ${KiroColors.accent};
            --kiro-success: ${KiroColors.success};
            --kiro-warning: ${KiroColors.warning};
            --kiro-error: ${KiroColors.error};
            --kiro-background: ${colors.background};
            --kiro-text: ${colors.text};
            --kiro-border: ${colors.border};
            --kiro-hover: ${colors.hover};
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--kiro-text);
            background-color: var(--kiro-background);
            padding: 20px;
            line-height: 1.6;
        }

        .mode-selector {
            display: flex;
            gap: 16px;
            margin: 20px 0;
        }

        .mode-button {
            flex: 1;
            padding: 20px;
            border: 2px solid var(--kiro-border);
            border-radius: 8px;
            background: var(--kiro-background);
            cursor: pointer;
            transition: all 0.2s ease;
            text-align: left;
        }

        .mode-button:hover {
            background: var(--kiro-hover);
            border-color: var(--kiro-primary);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(139, 92, 246, 0.15);
        }

        .mode-button.selected {
            background: linear-gradient(135deg, ${KiroColors.primaryStart}, ${KiroColors.primaryEnd});
            border-color: var(--kiro-primary);
            color: white;
            box-shadow: 0 4px 16px rgba(139, 92, 246, 0.3);
        }

        .mode-button.selected h3,
        .mode-button.selected p {
            color: white;
        }

        .mode-button h3 {
            margin: 0 0 8px 0;
            font-size: 18px;
            font-weight: 600;
        }

        .mode-button p {
            margin: 0;
            font-size: 14px;
            opacity: 0.9;
        }

        .mode-icon {
            font-size: 24px;
            margin-bottom: 8px;
        }

        .progress-indicator {
            margin: 16px 0;
            padding: 16px;
            border-left: 3px solid var(--kiro-primary);
            background: var(--kiro-hover);
            border-radius: 4px;
        }

        .progress-step {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 8px 0;
            font-size: 14px;
        }

        .progress-step.completed {
            color: var(--kiro-success);
        }

        .progress-step.in-progress {
            color: var(--kiro-primary);
            font-weight: 600;
        }

        .progress-step.pending {
            opacity: 0.6;
        }

        .icon {
            display: inline-block;
            width: 16px;
            text-align: center;
        }

        .divider {
            border: none;
            border-top: 1px solid var(--kiro-border);
            margin: 24px 0;
        }

        .callout {
            padding: 12px 16px;
            border-radius: 6px;
            margin: 16px 0;
            border-left: 3px solid;
        }

        .callout.info {
            background: rgba(59, 130, 246, 0.1);
            border-color: var(--kiro-info);
        }

        .callout.success {
            background: rgba(16, 185, 129, 0.1);
            border-color: var(--kiro-success);
        }

        .callout.warning {
            background: rgba(245, 158, 11, 0.1);
            border-color: var(--kiro-warning);
        }

        .callout.error {
            background: rgba(239, 68, 68, 0.1);
            border-color: var(--kiro-error);
        }
    `;
}
