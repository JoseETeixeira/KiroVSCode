import * as vscode from "vscode";
import { CodingMode } from "./modeManager";
import type { WorkflowContext } from "../workflows/workflowOrchestrator";

/**
 * Represents a chat session with workflow state
 */
export interface ChatSession {
    id: string;
    mode: CodingMode;
    workflowName?: string;
    workflowContext?: WorkflowContext;
    currentStep?: number;
    totalSteps?: number;
    specName?: string;
    startedAt: Date;
    lastActivity: Date;
    isActive: boolean;
    conversationHistory: ChatMessage[];
}

/**
 * Represents a message in the chat conversation
 */
export interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: Date;
}

/**
 * Session storage data structure
 */
interface SessionStorageData {
    sessions: Record<string, SerializedChatSession>;
    activeSessionId?: string;
}

/**
 * Serialized session for storage (dates as strings)
 */
interface SerializedChatSession {
    id: string;
    mode: CodingMode;
    workflowName?: string;
    workflowContext?: {
        mode: CodingMode;
        specName?: string;
        command?: string;
        userInput?: string;
        stepData: Array<[string, unknown]>;
    };
    currentStep?: number;
    totalSteps?: number;
    specName?: string;
    startedAt: string;
    lastActivity: string;
    isActive: boolean;
    conversationHistory: Array<{
        role: "user" | "assistant" | "system";
        content: string;
        timestamp: string;
    }>;
}

/**
 * Manages chat sessions with workflow state tracking
 * Handles session persistence, restoration, and cleanup
 */
export class ChatSessionManager {
    private static readonly STORAGE_KEY = "kiro.chatSessions";
    private static readonly MAX_SESSIONS = 10;
    private static readonly SESSION_TIMEOUT_HOURS = 24;

    private sessions: Map<string, ChatSession> = new Map();
    private activeSessionId?: string;

    constructor(private context: vscode.ExtensionContext) {
        this.loadSessions();
    }

    /**
     * Create a new chat session
     */
    createSession(mode: CodingMode, specName?: string): ChatSession {
        const session: ChatSession = {
            id: this.generateSessionId(),
            mode,
            specName,
            startedAt: new Date(),
            lastActivity: new Date(),
            isActive: true,
            conversationHistory: [],
        };

        this.sessions.set(session.id, session);
        this.activeSessionId = session.id;

        console.log(`[ChatSessionManager] Created session: ${session.id}`);
        this.persistSessions();

        return session;
    }

    /**
     * Get active session or create a new one
     */
    getOrCreateActiveSession(mode: CodingMode, specName?: string): ChatSession {
        if (this.activeSessionId) {
            const session = this.sessions.get(this.activeSessionId);
            if (session && session.isActive) {
                // Update last activity
                session.lastActivity = new Date();
                this.persistSessions();
                return session;
            }
        }

        // Create new session
        return this.createSession(mode, specName);
    }

    /**
     * Get session by ID
     */
    getSession(sessionId: string): ChatSession | undefined {
        return this.sessions.get(sessionId);
    }

    /**
     * Get active session
     */
    getActiveSession(): ChatSession | undefined {
        if (!this.activeSessionId) {
            return undefined;
        }
        return this.sessions.get(this.activeSessionId);
    }

    /**
     * Set active session
     */
    setActiveSession(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return false;
        }

        this.activeSessionId = sessionId;
        session.isActive = true;
        session.lastActivity = new Date();

        // Deactivate other sessions
        for (const [id, s] of this.sessions) {
            if (id !== sessionId) {
                s.isActive = false;
            }
        }

        console.log(`[ChatSessionManager] Set active session: ${sessionId}`);
        this.persistSessions();

        return true;
    }

    /**
     * Update session workflow state
     */
    updateSessionWorkflow(
        sessionId: string,
        workflowName: string,
        workflowContext: WorkflowContext,
        currentStep: number,
        totalSteps: number
    ): void {
        const session = this.sessions.get(sessionId);
        if (!session) {
            console.warn(
                `[ChatSessionManager] Session not found: ${sessionId}`
            );
            return;
        }

        session.workflowName = workflowName;
        session.workflowContext = workflowContext;
        session.currentStep = currentStep;
        session.totalSteps = totalSteps;
        session.lastActivity = new Date();

        console.log(
            `[ChatSessionManager] Updated workflow for session ${sessionId}: ${workflowName} (${currentStep}/${totalSteps})`
        );
        this.persistSessions();
    }

    /**
     * Add message to session conversation history
     */
    addMessage(
        sessionId: string,
        role: "user" | "assistant" | "system",
        content: string
    ): void {
        const session = this.sessions.get(sessionId);
        if (!session) {
            console.warn(
                `[ChatSessionManager] Session not found: ${sessionId}`
            );
            return;
        }

        session.conversationHistory.push({
            role,
            content,
            timestamp: new Date(),
        });

        session.lastActivity = new Date();

        // Limit conversation history size (keep last 50 messages)
        if (session.conversationHistory.length > 50) {
            session.conversationHistory =
                session.conversationHistory.slice(-50);
        }

        this.persistSessions();
    }

    /**
     * Get conversation history for a session
     */
    getConversationHistory(sessionId: string): ChatMessage[] {
        const session = this.sessions.get(sessionId);
        return session?.conversationHistory || [];
    }

    /**
     * Complete a session (mark as inactive)
     */
    completeSession(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }

        session.isActive = false;
        session.workflowName = undefined;
        session.workflowContext = undefined;
        session.currentStep = undefined;
        session.totalSteps = undefined;

        console.log(`[ChatSessionManager] Completed session: ${sessionId}`);

        // If this was the active session, clear active session ID
        if (this.activeSessionId === sessionId) {
            this.activeSessionId = undefined;
        }

        this.persistSessions();
    }

    /**
     * Delete a session
     */
    deleteSession(sessionId: string): void {
        this.sessions.delete(sessionId);

        if (this.activeSessionId === sessionId) {
            this.activeSessionId = undefined;
        }

        console.log(`[ChatSessionManager] Deleted session: ${sessionId}`);
        this.persistSessions();
    }

    /**
     * Get all sessions
     */
    getAllSessions(): ChatSession[] {
        return Array.from(this.sessions.values());
    }

    /**
     * Get active sessions
     */
    getActiveSessions(): ChatSession[] {
        return Array.from(this.sessions.values()).filter((s) => s.isActive);
    }

    /**
     * Clean up old/completed sessions
     */
    cleanupSessions(): void {
        const now = new Date();
        const timeoutMs =
            ChatSessionManager.SESSION_TIMEOUT_HOURS * 60 * 60 * 1000;

        let deletedCount = 0;

        for (const [id, session] of this.sessions) {
            // Delete inactive sessions older than timeout
            if (
                !session.isActive &&
                now.getTime() - session.lastActivity.getTime() > timeoutMs
            ) {
                this.sessions.delete(id);
                deletedCount++;
            }
        }

        // If we have too many sessions, delete oldest inactive ones
        const inactiveSessions = Array.from(this.sessions.values())
            .filter((s) => !s.isActive)
            .sort(
                (a, b) => a.lastActivity.getTime() - b.lastActivity.getTime()
            );

        while (
            this.sessions.size > ChatSessionManager.MAX_SESSIONS &&
            inactiveSessions.length > 0
        ) {
            const oldest = inactiveSessions.shift();
            if (oldest) {
                this.sessions.delete(oldest.id);
                deletedCount++;
            }
        }

        if (deletedCount > 0) {
            console.log(
                `[ChatSessionManager] Cleaned up ${deletedCount} old sessions`
            );
            this.persistSessions();
        }
    }

    /**
     * Restore workflow state from a session
     */
    restoreWorkflowState(sessionId: string): {
        workflowName?: string;
        workflowContext?: WorkflowContext;
        currentStep?: number;
        totalSteps?: number;
    } | null {
        const session = this.sessions.get(sessionId);
        if (!session || !session.workflowName) {
            return null;
        }

        return {
            workflowName: session.workflowName,
            workflowContext: session.workflowContext,
            currentStep: session.currentStep,
            totalSteps: session.totalSteps,
        };
    }

    /**
     * Check if session has active workflow
     */
    hasActiveWorkflow(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        return !!(session && session.workflowName && session.isActive);
    }

    /**
     * Generate unique session ID
     */
    private generateSessionId(): string {
        return `session-${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 9)}`;
    }

    /**
     * Persist sessions to workspace state
     */
    private async persistSessions(): Promise<void> {
        try {
            const data: SessionStorageData = {
                sessions: {},
                activeSessionId: this.activeSessionId,
            };

            // Serialize sessions
            for (const [id, session] of this.sessions) {
                data.sessions[id] = this.serializeSession(session);
            }

            await this.context.workspaceState.update(
                ChatSessionManager.STORAGE_KEY,
                data
            );
        } catch (error) {
            console.error(
                "[ChatSessionManager] Failed to persist sessions:",
                error
            );
        }
    }

    /**
     * Load sessions from workspace state
     */
    private loadSessions(): void {
        try {
            const data = this.context.workspaceState.get<SessionStorageData>(
                ChatSessionManager.STORAGE_KEY
            );

            if (!data) {
                return;
            }

            // Deserialize sessions
            for (const [id, serialized] of Object.entries(data.sessions)) {
                const session = this.deserializeSession(serialized);
                this.sessions.set(id, session);
            }

            this.activeSessionId = data.activeSessionId;

            console.log(
                `[ChatSessionManager] Loaded ${this.sessions.size} sessions from storage`
            );

            // Clean up old sessions on load
            this.cleanupSessions();
        } catch (error) {
            console.error(
                "[ChatSessionManager] Failed to load sessions:",
                error
            );
        }
    }

    /**
     * Serialize session for storage
     */
    private serializeSession(session: ChatSession): SerializedChatSession {
        return {
            id: session.id,
            mode: session.mode,
            workflowName: session.workflowName,
            workflowContext: session.workflowContext
                ? {
                      mode: session.workflowContext.mode,
                      specName: session.workflowContext.specName,
                      command: session.workflowContext.command,
                      userInput: session.workflowContext.userInput,
                      stepData: Array.from(
                          session.workflowContext.stepData.entries()
                      ),
                  }
                : undefined,
            currentStep: session.currentStep,
            totalSteps: session.totalSteps,
            specName: session.specName,
            startedAt: session.startedAt.toISOString(),
            lastActivity: session.lastActivity.toISOString(),
            isActive: session.isActive,
            conversationHistory: session.conversationHistory.map((msg) => ({
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp.toISOString(),
            })),
        };
    }

    /**
     * Deserialize session from storage
     */
    private deserializeSession(serialized: SerializedChatSession): ChatSession {
        return {
            id: serialized.id,
            mode: serialized.mode,
            workflowName: serialized.workflowName,
            workflowContext: serialized.workflowContext
                ? {
                      mode: serialized.workflowContext.mode,
                      specName: serialized.workflowContext.specName,
                      command: serialized.workflowContext.command,
                      userInput: serialized.workflowContext.userInput,
                      stepData: new Map(serialized.workflowContext.stepData),
                  }
                : undefined,
            currentStep: serialized.currentStep,
            totalSteps: serialized.totalSteps,
            specName: serialized.specName,
            startedAt: new Date(serialized.startedAt),
            lastActivity: new Date(serialized.lastActivity),
            isActive: serialized.isActive,
            conversationHistory: serialized.conversationHistory.map((msg) => ({
                role: msg.role,
                content: msg.content,
                timestamp: new Date(msg.timestamp),
            })),
        };
    }

    /**
     * Clear all sessions (for testing/reset)
     */
    async clearAllSessions(): Promise<void> {
        this.sessions.clear();
        this.activeSessionId = undefined;
        await this.context.workspaceState.update(
            ChatSessionManager.STORAGE_KEY,
            undefined
        );
        console.log("[ChatSessionManager] Cleared all sessions");
    }
}
