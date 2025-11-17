# Requirements: Setup Project Prompt Sync

**Document Information**  
- **Feature Name:** Setup Project Prompt Sync  
- **Version:** 1.0  
- **Date:** 2025-11-17  
- **Author:** Kiro  
- **Stakeholders:** Extension maintainers, VS Code users, DevEx advocates

## Introduction
The "Setup project" command is responsible for preparing a workspace so that Kiro-style workflows operate correctly. Today it focuses on `.kiro` scaffolding but does not ensure that the latest prompt templates are available inside the project's `.github/prompts` directory. Users who rely on GitHub Copilot Chat commands therefore have to copy prompts manually, which leads to drift between the shipped templates and what a workspace actually contains.

This feature augments the setup experience so that running "Setup project" creates (or refreshes) the `.github/prompts` folder using the extension's bundled `prompts/` directory. By automatically mirroring the canonical templates, the command keeps Copilot instructions current, reduces onboarding friction, and removes a repetitive manual task.

## Feature Summary
Automatically copy the extension's `prompts/` contents into the active workspace's `.github/prompts/` directory whenever "Setup project" runs.

## Business Value
- Keeps Copilot workflows consistent across team members and workspaces by guaranteeing the same prompt set.
- Reduces onboarding time for new projects because prompts are provisioned alongside `.kiro` scaffolding.
- Minimizes support issues caused by outdated or missing prompt files during spec-driven development flows.

## Scope
- **Included:** Detecting/creating the workspace `.github` directory, copying prompt files and subdirectories, handling conflicts, and informing the user of the outcome.  
- **Excluded:** Editing prompt content, syncing user-customized prompts back to the extension, or modifying non-prompt assets inside `.github`.

---

## Requirements

### Requirement 1: Copy prompts into .github
**User Story:** As a user running the setup command, I want the extension to copy the bundled prompts into my workspace `.github` folder so that Copilot Chat can use the latest templates immediately.

**Acceptance Criteria (EARS)**  
- WHEN the "Setup project" command executes THEN the system SHALL ensure a `.github/prompts` directory exists by copying every file and subdirectory from the extension `prompts/` folder.  
- IF the destination `.github` directory is missing THEN the system SHALL create it before copying prompt assets.  
- WHILE files are being copied the system SHALL preserve the relative folder hierarchy from the source `prompts/` directory.  
- WHERE a destination file does not exist the system SHALL create it with the exact contents of the source file.

**Additional Details**  
- **Priority:** High  
- **Complexity:** Medium  
- **Dependencies:** Extension file-system APIs, workspace folder selection  
- **Assumptions:** User has write access to the workspace `.github` directory

### Requirement 2: Preserve existing prompt customizations
**User Story:** As a maintainer rerunning setup, I want existing prompt files preserved so I can keep intentional customizations while still getting any missing templates.

**Acceptance Criteria (EARS)**  
- WHEN a destination prompt file already exists THEN the system SHALL skip copying that file and leave the existing contents unchanged.  
- IF skipping a file due to prior existence THEN the system SHALL still record the skip in its copy statistics so users know it was not replaced.  
- IF a destination contains extra prompt files not present in the source THEN the system SHALL leave those files untouched.  
- WHERE users want a full refresh in the future THEN the system SHALL guide them to delete the `.github/prompts` folder before rerunning setup (documented outside the command scope).

**Additional Details**  
- **Priority:** Medium  
- **Complexity:** Medium  
- **Dependencies:** Requirement 1 copy pipeline  
- **Assumptions:** Users may have local prompt tweaks that must remain intact

### Requirement 3: User feedback and error handling
**User Story:** As a user kicking off setup, I want clear messaging about prompt copy success or failure so that I can take corrective action if needed.

**Acceptance Criteria (EARS)**  
- WHEN the copy routine completes THEN the system SHALL display a VS Code notification summarizing how many prompt files were copied or refreshed.  
- IF any file fails to copy THEN the system SHALL include the failed file paths in the output channel or notification for troubleshooting.  
- IF no workspace folder is open THEN the system SHALL abort the copy operation and show an actionable error message.  
- WHERE the user runs setup repeatedly THEN the system SHALL still provide feedback each time so the user knows refresh occurred.

**Additional Details**  
- **Priority:** High  
- **Complexity:** Low  
- **Dependencies:** VS Code window + output APIs  
- **Assumptions:** Existing setup status channel can be reused for messaging

---

## Non-Functional Requirements

**Performance Requirements**  
- WHEN copying up to a few hundred prompt files THEN the system SHALL finish within 2 seconds on a typical SSD workspace.  
- IF the prompts directory exceeds this size THEN the system SHALL stream copies sequentially without blocking the VS Code UI thread.

**Security Requirements**  
- WHEN accessing workspace paths THEN the system SHALL resolve them via VS Code APIs to avoid writing outside the workspace.  
- IF a path traversal attempt occurs THEN the system SHALL reject the copy and warn the user.

**Usability Requirements**  
- WHEN notifications are shown THEN the system SHALL use concise, action-focused language.  
- IF the copy succeeds THEN the system SHALL include the target path so users can verify contents quickly.

**Reliability Requirements**  
- WHEN an exception occurs mid-copy THEN the system SHALL log the error and attempt to continue with remaining files when safe.  
- IF the source prompts folder is missing or unreadable THEN the system SHALL stop the operation and guide the user to reinstall or repair the extension.

---

## Constraints and Assumptions

**Technical Constraints**  
- Operates within VS Code extension host sandbox using Node's `fs`/`fs-extra` equivalents.  
- Must support Windows, macOS, and Linux paths when copying directories.

**Business Constraints**  
- Needs to ship in the next minor release to unblock Spec Mode adoption.  
- Should avoid introducing new dependencies beyond what the extension already bundles.

**Assumptions**  
- Users typically run setup immediately after cloning or when templates change.  
- Prompt files inside `.github` are not manually locked by source control during setup.

---

## Success Criteria

**Definition of Done**  
- All acceptance criteria above are satisfied in automated or manual verification.  
- Non-functional requirements are validated via smoke testing.  
- Integration between setup messaging and existing output/notification surfaces is complete.  
- Tests or manual verification steps are documented.

**Acceptance Metrics**  
- 100% of files in `prompts/` copied on a clean workspace.  
- Setup completion message appears within 3 seconds of invocation.  
- Error cases identify the failing file path in logs or notifications.

---

## Glossary

| Term | Definition |
| --- | --- |
| Setup project command | Extension command that scaffolds `.kiro` and related assets for a workspace |
| Prompts directory | The extension's bundled `prompts/` folder containing chat instructions |
| Workspace `.github/prompts` | Target directory inside the user's project used by Copilot Chat |

---

## Requirements Review Checklist

**Completeness**  
- All user stories have clear roles, features, and benefits ✅  
- Each requirement has EARS acceptance criteria ✅  
- Non-functional requirements are addressed ✅  
- Success criteria are defined ✅

**Quality**  
- Requirements use active voice ✅  
- Acceptance criteria are testable ✅  
- Implementation details avoided ✅  
- Terminology consistent ✅

**EARS Format Validation**  
- WHEN statements describe triggers ✅  
- IF statements describe conditions ✅  
- WHILE statements describe continuous behavior ✅  
- WHERE statements describe contexts ✅  
- SHALL is used for system responses ✅

**Clarity**  
- Requirements are unambiguous ✅  
- Glossary covers project terms ✅  
- No conflicting requirements detected ✅

**Traceability**  
- Requirements numbered and organized ✅  
- Dependencies noted ✅  
- Links to business objectives captured ✅  
- Assumptions documented ✅
