# Example Tasks

This is an example `tasks.md` file that demonstrates how the Kiro extension detects and provides context for tasks.

## Active Tasks

- [ ] 1. Implement user authentication system
  - Add login/logout functionality
  - Integrate with OAuth providers
  - Add session management

- [ ] 2. Create product review feature
  - User story: As a customer, I want to submit ratings and comments
  - Include star rating (1-5)
  - Add comment field with validation

- [ ] 3. Add search functionality
  - Full-text search across products
  - Filter by category
  - Sort by relevance

- [x] 4. Setup database migrations
  - Created initial schema
  - Added user and product tables

## Spec Mode Example

When you open this file in **Spec mode**, the extension will:

1. Read the requirements.prompt.md file
2. Guide you through creating a formal requirements specification
3. Create a directory structure in `.kiro/specs/[feature-name]/`
4. Generate a `requirements.md` file with EARS syntax

## Vibe Mode Example

When you open this file in **Vibe mode**, the extension will:

1. Help you explore the task interactively
2. Iterate quickly on implementation
3. Focus on rapid testing and feedback

## How to Use

1. **Switch modes:**
   - Use Command Palette: "Kiro: Select Coding Mode"
   - Or use chat: `@kiro /vibe` or `@kiro /spec`

2. **Start a task:**
   - Open the Kiro Assistant panel
   - Find the Task Context view
   - Click on any task to begin

3. **Let the mode guide you:**
   - Spec mode → Requirements → Design → Implementation
   - Vibe mode → Explore → Iterate → Refine

## Task Format Support

The extension recognizes:

- Markdown checkboxes: `- [ ] task`
- Completed tasks: `- [x] task`
- Numbered tasks: `1. task description`
- Combined: `- [ ] 1. task description`
