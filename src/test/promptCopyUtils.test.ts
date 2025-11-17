import test from 'node:test';
import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { copyDirectorySkippingExisting, createCopyStats } from '../services/promptCopyUtils';

test('copies files into an empty destination', (t) => {
    const fixture = createFixture();
    t.after(fixture.cleanup);

    const nestedSrc = path.join(fixture.src, 'nested');
    fs.mkdirSync(nestedSrc, { recursive: true });
    fs.writeFileSync(path.join(nestedSrc, 'file.txt'), 'hello world');

    const stats = createCopyStats();
    copyDirectorySkippingExisting(fixture.src, fixture.dest, stats);

    assert.strictEqual(stats.created, 1);
    assert.strictEqual(stats.skipped, 0);
    assert.strictEqual(stats.failed.length, 0);
    assert.ok(fs.existsSync(path.join(fixture.dest, 'nested', 'file.txt')));
});

test('skips files that already exist while copying new ones', (t) => {
    const fixture = createFixture();
    t.after(fixture.cleanup);

    fs.writeFileSync(path.join(fixture.src, 'keep.md'), 'old');
    fs.writeFileSync(path.join(fixture.src, 'new.md'), 'fresh');

    // Pre-create destination file to simulate customization that should be preserved
    const keepDest = path.join(fixture.dest, 'keep.md');
    fs.mkdirSync(fixture.dest, { recursive: true });
    fs.writeFileSync(keepDest, 'custom');

    const stats = createCopyStats();
    copyDirectorySkippingExisting(fixture.src, fixture.dest, stats);

    assert.strictEqual(stats.created, 1);
    assert.strictEqual(stats.skipped, 1);
    assert.strictEqual(stats.failed.length, 0);
    assert.strictEqual(fs.readFileSync(keepDest, 'utf-8'), 'custom');
    assert.ok(fs.existsSync(path.join(fixture.dest, 'new.md')));
});

test('records failures without stopping the rest of the copy', (t) => {
    const fixture = createFixture();
    t.after(fixture.cleanup);

    fs.writeFileSync(path.join(fixture.src, 'fail.md'), 'boom');
    fs.writeFileSync(path.join(fixture.src, 'ok.md'), 'fine');

    const stats = createCopyStats();
    const failingCopy = (src: string, dest: string) => {
        if (path.basename(src) === 'fail.md') {
            throw new Error('forced failure');
        }
        fs.copyFileSync(src, dest);
    };

    copyDirectorySkippingExisting(fixture.src, fixture.dest, stats, undefined, { copyFn: failingCopy });

    assert.strictEqual(stats.created, 1);
    assert.strictEqual(stats.skipped, 0);
    assert.strictEqual(stats.failed.length, 1);
    assert.strictEqual(stats.failed[0].relativePath, 'fail.md');
    assert.match(stats.failed[0].error, /forced failure/);
});

function createFixture() {
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-src-'));
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-dest-'));

    return {
        src,
        dest,
        cleanup: () => {
            fs.rmSync(src, { recursive: true, force: true });
            fs.rmSync(dest, { recursive: true, force: true });
        }
    };
}
