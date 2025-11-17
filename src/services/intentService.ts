import * as vscode from 'vscode';
import { TextDecoder } from 'util';
import { AutonomyPolicyService, AutonomyAction, ConsentState } from './autonomyPolicyService';

export type IntentActivationSource = 'taskTree' | 'slashCommand' | 'button';

export interface IntentDispatchOptions {
    actionId: string;
    userMessage: string;
    activationSource: IntentActivationSource;
    specSlug?: string;
    taskId?: number;
    taskLabel?: string;
    instructionsVersion?: string;
    workspaceFolder?: vscode.WorkspaceFolder;
    metadata?: Record<string, unknown>;
}

export interface IntentPayload {
    actionId: string;
    activationSource: IntentActivationSource;
    userMessage: string;
    policyVersion: string;
    instructionsVersion: string;
    specSlug?: string;
    taskId?: number;
    taskLabel?: string;
    consentToken?: string;
    metadata?: Record<string, unknown>;
}

export type IntentStage =
    | 'queued'
    | 'consentRequested'
    | 'consentGranted'
    | 'dispatching'
    | 'dispatched'
    | 'cancelled'
    | 'failed'
    | 'running'
    | 'completed';

export interface IntentStatusEvent {
    workspaceFolder: vscode.WorkspaceFolder;
    actionId: string;
    stage: IntentStage;
    message: string;
    timestamp: number;
    payload?: IntentPayload;
    error?: string;
    source?: 'extension' | 'mcp';
    specSlug?: string;
    details?: Record<string, unknown>;
}

export class IntentService implements vscode.Disposable {
    private readonly statusEmitter = new vscode.EventEmitter<IntentStatusEvent>();
    readonly onDidChangeStatus = this.statusEmitter.event;
    private runtimeWatcher?: vscode.FileSystemWatcher;
    private processedRuntimeKeys: Set<string> = new Set();
    private readonly decoder = new TextDecoder('utf-8');

    constructor(
        private readonly extensionContext: vscode.ExtensionContext,
        private readonly autonomyPolicyService: AutonomyPolicyService
    ) {
        this.initializeRuntimeWatcher();
    }

    dispose(): void {
        this.statusEmitter.dispose();
        this.runtimeWatcher?.dispose();
    }

    async dispatchIntent(options: IntentDispatchOptions): Promise<void> {
        const workspaceFolder = options.workspaceFolder ?? vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder is open. Unable to dispatch intent.');
            return;
        }

        this.emitStatus(workspaceFolder, options.actionId, 'queued', 'Preparing intent payload.');

        const { policy, error } = await this.autonomyPolicyService.getPolicy(workspaceFolder);
        if (!policy) {
            this.emitStatus(workspaceFolder, options.actionId, 'failed', error ?? 'Autonomy policy unavailable.');
            vscode.window.showErrorMessage(error ?? 'Autonomy policy unavailable. Run the setup command first.');
            return;
        }

        const action = await this.autonomyPolicyService.getAction(workspaceFolder, options.actionId);
        if (!action) {
            const message = `Autonomy action "${options.actionId}" is not defined in the manifest.`;
            this.emitStatus(workspaceFolder, options.actionId, 'failed', message);
            vscode.window.showErrorMessage(message);
            return;
        }

        const consent = await this.ensureConsent(workspaceFolder, action, policy);
        if (action.requiresConsent && !consent) {
            this.emitStatus(workspaceFolder, options.actionId, 'cancelled', 'Consent is required but was not granted.');
            return;
        }

        const payload = this.buildPayload({
            options,
            policyVersion: policy.version,
            consentToken: consent ? this.encodeConsentToken(consent) : undefined
        });

        this.emitStatus(workspaceFolder, options.actionId, 'dispatching', 'Dispatching intent to @kiro.', payload);

        try {
            await this.sendToChat(payload);
            this.emitStatus(workspaceFolder, options.actionId, 'dispatched', 'Intent dispatched successfully.', payload);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.emitStatus(workspaceFolder, options.actionId, 'failed', message, payload, message);
            vscode.window.showErrorMessage(`Failed to dispatch intent: ${message}`);
        }
    }

    async revokeConsent(workspaceFolder?: vscode.WorkspaceFolder, actionId?: string): Promise<void> {
        const folder = workspaceFolder ?? vscode.workspace.workspaceFolders?.[0];
        if (!folder) {
            return;
        }
        await this.autonomyPolicyService.clearConsentState(folder, actionId);
    }

    private async ensureConsent(
        workspaceFolder: vscode.WorkspaceFolder,
        action: AutonomyAction,
        policy: { version: string; consent: { phrase: string; expiresMinutes: number } }
    ): Promise<ConsentState | undefined> {
        if (!action.requiresConsent) {
            return undefined;
        }

        const existing = this.autonomyPolicyService.getConsentState(workspaceFolder, action.id);
        if (existing) {
            return existing;
        }

        this.emitStatus(
            workspaceFolder,
            action.id,
            'consentRequested',
            `Consent phrase "${policy.consent.phrase}" required for ${action.description || action.id}.`
        );

        const userInput = await vscode.window.showInputBox({
            prompt: `Type the consent phrase to allow "${action.description || action.id}" to run autonomously.`
        });

        if (!userInput) {
            vscode.window.showInformationMessage('Consent cancelled. Intent will not be dispatched.');
            return undefined;
        }

        if (userInput.trim() !== policy.consent.phrase) {
            vscode.window.showWarningMessage('Consent phrase mismatch. Intent cancelled.');
            return undefined;
        }

        const consent = await this.autonomyPolicyService.grantConsent(
            workspaceFolder,
            action.id,
            policy.consent.phrase,
            policy.consent.expiresMinutes
        );

        this.emitStatus(
            workspaceFolder,
            action.id,
            'consentGranted',
            `Consent granted for ${action.description || action.id}.`
        );
        return consent;
    }

    private buildPayload(params: {
        options: IntentDispatchOptions;
        policyVersion: string;
        consentToken?: string;
    }): IntentPayload {
        const { options, policyVersion, consentToken } = params;
        const instructionsVersion = options.instructionsVersion ?? policyVersion;
        return {
            actionId: options.actionId,
            activationSource: options.activationSource,
            userMessage: options.userMessage,
            policyVersion,
            instructionsVersion,
            specSlug: options.specSlug,
            taskId: options.taskId,
            taskLabel: options.taskLabel,
            consentToken,
            metadata: options.metadata
        };
    }

    private async sendToChat(payload: IntentPayload): Promise<void> {
        const serializedPayload = JSON.stringify(payload, null, 2);
        const slashCommand = `/intent ${serializedPayload}`;

        const chatApi = (vscode as typeof vscode & { chat?: { requestChatAccess?: (id: string) => Promise<{ sendChatMessage: (message: string) => Promise<void> }> } }).chat;
        if (chatApi && typeof chatApi.requestChatAccess === 'function') {
            try {
                const participant = await chatApi.requestChatAccess('kiro');
                await participant.sendChatMessage(slashCommand);
                return;
            } catch (error) {
                console.warn('Chat access failed, falling back to manual dispatch.', error);
            }
        }

        await vscode.commands.executeCommand('workbench.action.chat.open', {
            query: `@kiro ${slashCommand}`
        });
    }

    private encodeConsentToken(consent: ConsentState): string {
        try {
            const payload = JSON.stringify(consent);
            return Buffer.from(payload, 'utf-8').toString('base64');
        } catch (error) {
            console.warn('Unable to encode consent token', error);
            return `${consent.actionId}:${consent.grantedAt}`;
        }
    }

    private emitStatus(
        workspaceFolder: vscode.WorkspaceFolder,
        actionId: string,
        stage: IntentStage,
        message: string,
        payload?: IntentPayload,
        error?: string
    ): void {
        this.statusEmitter.fire({
            workspaceFolder,
            actionId,
            stage,
            message,
            payload,
            error,
            timestamp: Date.now(),
            source: 'extension',
            specSlug: payload?.specSlug,
            details: payload?.metadata
        });
    }

    private initializeRuntimeWatcher(): void {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const runtimeDir = vscode.Uri.joinPath(workspaceFolder.uri, '.kiro', 'runtime');
        const pattern = new vscode.RelativePattern(runtimeDir, 'intent-status.jsonl');
        this.runtimeWatcher = vscode.workspace.createFileSystemWatcher(pattern);
        this.extensionContext.subscriptions.push(this.runtimeWatcher);

        const refresh = () => {
            void this.readRuntimeStatuses(workspaceFolder, runtimeDir);
        };

        this.runtimeWatcher.onDidCreate(refresh, this, this.extensionContext.subscriptions);
        this.runtimeWatcher.onDidChange(refresh, this, this.extensionContext.subscriptions);
        this.runtimeWatcher.onDidDelete(() => this.processedRuntimeKeys.clear(), this, this.extensionContext.subscriptions);

        refresh();
    }

    private async readRuntimeStatuses(
        workspaceFolder: vscode.WorkspaceFolder,
        runtimeDir: vscode.Uri
    ): Promise<void> {
        const fileUri = vscode.Uri.joinPath(runtimeDir, 'intent-status.jsonl');
        try {
            const raw = await vscode.workspace.fs.readFile(fileUri);
            const content = this.decoder.decode(raw);
            const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
            for (const line of lines) {
                let payload: RuntimeStatusPayload | undefined;
                try {
                    payload = JSON.parse(line) as RuntimeStatusPayload;
                } catch (error) {
                    console.warn('[IntentService] Unable to parse runtime status line', error);
                    continue;
                }

                const key = this.buildRuntimeKey(payload);
                if (this.processedRuntimeKeys.has(key)) {
                    continue;
                }

                this.processedRuntimeKeys.add(key);
                this.trimRuntimeKeyCache();
                this.emitRuntimeStatus(workspaceFolder, payload);
            }
        } catch (error) {
            const nodeError = error as NodeJS.ErrnoException;
            if (nodeError?.code === 'ENOENT') {
                return;
            }
            console.warn('[IntentService] Failed to read runtime status file', error);
        }
    }

    private emitRuntimeStatus(
        workspaceFolder: vscode.WorkspaceFolder,
        payload: RuntimeStatusPayload
    ): void {
        const stage = this.mapRuntimeStage(payload.stage);
        if (!stage) {
            return;
        }

        const actionId = this.mapRuntimeActionId(payload);
        const timestamp = Date.parse(payload.timestamp) || Date.now();

        this.statusEmitter.fire({
            workspaceFolder,
            actionId,
            stage,
            message: payload.message,
            timestamp,
            source: 'mcp',
            specSlug: payload.specSlug,
            details: payload.details
        });
    }

    private mapRuntimeStage(stage: string): IntentStage | undefined {
        switch (stage) {
            case 'queued':
                return 'queued';
            case 'running':
                return 'running';
            case 'completed':
                return 'completed';
            case 'failed':
                return 'failed';
            default:
                return undefined;
        }
    }

    private mapRuntimeActionId(payload: RuntimeStatusPayload): string {
        if (payload.details && typeof payload.details.actionId === 'string') {
            return payload.details.actionId;
        }

        switch (payload.tool) {
            case 'kiro_execute_task':
                return 'executeTask.next';
            case 'kiro_create_requirements':
                return 'createRequirements';
            default:
                return payload.tool ?? 'unknown';
        }
    }

    private buildRuntimeKey(payload: RuntimeStatusPayload): string {
        return `${payload.timestamp}-${payload.stage}-${payload.message}`;
    }

    private trimRuntimeKeyCache(): void {
        if (this.processedRuntimeKeys.size <= 200) {
            return;
        }
        const entries = Array.from(this.processedRuntimeKeys);
        const trimmed = entries.slice(entries.length - 200);
        this.processedRuntimeKeys = new Set(trimmed);
    }
}

interface RuntimeStatusPayload {
    stage: string;
    message: string;
    timestamp: string;
    tool?: string;
    specSlug?: string;
    details?: Record<string, unknown>;
}
