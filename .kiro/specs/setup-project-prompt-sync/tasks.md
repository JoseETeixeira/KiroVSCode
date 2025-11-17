# Implementation Plan: Setup Project Prompt Sync

## Overview
This checklist breaks the approved technical design into concrete steps. Each task references the relevant requirements to keep traceability intact.

---

- [x] 1. Inspect current setup flow
  - Review `SetupService.copyPromptFiles`, `arePromptFilesSetup`, and the `kiro-copilot.setupProject` command to understand present behavior.
  - Confirm the extension `prompts/` directory structure so nested folders are handled correctly.
  - _Requirements: R1, R2_

- [x] 2. Introduce prompt copy helpers with skip semantics
  - Define a `CopyStats` interface (created, skipped, failed) in `setupService.ts`.
  - Add a `copyDirectorySkippingExisting` helper that mirrors the prompts tree but skips files already present in `.github/prompts` while preserving subdirectories.
  - Ensure helper sanitizes relative paths for error reporting.
  - _Requirements: R1, R2, R3_

- [x] 3. Update `copyPromptFiles` to use new helper
  - Keep instruction copying logic intact but add stats aggregation for prompts vs. instructions.
  - Always invoke the prompts copy routine (even if `arePromptFilesSetup` previously returned true) so missing files are replenished.
  - Return a detailed message summarizing created/skipped/failed counts.
  - _Requirements: R1, R2, R3_

- [x] 4. Adjust setup command flow and user messaging
  - In `extension.ts`, call `copyPromptFiles` unconditionally (still behind progress UI) and surface the stats in the notification/output.
  - Ensure warnings list failing file paths while keeping the command moving when possible.
  - Document that deleting `.github/prompts` triggers a clean refresh if users ever want to overwrite files.
  - _Requirements: R2, R3_

- [x] 5. Add automated coverage
  - Write focused unit tests (e.g., Jest or Mocha) for the new helper using temp directories to verify: fresh copy, skipping existing files, and partial failures.
  - Cover edge cases like nested folders and permission errors (mocked).
  - _Requirements: R1, R2, R3_

- [x] 6. Manual verification + docs
  - Run `npm run compile` and trigger the command in an Extension Development Host workspace with pre-existing `.github/prompts` content.
  - Confirm new files are added while existing ones remain untouched and notifications show accurate counts.
  - Update `README.md` or `USAGE_GUIDE.md` to mention how rerunning setup fills in missing prompts without overwriting.
  - _Requirements: R3_

---

## Notes
- Tasks are sequential but can overlap; ensure helper/unit tests land before wiring everything into the command.
- Keep statistics user-friendly so we can extend them later without breaking notifications.
