# AGENTS.md

## Project Overview

This project is a Magic: The Gathering deck-tracking website. Users can create accounts, save Commander deck data, and view information and statistics about their decks.

AI agents working in this repository must follow the existing project stack and coding style. Do not introduce new languages, frameworks, or major architectural patterns unless explicitly requested by the project owner.

## Tech Stack

Use only the following core technologies unless instructed otherwise:

- Frontend: React
- Frontend build tooling: Vite
- Backend: ASP.NET / C#
- Database: SQL using the existing project schema and seed structure

Do not replace or bypass this stack with alternatives such as Next.js, Express, Flask, Django, Ruby on Rails, Java Spring, PHP, or other frameworks unless specifically asked.

## General Development Rules

1. Keep the code simple.
   - Prefer readable, direct solutions over clever or overly abstract code.
   - Avoid unnecessary layers, helpers, services, or patterns unless they clearly improve maintainability.
   - Do not over-engineer features.

2. Follow the existing project structure.
   - Place files where similar files already live.
   - Match naming conventions already used in the project.
   - Reuse existing components, services, models, DTOs, database utilities, and patterns where reasonable.

3. Stay within the requested scope.
   - Only change files that are relevant to the task.
   - Do not refactor unrelated code.
   - Do not add unrelated features.
   - Do not rename existing files, tables, routes, or variables unless the task requires it.

4. Prefer maintainable code.
   - Use clear names for variables, functions, components, classes, methods, and files.
   - Keep functions and components focused on one responsibility.
   - Avoid deeply nested logic when early returns or smaller helper functions would be clearer.
   - Remove dead code instead of leaving it commented out.

5. Preserve working behavior.
   - Do not break existing routes, API contracts, database relationships, or frontend behavior.
   - When modifying existing behavior, keep changes backward-compatible unless the project owner asks for a breaking change.

## Commenting Requirements

AI agents must comment their code so that it is easy to understand what each important section does.

Use comments to explain:

- The purpose of components, classes, methods, and functions.
- Non-obvious logic.
- API request and response handling.
- Database relationships or query assumptions.
- Validation rules.
- Any business logic specific to Magic: The Gathering deck data.

Do not over-comment obvious language syntax. For example, avoid comments like `// increments i by 1` unless the reason for incrementing is important.

Good comment example:

```csharp
// Ensures the selected color identity exists before attaching it to the deck.
// This prevents decks from referencing invalid color identity records.
```

Poor comment example:

```csharp
// Set name to name.
deck.Name = name;
```

## Frontend Guidelines

Frontend work must use React with Vite.

Follow these rules:

- Use functional React components.
- Prefer hooks for state and lifecycle behavior.
- Keep components small and focused.
- Move reusable UI pieces into shared components when reuse is clear.
- Keep API calls organized in service or utility files if the project already uses that pattern.
- Avoid introducing large state-management libraries unless explicitly requested.
- Use clear loading, error, and empty states when fetching data.
- Keep forms simple and readable.
- Validate user input before sending it to the backend when practical.

React comments should clarify component purpose, data flow, and non-obvious rendering decisions.

Example:

```jsx
// Displays a summary card for a saved Commander deck.
// The color identity and archetype values are already resolved by the API.
function DeckCard({ deck }) {
  return (
    <article>
      <h2>{deck.name}</h2>
      <p>{deck.commander}</p>
    </article>
  );
}
```

## Backend Guidelines

Backend work must use ASP.NET and C#.

Follow these rules:

- Use existing controller, service, model, and DTO patterns when present.
- Keep controllers focused on HTTP concerns.
- Put business logic in services when the project structure supports it.
- Use async database calls where appropriate.
- Validate incoming request data.
- Return appropriate HTTP status codes.
- Avoid exposing sensitive data, especially password hashes.
- Never store plain-text passwords.
- Keep authentication and authorization logic consistent with the existing project.

C# comments should explain intent, validation decisions, and non-obvious logic.

Example:

```csharp
// Only the owner of the deck or an admin can update deck details.
// This prevents users from editing another user's saved deck.
if (!isOwner && !isAdmin)
{
    return Forbid();
}
```

## Database Guidelines

Database work should follow the existing SQL schema and seed conventions.

Follow these rules:

- Preserve relationships between users, decks, archetypes, and color identities.
- Use foreign keys where relationships exist.
- Do not duplicate color or archetype names directly in the decks table if the normalized table already exists.
- Keep seed data realistic and useful for development.
- Avoid destructive migrations or schema changes unless explicitly requested.
- When changing schema, also update seed data and any affected backend models or DTOs.

For Magic color identity logic:

- Use the existing color identity records rather than inventing new ad hoc color formats.
- Use the standard MTG color letters: `W`, `U`, `B`, `R`, `G`.
- Colorless should be represented consistently with the existing database design.
- For statistics, count individual color flags from the color identity data rather than parsing free-text deck descriptions.

## API Design Guidelines

When adding or modifying API endpoints:

- Use clear REST-style route names.
- Keep request and response shapes simple.
- Use DTOs instead of exposing database entities directly when appropriate.
- Validate IDs before using them.
- Return `404 Not Found` when a requested record does not exist.
- Return `400 Bad Request` for invalid input.
- Return `401 Unauthorized` or `403 Forbidden` for authentication and authorization failures.
- Do not return password hashes, internal security fields, or unnecessary private user data.

## Security Guidelines

AI agents must avoid introducing security risks.

Follow these rules:

- Never store or return plain-text passwords.
- Never log passwords, tokens, secrets, or private credentials.
- Use password hashing through the existing backend authentication approach.
- Validate and sanitize user input where appropriate.
- Use authorization checks before allowing users to read, update, or delete private deck data.
- Do not hard-code secrets, API keys, database credentials, or connection strings.

## Style and Formatting

Follow the formatting already present in the repository.

General style rules:

- Use consistent indentation.
- Keep line lengths reasonable.
- Use meaningful names instead of abbreviations.
- Prefer clarity over cleverness.
- Remove unused imports, variables, and code.
- Keep commits and changes focused.

For C#:

- Use PascalCase for classes, methods, and public properties.
- Use camelCase for local variables and parameters.
- Prefer explicit models and DTOs over loosely typed objects.

For React/JavaScript:

- Use PascalCase for components.
- Use camelCase for variables and functions.
- Keep JSX readable.
- Avoid large inline logic blocks inside JSX when helper variables would be clearer.

## Testing and Verification

When making changes, AI agents should verify the work when possible.

Recommended checks:

- Run the frontend build or tests if available.
- Run backend build or tests if available.
- Confirm API routes still match frontend usage.
- Confirm database changes align with models and seed data.
- Check that new code handles loading, error, and empty states.

If tests or build commands are not available, mention that verification was limited and explain what was checked manually.

## Documentation Expectations

When adding features or changing behavior:

- Update comments in code where needed.
- Update README or setup documentation if commands, environment variables, routes, or database setup steps change.
- Keep documentation simple and accurate.

## Things AI Agents Should Not Do

Do not:

- Rewrite the project in another stack.
- Add a new frontend framework.
- Add a new backend framework.
- Add unnecessary dependencies.
- Store passwords in plain text.
- Expose password hashes in API responses.
- Refactor unrelated files.
- Change database relationships without updating affected code.
- Remove comments that explain important logic.
- Generate large, complex abstractions when simple code would work.

## Preferred Working Approach

When completing a task, AI agents should:

1. Review the relevant existing files first.
2. Identify the smallest safe change that solves the task.
3. Implement the change using React, Vite, ASP.NET, C#, and SQL as appropriate.
4. Add clear comments for important logic.
5. Keep code simple and readable.
6. Run available checks.
7. Summarize what changed and mention any verification limitations.

