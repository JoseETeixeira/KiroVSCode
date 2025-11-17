# Tasks: Autonomous MCP Flow Enhancements

_Traceability_: R1–R4 reference the numbered requirements in `requirements.md`; design sections reference the named components inside `design.md`.

## Phase 1 – Policy & Artifact Metadata (R1, R2)
[x] **T1.1** Add `prompts/autonomy.manifest.json` describing versions, consent phrases, actions, required files, and `requiresLLM` flags. Wire it into the setup package so the file ships with the extension bundle.
[x] **T1.2** Update `.github/prompts` copy routine (`SetupService.copyPromptFiles`) to track the new manifest plus a lightweight `autonomy-version.json`; include version information in notifications.
[x] **T1.3** Enhance `.github/instructions/BASE_SYSTEM_PROMPT.instructions.md` front matter with `autonomyPolicyVersion` and explicit approved-actions documentation, ensuring Requirement 1 acceptance criteria are covered.
[x] **T1.4** Inject YAML front matter into every prompt under `prompts/prompts/*.md` and `prompts/agents/kiro.agent.md` declaring policy version, supported actions, required intent fields, and LLM expectations (Requirement 2).

## Phase 2 – Extension Services & Consent Plumbing (R1, R3)
[x] **T2.1** Implement `AutonomyPolicyService` (new file under `src/services/`) to load the manifest, cache policy data, watch for updates, and store consent tokens in `workspaceState`.
[x] **T2.2** Add `IntentService` (new file under `src/services/`) responsible for building `/intent` payloads, obtaining consent, dispatching chat requests, and emitting status events.
[x] **T2.3** Register `IntentService` inside `src/extension.ts`; ensure it wires into activation flow and disposes resources appropriately.

## Phase 3 – Chat Participant & Commands (R1–R3)
[x] **T3.1** Extend `ChatParticipant` to:
  register the `/intent` slash command,
  validate payload versions/required files,
  forward validated intents to the MCP server, and
  stream structured status + fallback responses back to the UI.
[x] **T3.2** Add a `kiro-copilot.enableAutonomy` command that calls `AutonomyPolicyService` to capture consent using the manifest’s phrase, exposing it via the command palette/context menu.

## Phase 4 – Task Context & UI Feedback (R3)
[x] **T4.1** Update `TaskContextProvider` to display autonomy badges per spec, surface inline actions (execute next / retry autonomously), and subscribe to `IntentService` status events for progress indicators.
[x] **T4.2** Update command contributions (`package.json`) and any tree item context menus so users can trigger the new actions.

## Phase 5 – MCP Server LLM Bridge (R3, R4)
[ ] **T5.1** Implement a reusable helper inside `mcp-server/src` (e.g., `runPromptWithLLM`) that accepts prompt IDs + user message, invokes the hosted LLM, and returns response text + telemetry to callers.
[ ] **T5.2** Update existing MCP tool handlers (`kiro_execute_task`, `kiro_create_requirements`, `kiro_create_tasks`, etc.) to call the helper, stream status updates, and embed `llmResponse` plus token usage within their result envelopes.

## Phase 6 – Extension ⇄ MCP Wiring (R3, R4)
[ ] **T6.1** Define an intent-status event channel (VS Code `EventEmitter` or similar) so the MCP responses feed back into `IntentService` and UI components.
[ ] **T6.2** Ensure fallback behavior: when the MCP server rejects an intent (version mismatch, consent missing, LLM failure), surface actionable warnings and revert to the manual clipboard flow.

## Phase 7 – Testing & Documentation (R1–R4)
[ ] **T7.1** Add unit tests covering `AutonomyPolicyService`, `IntentService`, and the new MCP LLM helper (happy paths + error handling).
[ ] **T7.2** Create or extend snapshot/schema tests to ensure prompt/agent front matter stays aligned with the manifest.
[ ] **T7.3** Document autonomy usage in `README.md` / `USAGE_GUIDE.md`, including consent phrases, UI cues, and troubleshooting steps.
[ ] **T7.4** Validate end-to-end in an Extension Development Host session: enable autonomy, dispatch `/intent`, observe streaming status, and confirm manual fallback still works.
