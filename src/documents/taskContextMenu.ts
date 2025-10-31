import * as vscode from "vscode";
import { TaskManager } from "../services/taskManager";

/**
 * CodeAction provider for task context menu in tasks.md files
 * Provides "Execute Task with Kiro" or "Review Task" actions based on completion status
 */
export class TaskContextMenuProvider implements vscode.CodeActionProvider {
    constructor(private taskManager: TaskManager) {}

    /**
     * Provide code actions for task lines in tasks.md files
     */
    async provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        _context: vscode.CodeActionContext,
        _token: vscode.CancellationToken
    ): Promise<vscode.CodeAction[]> {
        // Only provide actions for tasks.md files
        if (!this.taskManager.isTaskFile(document.uri.fsPath)) {
            return [];
        }

        // Get the line at the cursor position
        const line = document.lineAt(range.start.line);
        const lineText = line.text;

        // Detect task lines with regex: ^- \[([ x])\] (\d+)\. (.+)$
        // Supports both "- [ ] 1. Task" and "- [ ]* 1.1 Task" (optional)
        const taskMatch = lineText.match(
            /^(\s*)- \[([ x])\](\*)?\s+(\d+(?:\.\d+)?)\.\s+(.+)$/
        );

        if (!taskMatch) {
            return [];
        }

        const [, , checked, , taskNum, description] = taskMatch;
        const isComplete = checked === "x";
        const taskNumber = parseFloat(taskNum);

        // Get task details
        const task = await this.taskManager.getTaskAtLine(
            document.uri.fsPath,
            range.start.line
        );

        if (!task) {
            return [];
        }

        // Extract task context
        const taskContext = {
            taskNumber,
            description: description.trim(),
            filePath: document.uri.fsPath,
            lineNumber: range.start.line,
            isComplete,
            task,
        };

        // Create appropriate action based on completion status
        const actions: vscode.CodeAction[] = [];

        if (isComplete) {
            // For completed tasks, offer "Review Task"
            const reviewAction = new vscode.CodeAction(
                "Review Task with Kiro",
                vscode.CodeActionKind.QuickFix
            );
            reviewAction.command = {
                command: "kiro-copilot.executeTask",
                title: "Review Task with Kiro",
                arguments: [taskContext],
            };
            reviewAction.isPreferred = true;
            actions.push(reviewAction);
        } else {
            // For incomplete tasks, offer "Execute Task"
            const executeAction = new vscode.CodeAction(
                "Execute Task with Kiro",
                vscode.CodeActionKind.QuickFix
            );
            executeAction.command = {
                command: "kiro-copilot.executeTask",
                title: "Execute Task with Kiro",
                arguments: [taskContext],
            };
            executeAction.isPreferred = true;
            actions.push(executeAction);
        }

        return actions;
    }
}
