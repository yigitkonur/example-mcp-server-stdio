# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository implements a **learning-edition MCP calculator server using STDIO transport**. It demonstrates the Model Context Protocol (MCP) with standard JSON-RPC communication over stdin/stdout using the official MCP SDK.

## Development Commands

### Core Development
- `npm install` - Install dependencies 
- `npm start` - Run the MCP server (`dist/server.js --stdio`)
- `npm run dev` - Development mode with auto-reload
- `npm run build` - Build TypeScript to JavaScript (may fail due to legacy API usage)
- `npm run clean` - Remove dist directory

### Testing & Quality
- `npm test` - Run all tests (3/4 pass, 1 skipped progress test)
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix linting issues
- `npm run typecheck` - TypeScript type checking

### MCP Inspection
- `npx @modelcontextprotocol/inspector --cli "node dist/server.js --stdio" --method tools/list` - List all 7 tools with schemas  
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

### MCP Golden Standard Features
- **7 Tools**: `calculate`, `batch_calculate`, `advanced_calculate`, `demo_progress`, `solve_math_problem`, `explain_formula`, `calculator_assistant`
- **3 Prompts**: `explain-calculation`, `generate-problems`, `calculator-tutor` 
- **4 Resources**: `calculator://constants`, `calculator://stats`, `formulas://library`, `calculator://history/{id}`

### State Management Architecture
- **Process Memory**: All state (calculation history, request counters, uptime) stored in-memory
- **Per-Process Isolation**: State resets when process exits (by design for STDIO transport)
- **History Limit**: Maximum 50 calculation entries stored
- **Resource Limits**: Batch operations limited to 100 items

### Protocol Architecture
- **STDIO Transport**: Pure stdin/stdout communication with newline-delimited JSON-RPC
- **Progress Notifications**: Long-running operations emit progress updates via JSON-RPC notifications
- **Exit Codes**: Standard Unix exit codes (0=success, 65=data error, 70=software error)
- **Concurrent Processing**: Maintains `Map<id, PromiseResolver>` for in-flight requests

## TypeScript Compilation Issues

**Important**: The TypeScript source files use legacy MCP SDK APIs and will fail compilation. The working JavaScript files are committed to `dist/` and should be used directly. When making changes:

1. Edit the working JavaScript files in `dist/` directly
2. Do not rely on `npm run build` - it will fail due to API version mismatches
3. The `src/` TypeScript files are reference implementations but not actively built

## Testing Strategy

The test suite focuses on STDIO transport validation:
- **stdio-transport.test.ts**: Tests the custom JSON-RPC server directly via process spawning
- **Progress Test Skipped**: The `demo_progress` test is intentionally skipped due to timeout issues
- **3/4 Tests Pass**: Basic calculate, batch calculate, and error handling tests all pass

## Message Protocol Specifics

### Standard MCP Protocol Format
```
→ {"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"calculate","arguments":{"a":5,"b":3,"op":"add"}}}
{"result":{"content":[{"type":"text","text":"5 + 3 = 8"}]},"jsonrpc":"2.0","id":1}
```

## Key Implementation Files

- **`dist/server.js`** - MCP SDK server (production-ready)
- **`src/tests/stdio-transport.test.ts`** - Integration tests for STDIO protocol
- **`mcp-demo-manifest.json`** - Feature matrix documentation

The server is built with the MCP SDK and uses standard protocol methods for maximum compatibility.