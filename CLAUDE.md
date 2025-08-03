# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository is a **comprehensive educational curriculum for MCP development** built around a world-class calculator server using STDIO transport. It serves as the definitive learning resource for the MCP community, combining a production-ready server implementation with structured learning materials, progressive exercises, and complete best practices guidance.

## Development Commands

### Core Development

- `npm install` - Install dependencies
- `npm start` - Run the MCP server (`dist/server.js --stdio`)
- `npm run dev` - Development mode with auto-reload
- `npm run build` - Build TypeScript to JavaScript
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run clean` - Remove dist directory

### Testing & Quality

- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix linting issues
- `npm run lint:ci` - Run ESLint with zero warnings enforced
- `npm run typecheck` - TypeScript type checking
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run check:quick` - Quick verification (typecheck + lint:ci + format:check)
- `npm run check:deep` - Deep verification with auto-fixes
- `npm run pipeline` - Full pipeline (clean + typecheck + lint:fix + lint:ci + format + format:check + build)
- `npm run smoke:stdio` - Test STDIO server startup/shutdown
- `npm run all` - Complete pipeline + smoke test

### MCP Inspection

- `npx @modelcontextprotocol/inspector --cli "node dist/server.js --stdio" --method tools/list` - List all 8 tools with schemas
- `npx @modelcontextprotocol/inspector --cli "node dist/server.js --stdio" --method prompts/list` - List all 3 prompts
- `npx @modelcontextprotocol/inspector --cli "node dist/server.js --stdio" --method resources/list` - List all 4 resources
- `npx @modelcontextprotocol/inspector --cli "node dist/server.js --stdio" --method resources/read --uri "calculator://constants"` - Read specific resource

### Manual Testing

- `echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"calculate","arguments":{"a":7,"b":6,"op":"multiply"}}}' | node dist/server.js --stdio` - Test MCP SDK server

## Architecture

### MCP SDK Implementation

The project provides a **single, production-ready MCP server implementation**:

- **`dist/server.js`** - MCP SDK server using standard `registerTool()`, `registerResource()`, `registerPrompt()` APIs
- Implements standard MCP protocol with `tools/list`, `tools/call`, `resources/list`, `prompts/list` methods
- Compatible with all MCP clients and registries including Smithery

### MCP Advanced Features Implementation

- **8 Tools**: `calculate`, `batch_calculate`, `advanced_calculate`, `demo_progress`, `solve_math_problem`, `explain_formula`, `calculator_assistant`, `maintenance_mode`
- **3 Prompts**: `explain-calculation`, `generate-problems`, `calculator-tutor` (all with completable arguments)
- **4 Resources**: `calculator://constants`, `calculator://stats`, `formulas://library`, `calculator://history/{id}` (with completion support)
- **Advanced SDK Features**: Progress notifications, interactive elicitation, dynamic lifecycle management, completable arguments

### State Management Architecture

- **Process Memory**: All state (calculation history, request counters, uptime) stored in-memory
- **Per-Process Isolation**: State resets when process exits (by design for STDIO transport)
- **History Limit**: Maximum 50 calculation entries stored
- **Resource Limits**: Batch operations limited to 100 items

### Protocol Architecture

- **STDIO Transport**: Pure stdin/stdout communication with newline-delimited JSON-RPC
- **Progress Notifications**: Real-time progress updates using `sendNotification` with `notifications/progress` method
- **Interactive Elicitation**: Dynamic user input collection via `server.server.elicitInput()` for ambiguous requests
- **Dynamic Lifecycle**: Runtime tool enable/disable with automatic `tools/list_changed` notifications
- **Completable Arguments**: Autocompletion support for prompt arguments using `completable()` wrapper
- **Exit Codes**: Standard Unix exit codes (0=success, 65=data error, 70=software error)
- **Error Handling**: Protocol-compliant `McpError` usage throughout

## Educational Curriculum Overview

**Important**: This is a complete educational curriculum designed for the MCP community, not just a code example.

### Learning Structure

- **3-Week Structured Path**: Fundamentals → Advanced Patterns → Production Readiness
- **4 Progressive Exercises**: From basic statistics to advanced interactive tools
- **12 Key Takeaways**: Specific learning outcomes covering all MCP concepts
- **Comprehensive Best Practices**: Deep dive into SDK patterns and common pitfalls
- **Production Deployment**: Real-world deployment and monitoring guidance

### Build Process & Quality

1. TypeScript source files in `src/` contain the full implementation
2. `npm run build` compiles to `dist/server.js` (production-ready)
3. Code is formatted with Prettier and validated with ESLint
4. Zero warnings/errors policy maintained
5. Use `npm start` or `node dist/server.js --stdio` to run the server

### Educational Content Structure

- **Core Learning Objectives**: 5 major areas (Architecture, Security, Protocol, Performance, Type Safety)
- **Advanced SDK Features**: Progress notifications, elicitation, lifecycle, completion
- **Testing & Validation**: Comprehensive testing strategy with MCP Inspector
- **Common Pitfalls**: 5 detailed pitfalls with solutions and explanations
- **Learning Path**: Week-by-week curriculum for systematic learning
- **Hands-on Exercises**: Progressive exercises building complexity

### SDK Patterns Demonstrated

- **Progress Notifications**: Access `sendNotification` from handler's second parameter
- **Interactive Elicitation**: Use `server.server.elicitInput()` for dynamic user input
- **Tool Lifecycle**: Store handles from `registerTool()` for runtime management
- **Completable Arguments**: Wrap schemas with `completable()` for autocompletion
- **Error Handling**: Use `McpError` with proper error codes throughout

## Testing Strategy

The test suite validates MCP server functionality:

- **Integration Tests**: Test the MCP SDK server functionality
- **Unit Tests**: Validate individual calculator operations
- **API Tests**: Ensure MCP protocol compliance

## Message Protocol Specifics

### Standard MCP Protocol Format

```
→ {"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"calculate","arguments":{"a":5,"b":3,"op":"add"}}}
{"result":{"content":[{"type":"text","text":"5 + 3 = 8"}]},"jsonrpc":"2.0","id":1}
```

## Key Educational Resources

- **`README.md`** - Complete educational curriculum (3-week learning path, 4 exercises, 12 takeaways)
- **`BEST_PRACTICES.md`** - Deep dive into SDK patterns and lessons learned from building world-class servers
- **`src/server.ts`** - Production-quality reference implementation showcasing all advanced features
- **`src/types.ts`** - Type definitions, schemas, and utility functions
- **`test-elicitation.md`** - Test cases for interactive elicitation feature
- **`dist/server.js`** - Compiled production server

## Progressive Exercise Curriculum

### Exercise 1: Statistics Tool (Type Safety & Registration)

- Goal: Master tool registration and type safety
- Task: Implement mean, median, mode, standard deviation
- Learning: Zod schemas, edge case handling

### Exercise 2: Persistent History (Resource Management)

- Goal: Advanced resource management
- Task: File-based history persistence with reload
- Learning: Async operations, resource lifecycle

### Exercise 3: Unit Conversion (Functionality Extension)

- Goal: Extend server capabilities systematically
- Task: Multi-unit conversion tool (length, weight, temperature)
- Learning: Complex business logic, conversion matrices

### Exercise 4: Guided Calculation (Advanced Interactive Features)

- Goal: Master all advanced SDK features combined
- Task: Multi-step wizard with elicitation, progress, and lifecycle management
- Learning: Complete integration of advanced patterns

## Advanced SDK Implementation Highlights

### Progress Notifications

```typescript
// Correct pattern: Access sendNotification from second parameter
async (params, { sendNotification }) => {
  await sendNotification({
    method: 'notifications/progress',
    params: { progressToken: id, progress: 50, message: 'Halfway' },
  });
};
```

### Interactive Elicitation

```typescript
// Correct pattern: Use server.server for base Server instance
const result = await server.server.elicitInput({
  message: 'Need more information',
  requestedSchema: {
    /* JSON Schema */
  },
});
```

### Dynamic Lifecycle Management

```typescript
// Correct pattern: Store handles for runtime control
const toolHandle = server.registerTool(/* ... */);
toolHandle.disable(); // Automatically sends tools/list_changed
```

### Completable Arguments

```typescript
// Correct pattern: Wrap schemas with completable
argsSchema: {
  topic: completable(z.string(), async (value) => suggestions);
}
```

## Educational Philosophy

This repository embodies the principle: **"Learn by building a world-class implementation."**

### What Makes This Special

- **Complete Curriculum**: Not just code, but a full learning experience
- **Community Resource**: Built for the entire MCP development community
- **Progressive Learning**: From basics to advanced patterns with guided exercises
- **Production Quality**: Real-world standards with zero technical debt
- **Best Practices**: Hard-won insights from building world-class MCP servers

### Learning Outcomes

After completing this curriculum, developers will master:

1. All 8 MCP tools with advanced features
2. 4 different resource types with completion support
3. Interactive prompts with completable arguments
4. Production deployment and monitoring
5. Advanced SDK patterns (progress, elicitation, lifecycle)
6. Common pitfalls and how to avoid them

The repository represents the gold standard for MCP education - a complete learning ecosystem that transforms beginners into experts through hands-on experience with production-quality code.

## 12 Key Learning Outcomes

After completing this curriculum, developers will master:

1. **Direct Zod schema usage** - No JSON Schema conversion needed
2. **Type safety throughout** - Let TypeScript do the work
3. **Simple state management** - Circular buffers over complex stores
4. **Protocol compliance** - Always use McpError
5. **Clean architecture** - Single responsibility principle
6. **Resource completion** - Enhanced user experience
7. **Proper logging** - stderr for logs, stdout for protocol
8. **Process isolation** - Natural security boundary
9. **Progress notifications** - Real-time feedback with sendNotification
10. **Interactive elicitation** - Dynamic user input via server.server.elicitInput
11. **Dynamic lifecycle** - Runtime tool management with handles
12. **Completable arguments** - Autocompletion for better UX

## Repository Mission

**Built with ❤️ as an educational reference for the MCP community**

This repository exists to accelerate MCP adoption by providing a complete, world-class learning experience. It demonstrates that building sophisticated MCP servers is achievable when you trust the SDK, follow best practices, and focus on user experience over complexity.
