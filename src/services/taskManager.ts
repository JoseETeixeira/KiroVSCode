import * as vscode from "vscode";
import * as path from "path";
import { FileService } from "./fileService";

export interface Task {
    number: number;
    description: string;
    completed: boolean;
    optional: boolean;
    requirements: string[];
    lineNumber: number;
    indentLevel: number;
    parentTask?: number;
}

export interface TaskContext {
    specName: string;
    task: Task;
    filePath: string;
    allTasks: Task[];
}

/**
 * Manages task parsing, tracking, and checkbox updates in tasks.md files
 * Handles hierarchical tasks with parent-child relationships
 */
export class TaskManager {
    constructor(private fileService: FileService) {}

    /**
     * Parse tasks from a tasks.md file
     */
    async parseTasks(filePath: string): Promise<Task[]> {
        const content = await this.fileService.readFile(filePath);
        const lines = content.split("\n");
        const tasks: Task[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Match task pattern: - [ ] or - [x] followed by optional * and task number
            // Supports: "- [ ] 1. Task" or "- [ ]* 1.1 Task" (optional)
            const match = line.match(
                /^(\s*)- \[([ x])\](\*)?\s+(\d+(?:\.\d+)?)\.\s+(.+)$/
            );

            if (match) {
                const [
                    ,
                    indent,
                    checked,
                    optionalMarker,
                    taskNum,
                    description,
                ] = match;
                const indentLevel = indent.length / 2; // Assuming 2 spaces per indent level
                const isOptional = optionalMarker === "*";

                // Extract requirements if present
                const reqMatch = description.match(
                    /_Requirements?:\s*([\d., ]+)_/
                );
                const requirements = reqMatch
                    ? reqMatch[1].split(",").map((s) => s.trim())
                    : [];

                // Determine parent task for sub-tasks (e.g., 2.1 -> parent is 2)
                let parentTask: number | undefined;
                if (taskNum.includes(".")) {
                    const parentNum = parseInt(taskNum.split(".")[0]);
                    parentTask = parentNum;
                }

                tasks.push({
                    number: parseFloat(taskNum),
                    description: description.trim(),
                    completed: checked === "x",
                    optional: isOptional,
                    requirements,
                    lineNumber: i,
                    indentLevel,
                    parentTask,
                });
            }
        }

        return tasks;
    }

    /**
     * Find a specific task by number
     */
    async findTask(filePath: string, taskNumber: number): Promise<Task | null> {
        const tasks = await this.parseTasks(filePath);
        return tasks.find((t) => t.number === taskNumber) || null;
    }

    /**
     * Get all sub-tasks for a parent task
     */
    async getSubTasks(
        filePath: string,
        parentTaskNumber: number
    ): Promise<Task[]> {
        const tasks = await this.parseTasks(filePath);
        return tasks.filter((t) => t.parentTask === parentTaskNumber);
    }

    /**
     * Mark a task as complete
     */
    async markTaskComplete(
        filePath: string,
        taskNumber: number
    ): Promise<void> {
        const content = await this.fileService.readFile(filePath);
        const lines = content.split("\n");
        let updated = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Match the task with the specific number
            const match = line.match(
                /^(\s*)- \[ \](\*)?\s+(\d+(?:\.\d+)?)\.\s+(.+)$/
            );

            if (match) {
                const [, indent, optionalMarker, taskNum] = match;

                if (parseFloat(taskNum) === taskNumber) {
                    // Replace [ ] with [x]
                    const optional = optionalMarker || "";
                    lines[i] = line.replace(
                        /^(\s*)- \[ \](\*)?/,
                        `${indent}- [x]${optional}`
                    );
                    updated = true;
                    break;
                }
            }
        }

        if (updated) {
            await this.fileService.writeFile(filePath, lines.join("\n"));
            console.log(`Marked task ${taskNumber} as complete in ${filePath}`);
        } else {
            console.warn(
                `Task ${taskNumber} not found or already completed in ${filePath}`
            );
        }
    }

    /**
     * Mark a task as incomplete
     */
    async markTaskIncomplete(
        filePath: string,
        taskNumber: number
    ): Promise<void> {
        const content = await this.fileService.readFile(filePath);
        const lines = content.split("\n");
        let updated = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Match the task with the specific number
            const match = line.match(
                /^(\s*)- \[x\](\*)?\s+(\d+(?:\.\d+)?)\.\s+(.+)$/
            );

            if (match) {
                const [, indent, optionalMarker, taskNum] = match;

                if (parseFloat(taskNum) === taskNumber) {
                    // Replace [x] with [ ]
                    const optional = optionalMarker || "";
                    lines[i] = line.replace(
                        /^(\s*)- \[x\](\*)?/,
                        `${indent}- [ ]${optional}`
                    );
                    updated = true;
                    break;
                }
            }
        }

        if (updated) {
            await this.fileService.writeFile(filePath, lines.join("\n"));
            console.log(
                `Marked task ${taskNumber} as incomplete in ${filePath}`
            );
        } else {
            console.warn(
                `Task ${taskNumber} not found or already incomplete in ${filePath}`
            );
        }
    }

    /**
     * Get task completion statistics
     */
    async getTaskStats(filePath: string): Promise<{
        total: number;
        completed: number;
        optional: number;
        required: number;
        percentComplete: number;
    }> {
        const tasks = await this.parseTasks(filePath);

        const total = tasks.length;
        const completed = tasks.filter((t) => t.completed).length;
        const optional = tasks.filter((t) => t.optional).length;
        const required = tasks.filter((t) => !t.optional).length;
        const percentComplete =
            total > 0 ? Math.round((completed / total) * 100) : 0;

        return {
            total,
            completed,
            optional,
            required,
            percentComplete,
        };
    }

    /**
     * Get next incomplete task
     */
    async getNextTask(filePath: string): Promise<Task | null> {
        const tasks = await this.parseTasks(filePath);

        // Find first incomplete required task
        const nextRequired = tasks.find((t) => !t.completed && !t.optional);
        if (nextRequired) {
            return nextRequired;
        }

        // If no required tasks, find first incomplete optional task
        return tasks.find((t) => !t.completed && t.optional) || null;
    }

    /**
     * Extract spec name from tasks.md file path
     */
    getSpecNameFromPath(filePath: string): string | null {
        const relativePath = this.fileService.getRelativePath(filePath);

        // Match pattern: .kiro/specs/<spec-name>/tasks.md
        const match = relativePath.match(
            /\.kiro[\/\\]specs[\/\\]([^\/\\]+)[\/\\]tasks\.md$/
        );

        return match ? match[1] : null;
    }

    /**
     * Get task context for execution
     */
    async getTaskContext(
        filePath: string,
        taskNumber: number
    ): Promise<TaskContext | null> {
        const specName = this.getSpecNameFromPath(filePath);

        if (!specName) {
            return null;
        }

        const allTasks = await this.parseTasks(filePath);
        const task = allTasks.find((t) => t.number === taskNumber);

        if (!task) {
            return null;
        }

        return {
            specName,
            task,
            filePath,
            allTasks,
        };
    }

    /**
     * Find all tasks.md files in workspace
     */
    async findAllTaskFiles(): Promise<string[]> {
        const workspaceRoot = this.fileService.getWorkspaceRoot();
        return await this.fileService.findFiles(workspaceRoot, /tasks\.md$/, 5);
    }

    /**
     * Check if a file is a tasks.md file
     */
    isTaskFile(filePath: string): boolean {
        return path.basename(filePath) === "tasks.md";
    }

    /**
     * Get task at line number
     */
    async getTaskAtLine(
        filePath: string,
        lineNumber: number
    ): Promise<Task | null> {
        const tasks = await this.parseTasks(filePath);
        return tasks.find((t) => t.lineNumber === lineNumber) || null;
    }

    /**
     * Update task description
     */
    async updateTaskDescription(
        filePath: string,
        taskNumber: number,
        newDescription: string
    ): Promise<void> {
        const content = await this.fileService.readFile(filePath);
        const lines = content.split("\n");
        let updated = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Match the task with the specific number
            const match = line.match(
                /^(\s*)- \[([ x])\](\*)?\s+(\d+(?:\.\d+)?)\.\s+(.+)$/
            );

            if (match) {
                const [
                    ,
                    indent,
                    checked,
                    optionalMarker,
                    taskNum,
                    oldDescription,
                ] = match;

                if (parseFloat(taskNum) === taskNumber) {
                    // Extract requirements from old description
                    const reqMatch = oldDescription.match(
                        /(_Requirements?:\s*[\d., ]+_)/
                    );
                    const requirements = reqMatch ? ` ${reqMatch[1]}` : "";

                    // Build new line
                    const optional = optionalMarker || "";
                    lines[
                        i
                    ] = `${indent}- [${checked}]${optional} ${taskNum}. ${newDescription}${requirements}`;
                    updated = true;
                    break;
                }
            }
        }

        if (updated) {
            await this.fileService.writeFile(filePath, lines.join("\n"));
            console.log(
                `Updated description for task ${taskNumber} in ${filePath}`
            );
        } else {
            console.warn(`Task ${taskNumber} not found in ${filePath}`);
        }
    }
}
