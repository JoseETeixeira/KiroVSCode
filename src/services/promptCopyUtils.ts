import * as fs from 'fs';
import * as path from 'path';

export interface CopyFailure {
    relativePath: string;
    error: string;
}

export interface CopyStats {
    created: number;
    skipped: number;
    failed: CopyFailure[];
}

export interface CopyOptions {
    copyFn?: (src: string, dest: string) => void;
}

export const createCopyStats = (): CopyStats => ({
    created: 0,
    skipped: 0,
    failed: []
});

/**
 * Recursively copy the source directory into the destination directory while preserving hierarchy
 * and skipping files that already exist. All operations are synchronous so they can run inside
 * VS Code progress notifications without extra async plumbing.
 */
export function copyDirectorySkippingExisting(
    src: string,
    dest: string,
    stats: CopyStats,
    baseDest?: string,
    options?: CopyOptions
): void {
    if (!fs.existsSync(src)) {
        return;
    }

    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const root = baseDest ?? dest;
    const entries = fs.readdirSync(src, { withFileTypes: true });

    const copy = options?.copyFn ?? fs.copyFileSync;

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        const relativePath = sanitizeRelativePath(path.relative(root, destPath) || entry.name);

        try {
            if (entry.isDirectory()) {
                copyDirectorySkippingExisting(srcPath, destPath, stats, root, options);
                continue;
            }

            if (fs.existsSync(destPath)) {
                stats.skipped++;
                continue;
            }

            copy(srcPath, destPath);
            stats.created++;
        } catch (error) {
            stats.failed.push({
                relativePath,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
}

const sanitizeRelativePath = (relPath: string): string => relPath.replace(/\\/g, '/');
