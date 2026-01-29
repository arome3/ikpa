# IKPA Feature Implementation Prompt

Use this prompt template when asking Claude Code to implement a feature from the implementation guides.

---

## Prompt Template

```
Implement the feature described in: docs/implementation/11-opik-optimizer.md

## Context
This is part of the IKPA (Intelligent Knowledge-Powered Assistant) hackathon project - an AI-powered financial coaching app targeting the "Commit to Change" hackathon with a maximum prize of $10,000.

## Implementation Requirements

### 1. Pre-Implementation Analysis
Before writing any code:
- Read the entire implementation guide thoroughly
- Identify all dependencies listed in the guide and verify they exist in the codebase
- Review existing patterns in `apps/api/src/modules/` for consistency
- Check `apps/api/prisma/schema.prisma` for any required database models
- Note all interfaces, types, and API routes specified

### 2. Code Quality Standards
Implement with production-grade quality:

**Architecture:**
- Follow NestJS module/service/controller pattern strictly
- Use dependency injection for all services
- Implement proper separation of concerns
- Follow the existing project structure in `apps/api/src/modules/`

**TypeScript:**
- Use strict typing - no `any` types unless absolutely necessary
- Define all interfaces in dedicated `.interface.ts` or `.dto.ts` files
- Use enums for finite sets of values
- Implement proper generics where applicable

**Error Handling:**
- Create custom exception classes extending NestJS HttpException
- Implement comprehensive try-catch blocks
- Return meaningful error messages with appropriate HTTP status codes
- Log errors with context using NestJS Logger

**Validation:**
- Use class-validator decorators on all DTOs
- Implement custom validators for business logic
- Sanitize all user inputs
- Validate environment variables on startup

**Security:**
- Never expose sensitive data in responses
- Implement proper authorization checks
- Use parameterized queries (Prisma handles this)
- Validate and sanitize all inputs

### 3. Required File Structure
Create files following this pattern:
```

apps/api/src/modules/{feature-name}/
├── {feature-name}.module.ts # NestJS module definition
├── {feature-name}.service.ts # Business logic
├── {feature-name}.controller.ts # API routes
├── dto/
│ ├── create-{entity}.dto.ts # Input validation
│ └── {entity}-response.dto.ts # Response types
├── interfaces/
│ └── {feature-name}.interface.ts
├── {feature-name}.constants.ts # Constants and config
└── **tests**/
├── {feature-name}.service.spec.ts
└── {feature-name}.controller.spec.ts

```

### 4. Opik Integration (CRITICAL)
Every feature MUST include Opik distributed tracing:
- Create traces for all major operations
- Add spans for each logical step (tool, llm, retrieval types)
- Include meaningful metadata in all traces
- Call `await opikService.flush()` after trace completion
- Follow patterns from `01-opik-integration.md`

### 5. Database Integration
If the feature requires data persistence:
- Add Prisma models to `apps/api/prisma/schema.prisma`
- Run `npx prisma generate` after schema changes
- Create a migration with `npx prisma migrate dev --name {feature_name}`
- Use Prisma transactions for multi-step operations
- Implement proper relations and indexes

### 6. API Documentation
- Add Swagger decorators to all controllers:
  - `@ApiTags()` for grouping
  - `@ApiOperation()` for descriptions
  - `@ApiResponse()` for response types
  - `@ApiBody()` for request bodies
  - `@ApiBearerAuth()` for protected routes
- Document all DTOs with `@ApiProperty()` decorators

### 7. Testing Requirements
Write comprehensive tests:

**Unit Tests:**
- Test all service methods
- Mock external dependencies (database, external APIs)
- Test edge cases and error conditions
- Aim for >80% code coverage

**Integration Tests:**
- Test API endpoints with supertest
- Test database operations
- Test authentication/authorization

### 8. Implementation Checklist Compliance
Complete EVERY item in the implementation guide's checklist section. Mark each as done by:
- Creating the specified files
- Implementing the specified functionality
- Adding the specified tests
- Verifying with the provided curl commands

### 9. Verification
After implementation:
- Run all curl commands from the guide and verify expected responses
- Ensure Opik traces appear in the dashboard
- Run `npm run lint` and fix any issues
- Run `npm run test` and ensure all tests pass
- Run `npm run build` and ensure no compilation errors

## Output Format

Provide your implementation in this order:
1. **Analysis**: Brief summary of what you understood from the guide
2. **Dependencies Check**: List any missing dependencies you need to create first
3. **Database Schema**: Any Prisma model additions (if applicable)
4. **Implementation**: All code files with full implementations
5. **Tests**: Unit and integration tests
6. **Verification**: Run the curl commands and show results

## Important Notes

- Do NOT skip any part of the implementation guide
- Do NOT create placeholder/stub implementations - implement fully
- Do NOT ignore error handling or edge cases
- Do NOT skip Opik tracing integration
- Do NOT skip tests
- FOLLOW the exact API routes specified in the guide
- FOLLOW the exact interfaces/types specified in the guide
- USE the exact Opik metrics specified in the guide

## Reference Files
Before implementing, read these for context:
- `apps/api/src/app.module.ts` - See how modules are registered
- `apps/api/src/modules/auth/` - Reference for auth patterns
- `apps/api/src/common/` - Shared utilities and decorators
- `packages/shared/src/types/` - Shared type definitions
- `docs/HACKATHON_STRATEGY.md` - Full context on the project

Now implement the feature from docs/implementation/11-opik-optimizer.md following all requirements above.
```

---

## Usage Examples

### Example 1: Implement Opik Integration (Foundation)

```
Implement the feature described in: docs/implementation/01-opik-integration.md

[... rest of prompt ...]
```

### Example 2: Implement Cash Flow Score

```
Implement the feature described in: docs/implementation/02-cash-flow-score.md

[... rest of prompt ...]
```

### Example 3: Implement Shark Auditor Agent

```
Implement the feature described in: docs/implementation/05-gps-rerouter.md

[... rest of prompt ...]
```

---

## Recommended Implementation Order

Follow this order to respect dependencies:

| Order | Feature File              | Why This Order                           |
| ----- | ------------------------- | ---------------------------------------- |
| 1     | `01-opik-integration.md`  | Foundation - all features depend on this |
| 2     | `02-cash-flow-score.md`   | Core metric, needed by simulation        |
| 3     | `03-simulation-engine.md` | Powers Future Self and GPS Re-Router     |
| 4     | `04-shark-auditor.md`     | First agent, standalone after Opik       |
| 5     | `06-commitment-device.md` | Standalone after Opik                    |
| 6     | `05-gps-rerouter.md`      | Depends on Simulation Engine             |
| 7     | `07-future-self.md`       | Depends on Simulation Engine             |
| 8     | `08-ubuntu-manager.md`    | Depends on Cash Flow Score               |
| 9     | `09-g-eval-metrics.md`    | Depends on Opik, needed by Optimizer     |
| 10    | `10-story-cards.md`       | Depends on Future Self and Commitment    |
| 11    | `11-opik-optimizer.md`    | Depends on G-Eval Metrics                |

---

## Quick Copy-Paste Version

```
Implement the feature described in: docs/implementation/02-cash-flow-score.md

Context: IKPA is an AI-powered financial coaching app for the "Commit to Change" hackathon ($10K prize).

Requirements:
1. Read the ENTIRE implementation guide before coding
2. Follow NestJS module/service/controller patterns
3. Use strict TypeScript typing (no `any`)
4. Implement comprehensive error handling with custom exceptions
5. Add class-validator decorators on all DTOs
6. MUST include Opik distributed tracing (traces + spans + flush)
7. Add Prisma models if data persistence needed
8. Add full Swagger documentation
9. Write unit tests with >80% coverage
10. Complete EVERY checklist item in the guide
11. Verify with provided curl commands

File structure:
apps/api/src/modules/{feature}/
├── {feature}.module.ts
├── {feature}.service.ts
├── {feature}.controller.ts
├── dto/
├── interfaces/
└── __tests__/

Reference existing code in:
- apps/api/src/modules/auth/ (patterns)
- apps/api/src/common/ (utilities)
- apps/api/prisma/schema.prisma (database)

CRITICAL: Do NOT create stubs. Implement FULLY with all error handling, validation, tracing, and tests.

Now implement the feature following the guide exactly.
```

---

## Advanced: Multi-Feature Session Prompt

Use this when implementing multiple related features in one session:

```
I need to implement multiple related IKPA features. Process them in dependency order.

Features to implement:
1. docs/implementation/01-opik-integration.md
2. docs/implementation/02-cash-flow-score.md
3. docs/implementation/03-simulation-engine.md

For EACH feature:
1. Read the implementation guide completely
2. Verify dependencies from previous features exist
3. Implement fully with all requirements (typing, errors, Opik, tests, Swagger)
4. Verify with curl commands before proceeding to next feature
5. Show a summary of what was implemented

After ALL features:
- Run full test suite
- Run linter
- Run build
- Show final verification summary

Do NOT proceed to the next feature until the current one is fully working and verified.
```
