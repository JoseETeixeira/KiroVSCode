/**
 * Unit tests for ModeManager service.
 * 
 * Tests the ModeManager using mocked IPlatformAdapter to verify
 * configuration reading and writing works correctly across platforms.
 */

import test from 'node:test';
import * as assert from 'assert';
import { ModeManager } from '../services/modeManager';
import { 
    IPlatformAdapter, 
    Configuration, 
    ConfigurationTarget
} from '../adapters';

/**
 * Creates a mock Configuration object for testing.
 * 
 * @param initialValues Initial configuration values
 * @returns A mock Configuration object
 */
function createMockConfiguration(initialValues: Record<string, unknown> = {}): Configuration {
    const values = { ...initialValues };
    
    return {
        get<T>(key: string, defaultValue?: T): T | undefined {
            if (key in values) {
                return values[key] as T;
            }
            return defaultValue;
        },
        has(key: string): boolean {
            return key in values;
        },
        async update(key: string, value: unknown, _configTarget?: ConfigurationTarget): Promise<void> {
            void _configTarget; // Explicitly mark as intentionally unused
            values[key] = value;
        },
        inspect<T>(_inspectKey: string) {
            void _inspectKey; // Explicitly mark as intentionally unused
            return undefined as T | undefined;
        }
    };
}

/**
 * Creates a minimal mock IPlatformAdapter for testing ModeManager.
 * Only implements the getConfiguration method that ModeManager actually uses.
 * 
 * @param config The mock configuration to use
 * @returns A mock IPlatformAdapter
 */
function createMockAdapter(config: Configuration): Pick<IPlatformAdapter, 'getConfiguration'> {
    return {
        getConfiguration(_section?: string): Configuration {
            void _section; // Explicitly mark as intentionally unused
            return config;
        }
    };
}

test('ModeManager: getCurrentMode returns default mode when not set', () => {
    const config = createMockConfiguration();
    const adapter = createMockAdapter(config) as IPlatformAdapter;
    const modeManager = new ModeManager(adapter);
    
    const mode = modeManager.getCurrentMode();
    
    assert.strictEqual(mode, 'vibe', 'Default mode should be "vibe"');
});

test('ModeManager: getCurrentMode returns configured mode', () => {
    const config = createMockConfiguration({ 'kiroCopilot.mode': 'spec' });
    const adapter = createMockAdapter(config) as IPlatformAdapter;
    const modeManager = new ModeManager(adapter);
    
    const mode = modeManager.getCurrentMode();
    
    assert.strictEqual(mode, 'spec', 'Should return configured mode "spec"');
});

test('ModeManager: setMode updates configuration', async () => {
    const config = createMockConfiguration({ 'kiroCopilot.mode': 'vibe' });
    const adapter = createMockAdapter(config) as IPlatformAdapter;
    const modeManager = new ModeManager(adapter);
    
    await modeManager.setMode('spec');
    
    const updatedMode = modeManager.getCurrentMode();
    assert.strictEqual(updatedMode, 'spec', 'Mode should be updated to "spec"');
});

test('ModeManager: getModeDescription returns correct description for vibe mode', () => {
    const config = createMockConfiguration();
    const adapter = createMockAdapter(config) as IPlatformAdapter;
    const modeManager = new ModeManager(adapter);
    
    const description = modeManager.getModeDescription('vibe');
    
    assert.ok(description.includes('Chat first'), 'Vibe description should mention "Chat first"');
    assert.ok(description.includes('iterate'), 'Vibe description should mention iteration');
});

test('ModeManager: getModeDescription returns correct description for spec mode', () => {
    const config = createMockConfiguration();
    const adapter = createMockAdapter(config) as IPlatformAdapter;
    const modeManager = new ModeManager(adapter);
    
    const description = modeManager.getModeDescription('spec');
    
    assert.ok(description.includes('Plan first'), 'Spec description should mention "Plan first"');
    assert.ok(description.includes('requirements'), 'Spec description should mention requirements');
});

test('ModeManager: getModeIcon returns correct icon for vibe mode', () => {
    const config = createMockConfiguration();
    const adapter = createMockAdapter(config) as IPlatformAdapter;
    const modeManager = new ModeManager(adapter);
    
    const icon = modeManager.getModeIcon('vibe');
    
    assert.strictEqual(icon, '$(rocket)', 'Vibe mode should have rocket icon');
});

test('ModeManager: getModeIcon returns correct icon for spec mode', () => {
    const config = createMockConfiguration();
    const adapter = createMockAdapter(config) as IPlatformAdapter;
    const modeManager = new ModeManager(adapter);
    
    const icon = modeManager.getModeIcon('spec');
    
    assert.strictEqual(icon, '$(notebook)', 'Spec mode should have notebook icon');
});

test('ModeManager: getModeBenefits returns array for vibe mode', () => {
    const config = createMockConfiguration();
    const adapter = createMockAdapter(config) as IPlatformAdapter;
    const modeManager = new ModeManager(adapter);
    
    const benefits = modeManager.getModeBenefits('vibe');
    
    assert.ok(Array.isArray(benefits), 'Benefits should be an array');
    assert.ok(benefits.length > 0, 'Benefits array should not be empty');
    assert.ok(benefits.some(b => b.includes('exploration')), 'Vibe benefits should mention exploration');
});

test('ModeManager: getModeBenefits returns array for spec mode', () => {
    const config = createMockConfiguration();
    const adapter = createMockAdapter(config) as IPlatformAdapter;
    const modeManager = new ModeManager(adapter);
    
    const benefits = modeManager.getModeBenefits('spec');
    
    assert.ok(Array.isArray(benefits), 'Benefits should be an array');
    assert.ok(benefits.length > 0, 'Benefits array should not be empty');
    assert.ok(benefits.some(b => b.includes('Structured')), 'Spec benefits should mention structured development');
});

test('ModeManager: mode toggle workflow works correctly', async () => {
    const config = createMockConfiguration({ 'kiroCopilot.mode': 'vibe' });
    const adapter = createMockAdapter(config) as IPlatformAdapter;
    const modeManager = new ModeManager(adapter);
    
    // Start with vibe
    assert.strictEqual(modeManager.getCurrentMode(), 'vibe');
    
    // Toggle to spec
    await modeManager.setMode('spec');
    assert.strictEqual(modeManager.getCurrentMode(), 'spec');
    
    // Toggle back to vibe
    await modeManager.setMode('vibe');
    assert.strictEqual(modeManager.getCurrentMode(), 'vibe');
});
