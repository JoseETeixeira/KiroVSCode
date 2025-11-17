# Requirements: Autonomous MCP Flow Enhancements

**Document Information**  
- **Feature Name:** Autonomous MCP Flow Enhancements  
- **Version:** 1.0  
- **Date:** 2025-11-17  
- **Author:** Kiro  
- **Stakeholders:** VS Code extension maintainers, Spec-mode users, AI workflow architects

## Introduction
Spec-driven work is currently orchestrated manually: users prompt @kiro, copy generated MCP commands, and trigger tasks themselves. To lower the friction for autonomous flows, we need richer coordination between the VS Code extension, the packaged MCP server, and the prompts/instructions that describe how agents should behave. This feature introduces actionable metadata and workflow hooks so the extension can express user intent (e.g., "continue executing the next task") to the MCP server without forcing the user to manually copy commands. It also updates the instruction files and agent definitions to describe when autonomous execution is safe, how approvals work, and how tasks should be chained.

## Feature Summary
Enable proactive, autonomous MCP/tool execution by enriching the instructions, agent definitions, and extension glue so tasks can transition seamlessly with minimal user intervention.

## Business Value
- Minimizes context switches and manual command-copying for spec-driven flows.  
- Encourages consistent adherence to approval gates by encoding the policy directly into instructions.  
- Prepares the extension for future VS Code / Copilot capabilities that allow trusted participants to run MCP tools directly.

## Scope
- **Included:** Updating `.github/instructions`, agent metadata, and prompt files; adding structured capability declarations so @kiro knows when to propose autonomous runs; extending the extension-to-MCP messaging pipeline to express user intent (continue/abort).  
- **Excluded:** Implementing direct Copilot chat submission (not supported today); modifying MCP server core logic beyond what is needed to consume new metadata; changing non-Kiro instructions.

---

## Requirements

### Requirement 1: Enrich instructions with autonomy policies
**User Story:** As a spec-mode user, I want the instruction bundle to describe when autonomous execution is allowed so that Kiro can act without repeatedly asking for confirmation.

**Acceptance Criteria (EARS)**  
- WHEN the instructions are copied into `.github/instructions` THEN the system SHALL include a section that enumerates approved autonomous actions (e.g., continue next task, re-run failed task).  
- IF an autonomous action requires user consent THEN the system SHALL specify the explicit phrase the user must issue (e.g., "@kiro continue autonomously").  
- WHERE no consent has been captured THEN the instructions SHALL state that manual confirmation is required before each tool invocation.  
- WHILE instructions evolve over time the extension SHALL version them so MCP workflows can detect compatibility.

**Additional Details**  
- **Priority:** High  
- **Complexity:** Medium  
- **Dependencies:** Prompt package updates  
- **Assumptions:** Users will keep instructions synced via the setup command

### Requirement 2: Update agent and prompt files to advertise tool capabilities
**User Story:** As the @kiro chat participant, I want the agent and prompt files to declare which MCP tools can be chained autonomously so that the language model can select the correct workflow without manual scaffolding.

**Acceptance Criteria (EARS)**  
- WHEN prompts are loaded THEN they SHALL include metadata (front matter or explicit sections) listing available MCP commands, their prerequisites, and the approval signals they honor.  
- IF a prompt references a tool THEN it SHALL describe what inputs it expects (workspace path, spec slug, etc.) so the MCP server can validate calls.  
- WHERE a prompt previously instructed the user to copy text manually THEN it SHALL be rewritten to prefer direct MCP invocations.  
- WHEN agent definitions are updated THEN they SHALL mention autonomous flow support in the description and disambiguation entries.

**Additional Details**  
- **Priority:** High  
- **Complexity:** High  
- **Dependencies:** Requirement 1  
- **Assumptions:** VS Code + Copilot continue to route @kiro requests normally

### Requirement 3: Express intent from the extension into the MCP server
**User Story:** As a developer running `@kiro /task` or using the tree view, I want my chosen action to be relayed to the MCP server as structured intent so that the agent can execute the right tool sequence autonomously.

**Acceptance Criteria (EARS)**  
- WHEN the user starts a task from the extension UI THEN the system SHALL invoke @kiro with an intent payload that lists the spec folder, task id, and desired action (e.g., executeTask next).  
- IF the MCP server acknowledges the intent THEN the extension SHALL display a confirmation message so the user knows autonomy is active.  
- IF the MCP server rejects the intent (missing approval, incompatible instructions) THEN the extension SHALL fall back to the existing manual copy flow with an explanatory warning.  
- WHILE autonomy is active THEN the extension SHALL surface status updates (e.g., in the task tree or notifications) using the messages returned by the MCP server.

**Additional Details**  
- **Priority:** Medium  
- **Complexity:** High  
- **Dependencies:** Requirements 1 & 2  
- **Assumptions:** MCP server exposes an API/command to accept intent metadata

---

### Requirement 4: Capture and relay LLM execution context
**User Story:** As an agent developer, I want MCP tools to invoke the same LLM used by the agent with the supplied user message so that the agent receives the model’s response and can reference that execution context.

**Acceptance Criteria (EARS)**  
- WHEN an MCP tool (e.g., `kiro_execute_task`, `kiro_create_requirements`) receives an intent payload with a user message THEN the system SHALL forward that message to the configured LLM using the prompt template referenced by the tool.  
- IF the LLM call succeeds THEN the system SHALL return the generated response text back to the calling tool/agent along with any tool execution metadata (token count, latency).  
- IF the LLM call fails (timeout, quota, validation) THEN the system SHALL include a structured error code and fallback guidance in the MCP response so the extension can surface it to the user.  
- WHILE the LLM invocation is running THEN the system SHALL stream intermediate status updates (queued, running, completed) to the agent so it can reflect progress in the UI.  
- WHERE a tool invocation lacks permission to execute autonomously THEN the system SHALL block the LLM call and respond with a consent-required error.

**Additional Details**  
- **Priority:** High  
- **Complexity:** High  
- **Dependencies:** Requirements 1-3 (policy metadata, prompt declarations, intent pipeline)  
- **Assumptions:** MCP server can invoke the workspace-configured LLM endpoint and expose the response via its tool API

---

## Non-Functional Requirements

**Performance Requirements**  
- WHEN transmitting intent metadata THEN the system SHALL do so in under 250 ms to keep chat interactions responsive.  
- IF multiple intents are queued THEN the system SHALL process them sequentially to avoid race conditions.

**Security Requirements**  
- WHEN enabling autonomous actions THEN the system SHALL ensure they only run inside the active workspace directory.  
- IF an intent would modify files outside the workspace THEN the system SHALL reject the action and notify the user.

**Usability Requirements**  
- WHEN autonomy is available THEN the UI SHALL clue the user via badges or labels (e.g., "Autonomy enabled").  
- IF autonomy is disabled (policy or unsupported version) THEN the UI SHALL provide remediation guidance.

**Reliability Requirements**  
- WHEN the MCP server is unreachable THEN the system SHALL queue or cancel the intent gracefully without freezing the UI.  
- IF the instructions/prompt versions mismatch THEN the system SHALL prompt the user to rerun setup before proceeding.

---

## Constraints and Assumptions

**Technical Constraints**  
- Must operate within current VS Code + GitHub Copilot APIs (no programmatic chat submission).  
- Requires backwards compatibility with existing manual flow until users adopt the new prompts.

**Business Constraints**  
- Feature should ship in the next minor release to support early adopters of autonomous flows.  
- Documentation updates must accompany the change so teams understand the new consent model.

**Assumptions**  
- Users accept that autonomy is opt-in per session.  
- MCP server enhancements (intent endpoint) can be implemented within the same release train.

---

## Success Criteria

**Definition of Done**  
- Updated instructions, agent definitions, and prompts are distributed via the setup command.  
- Extension successfully relays intent metadata and handles accept/reject paths.  
- Manual fallback remains functional.  
- Documentation covers autonomy usage and consent flow.

**Acceptance Metrics**  
- At least one end-to-end autonomous execution scenario validated in Extension Dev Host.  
- Zero regressions in manual prompting workflows.  
- User feedback indicates clarity about when autonomy is on/off.

---

## Glossary

| Term | Definition |
| --- | --- |
| Autonomous flow | MCP-driven execution that proceeds without the user re-copying commands between steps |
| Intent payload | Structured metadata sent from the extension to the MCP server describing the desired action |
| Consent phrase | Explicit command wording that grants permission for autonomous execution |

---

## Requirements Review Checklist

**Completeness**  
- All user stories have clear roles and benefits ✅  
- Acceptance criteria use EARS syntax ✅  
- Non-functional requirements covered ✅  
- Success criteria defined ✅

**Quality**  
- Requirements use active voice ✅  
- Each acceptance criterion is testable ✅  
- Terminology consistent ✅

**EARS Format Validation**  
- WHEN/IF/WHILE/WHERE statements present ✅  
- SHALL used for system responses ✅

**Clarity**  
- Requirements unambiguous ✅  
- Glossary included ✅

**Traceability**  
- Requirements numbered and organized ✅  
- Dependencies listed ✅
