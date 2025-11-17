import * as vscode from 'vscode';
import { TextDecoder } from 'util';

export interface AutonomyConsentConfig {
    phrase: string;
    expiresMinutes: number;
}

export interface AutonomyAction {
    id: string;
    tool: string;
    description: string;
    requiresConsent: boolean;
    requiresFiles?: string[];
    intentSchema?: string[];
    requiresLLM?: boolean;
}

export interface AutonomyPolicy {
    version: string;
    consent: AutonomyConsentConfig;
    actions: AutonomyAction[];
}

export interface AutonomyPolicyLoadResult {
    workspaceFolder?: vscode.WorkspaceFolder;
    policy?: AutonomyPolicy;
    error?: string;
}

export interface ConsentState {
    actionId: string;
    phrase: string;
    grantedAt: number;
    expiresAt: number;
}

interface PolicyCacheEntry {
    policy?: AutonomyPolicy;
    error?: string;
    loadedAt: number;
}

interface ConsentWorkspaceState {
    [workspaceUri: string]: {
        [actionId: string]: ConsentState;
    };
}

export interface AutonomyPolicyChangeEvent {
    workspaceFolder: vscode.WorkspaceFolder;
    policy?: AutonomyPolicy;
    error?: string;
}

export class AutonomyPolicyService implements vscode.Disposable {
    private static readonly MANIFEST_RELATIVE_PATH = '.github/prompts/autonomy.manifest.json';
    private static readonly CONSENT_STATE_KEY = 'kiro.autonomyConsentState';

    private readonly decoder = new TextDecoder('utf-8');
    private readonly cache = new Map<string, PolicyCacheEntry>();
    private readonly watchers = new Map<string, vscode.FileSystemWatcher>();
    private readonly policyEmitter = new vscode.EventEmitter<AutonomyPolicyChangeEvent>();

    public readonly onDidUpdatePolicy = this.policyEmitter.event;

    constructor(private readonly extensionContext: vscode.ExtensionContext) {}

    dispose(): void {
        for (const watcher of this.watchers.values()) {
            watcher.dispose();
        }
        this.watchers.clear();
        this.policyEmitter.dispose();
    }

    async getPolicy(workspaceFolder?: vscode.WorkspaceFolder): Promise<AutonomyPolicyLoadResult> {
        const folder = workspaceFolder ?? vscode.workspace.workspaceFolders?.[0];
        if (!folder) {
            return { error: 'No workspace folder is open.' };
        }

        const cacheKey = this.getWorkspaceKey(folder);
        const cached = this.cache.get(cacheKey);
        if (cached) {
            return { workspaceFolder: folder, policy: cached.policy, error: cached.error };
        }

        const manifestUri = this.getManifestUri(folder);
        if (!(await this.fileExists(manifestUri))) {
            const error = 'Autonomy manifest not found. Run "Kiro: Setup Project" to sync prompts.';
            this.cache.set(cacheKey, { error, loadedAt: Date.now() });
            return { workspaceFolder: folder, error };
        }

        try {
            const fileContents = await vscode.workspace.fs.readFile(manifestUri);
            const raw = this.decoder.decode(fileContents);
            const policy = this.parseManifest(raw);
            this.cache.set(cacheKey, { policy, loadedAt: Date.now() });
            this.ensureWatcher(folder);
            return { workspaceFolder: folder, policy };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.cache.set(cacheKey, { error: message, loadedAt: Date.now() });
            return { workspaceFolder: folder, error: message };
        }
    }

    async refreshPolicy(workspaceFolder?: vscode.WorkspaceFolder): Promise<AutonomyPolicyLoadResult> {
        const folder = workspaceFolder ?? vscode.workspace.workspaceFolders?.[0];
        if (!folder) {
            return { error: 'No workspace folder is open.' };
        }

        const cacheKey = this.getWorkspaceKey(folder);
        this.cache.delete(cacheKey);
        return this.getPolicy(folder);
    }

    async getAction(workspaceFolder: vscode.WorkspaceFolder, actionId: string): Promise<AutonomyAction | undefined> {
        const { policy } = await this.getPolicy(workspaceFolder);
        return policy?.actions.find(action => action.id === actionId);
    }

    getConsentState(workspaceFolder: vscode.WorkspaceFolder, actionId: string): ConsentState | undefined {
        const key = this.getWorkspaceKey(workspaceFolder);
        const state = this.getConsentStateMap()[key]?.[actionId];
        if (!state) {
            return undefined;
        }

        if (state.expiresAt <= Date.now()) {
            this.clearConsentState(workspaceFolder, actionId);
            return undefined;
        }

        return state;
    }

    async grantConsent(
        workspaceFolder: vscode.WorkspaceFolder,
        actionId: string,
        phrase: string,
        expiresMinutes: number
    ): Promise<ConsentState> {
        const now = Date.now();
        const expiresAt = now + Math.max(1, expiresMinutes) * 60 * 1000;
        const consent: ConsentState = {
            actionId,
            phrase,
            grantedAt: now,
            expiresAt
        };

        const key = this.getWorkspaceKey(workspaceFolder);
        const state = this.getConsentStateMap();
        state[key] = state[key] ?? {};
        state[key][actionId] = consent;
        await this.extensionContext.workspaceState.update(AutonomyPolicyService.CONSENT_STATE_KEY, state);
        return consent;
    }

    async clearConsentState(workspaceFolder: vscode.WorkspaceFolder, actionId?: string): Promise<void> {
        const key = this.getWorkspaceKey(workspaceFolder);
        const state = this.getConsentStateMap();
        if (!state[key]) {
            return;
        }

        if (actionId) {
            delete state[key][actionId];
        } else {
            delete state[key];
        }

        await this.extensionContext.workspaceState.update(AutonomyPolicyService.CONSENT_STATE_KEY, state);
    }

    async isActionAllowed(workspaceFolder: vscode.WorkspaceFolder, actionId: string): Promise<boolean> {
        const { policy } = await this.getPolicy(workspaceFolder);
        if (!policy) {
            return false;
        }

        const action = policy.actions.find(a => a.id === actionId);
        if (!action) {
            return false;
        }

        if (!action.requiresConsent) {
            return true;
        }

        const consent = this.getConsentState(workspaceFolder, actionId);
        return Boolean(consent);
    }

    async requestConsent(
        actionId: string,
        workspaceFolder?: vscode.WorkspaceFolder
    ): Promise<ConsentState | undefined> {
        const folder = workspaceFolder ?? vscode.workspace.workspaceFolders?.[0];
        if (!folder) {
            vscode.window.showErrorMessage('Open a workspace folder before enabling autonomy.');
            return undefined;
        }

        const { policy, error } = await this.getPolicy(folder);
        if (!policy) {
            vscode.window.showErrorMessage(error ?? 'Autonomy policy unavailable. Run "Kiro: Setup Project" first.');
            return undefined;
        }

        const action = policy.actions.find(a => a.id === actionId);
        if (!action) {
            vscode.window.showErrorMessage(`Autonomy action "${actionId}" is not defined in the manifest.`);
            return undefined;
        }

        if (!action.requiresConsent) {
            vscode.window.showInformationMessage(
                `${action.description || action.id} does not require consent. Autonomy already enabled.`
            );
            return this.getConsentState(folder, actionId);
        }

        const existing = this.getConsentState(folder, actionId);
        if (existing) {
            const expiresAt = new Date(existing.expiresAt).toLocaleTimeString();
            vscode.window.showInformationMessage(
                `Autonomy already enabled for ${action.description || action.id} (expires ${expiresAt}).`
            );
            return existing;
        }

        const phrase = policy.consent.phrase;
        const prompt = `Type the consent phrase (${phrase}) to enable ${action.description || action.id}.`;
        const userInput = await vscode.window.showInputBox({
            prompt,
            placeHolder: phrase,
            value: '',
            ignoreFocusOut: true
        });

        if (!userInput) {
            vscode.window.showInformationMessage('Consent cancelled.');
            return undefined;
        }

        if (userInput.trim() !== phrase) {
            vscode.window.showWarningMessage('Consent phrase mismatch. Autonomy remains disabled.');
            return undefined;
        }

        const consent = await this.grantConsent(folder, actionId, phrase, policy.consent.expiresMinutes);
        const expiresAt = new Date(consent.expiresAt).toLocaleTimeString();
        vscode.window.showInformationMessage(
            `Autonomy enabled for ${action.description || action.id} (expires ${expiresAt}).`
        );
        return consent;
    }

    private getConsentStateMap(): ConsentWorkspaceState {
        return (
            this.extensionContext.workspaceState.get<ConsentWorkspaceState>(
                AutonomyPolicyService.CONSENT_STATE_KEY,
                {}
            ) ?? {}
        );
    }

    private getManifestUri(workspaceFolder: vscode.WorkspaceFolder): vscode.Uri {
        return vscode.Uri.joinPath(workspaceFolder.uri, '.github', 'prompts', 'autonomy.manifest.json');
    }

    private getWorkspaceKey(workspaceFolder: vscode.WorkspaceFolder): string {
        return workspaceFolder.uri.toString();
    }

    private async fileExists(uri: vscode.Uri): Promise<boolean> {
        try {
            await vscode.workspace.fs.stat(uri);
            return true;
        } catch {
            return false;
        }
    }

    private parseManifest(raw: string): AutonomyPolicy {
        const data = JSON.parse(raw);
        if (!data || typeof data !== 'object') {
            throw new Error('Autonomy manifest is not an object.');
        }

        if (!data.version || typeof data.version !== 'string') {
            throw new Error('Autonomy manifest is missing a valid "version".');
        }

        const consent = data.consent ?? {};
        if (typeof consent.phrase !== 'string' || !consent.phrase.trim()) {
            throw new Error('Autonomy manifest requires a consent phrase.');
        }
        const expiresMinutes = Number(consent.expiresMinutes ?? 0);
        if (!Number.isFinite(expiresMinutes) || expiresMinutes <= 0) {
            throw new Error('Autonomy manifest must define a positive consent expiry.');
        }

        const actions = Array.isArray(data.actions) ? data.actions : [];
        const normalizedActions: AutonomyAction[] = actions.map((action: AutonomyAction) => {
            const id = typeof action.id === 'string' ? action.id.trim() : '';
            const tool = typeof action.tool === 'string' ? action.tool.trim() : '';
            if (!id) {
                throw new Error('Autonomy actions must include an id.');
            }
            if (!tool) {
                throw new Error(`Autonomy action "${id}" is missing a tool reference.`);
            }

            return {
                id,
                tool,
                description: typeof action.description === 'string' ? action.description : '',
                requiresConsent: Boolean(action.requiresConsent),
                requiresFiles: Array.isArray(action.requiresFiles) ? action.requiresFiles : [],
                intentSchema: Array.isArray(action.intentSchema) ? action.intentSchema : [],
                requiresLLM: action.requiresLLM ?? false
            };
        });

        return {
            version: data.version,
            consent: {
                phrase: consent.phrase,
                expiresMinutes
            },
            actions: normalizedActions
        };
    }

    private ensureWatcher(workspaceFolder: vscode.WorkspaceFolder): void {
        const cacheKey = this.getWorkspaceKey(workspaceFolder);
        if (this.watchers.has(cacheKey)) {
            return;
        }

        const pattern = new vscode.RelativePattern(
            workspaceFolder,
            AutonomyPolicyService.MANIFEST_RELATIVE_PATH
        );
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);

        const handleChange = () => {
            this.cache.delete(cacheKey);
            this.policyEmitter.fire({ workspaceFolder });
        };

        watcher.onDidChange(handleChange, undefined, this.extensionContext.subscriptions);
        watcher.onDidCreate(handleChange, undefined, this.extensionContext.subscriptions);
        watcher.onDidDelete(() => {
            this.cache.delete(cacheKey);
            this.policyEmitter.fire({ workspaceFolder, error: 'Autonomy manifest deleted.' });
        }, undefined, this.extensionContext.subscriptions);

        this.watchers.set(cacheKey, watcher);
        this.extensionContext.subscriptions.push(watcher);
    }
}
