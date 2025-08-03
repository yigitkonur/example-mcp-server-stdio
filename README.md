<div align="center">

**[STDIO](https://github.com/yigitkonur/example-mcp-server-stdio) | [Stateful HTTP](https://github.com/yigitkonur/example-mcp-server-streamable-http) | [Stateless HTTP](https://github.com/yigitkonur/example-mcp-server-streamable-http-stateless) | [SSE](https://github.com/yigitkonur/example-mcp-server-sse)**

</div>

---

# 🎓 MCP STDIO Server - Educational Reference

<div align="center">

**A Production-Ready Model Context Protocol Server Teaching STDIO Transport and Process Isolation Best Practices**

[![MCP Version](https://img.shields.io/badge/MCP-1.0.0-blue)](https://modelcontextprotocol.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![SDK](https://img.shields.io/badge/SDK-Production%20Ready-green)](https://github.com/modelcontextprotocol/typescript-sdk)
[![Architecture](https://img.shields.io/badge/Architecture-Process%20Based-gold)]()

_Learn by building a world-class MCP server with a focus on security, simplicity, and architectural resilience._

</div>

## 🎯 Project Goal & Core Concepts

This repository is a **deeply educational reference implementation** that demonstrates how to build a production-quality MCP server using the **STDIO (Standard I/O)** transport. It is the definitive guide for creating secure, efficient, and resilient locally-running tools.

Through a fully-functional calculator server, this project will teach you:

1.  **🏗️ Clean Architecture & Design**: Master a layered architecture that separates business logic, protocol wiring, and state management, making the code maintainable and testable.
2.  **⚙️ Protocol & Transport Mastery**: Correctly implement the `StdioServerTransport` by learning the critical distinction between the `stdout` stream (for JSON-RPC messages) and the `stderr` stream (for all logging).
3.  **🛡️ Resilient Error Handling**: Implement a "fail-fast" error philosophy using `McpError` to ensure predictable, protocol-compliant failure states and prevent leaking internal details.
4.  **🔒 Inherent Security**: Leverage the **natural security boundary of process isolation**, which prevents network-based attacks and contains the server in a secure sandbox provided by the operating system.

## 🤔 When to Use This Architecture

The STDIO transport is the simplest and most secure MCP transport. Its process-based architecture makes it the ideal choice for:

- **IDE & Editor Extensions:** Integrating AI-powered tools directly into development environments like VS Code.
- **Command-Line Tools (CLIs):** Building powerful, local command-line applications that leverage LLMs.
- **Desktop Applications:** Embedding MCP capabilities into native desktop applications as managed subprocesses.
- **Secure Local Agents:** Any scenario where tools must run locally without exposing network ports, ensuring maximum security and data privacy.

## 🚀 Quick Start

### Prerequisites

- Node.js ≥ 20.0.0
- npm or yarn
- A basic understanding of how parent/child processes communicate.

### Installation & Running

```bash
# Clone the repository
git clone https://github.com/yigitkonur/example-mcp-server-stdio
cd example-mcp-server-stdio

# Install dependencies
npm install

# Build the project (compiles TypeScript to dist/)
npm run build
```

### Essential Commands

```bash
npm run dev        # Development mode with hot-reload (uses tsx)
npm run build      # Compile TypeScript to JavaScript in `dist/`
npm run start      # Run the compiled server (listens on stdio)
npm run lint       # Run code quality checks with ESLint
npm run typecheck  # Run the TypeScript compiler for type checking
npm run pipeline   # Full build pipeline with zero-warning enforcement
npm run all        # Complete pipeline + smoke test verification
```

## 📐 Architecture Overview

### High-Level Principles

1.  **Process Isolation:** The server is a separate OS process, providing a hardware-enforced security boundary.
2.  **Stream-Based Communication:** All protocol messages are newline-delimited JSON-RPC 2.0 objects exchanged over `stdin` and `stdout`.
3.  **Dedicated Logging Channel:** All non-protocol output (logs, debug messages) **must** be written to `stderr`.
4.  **Zero Network Footprint:** The server does not open any network ports, eliminating entire classes of vulnerabilities.

### Architectural Diagram

```
┌─────────────────┐   stdin (JSON-RPC)   ┌──────────────────┐
│                 │ ───────────────────> │                  │
│   MCP Client    │                      │   MCP Server     │
│   (Parent)      │ <─────────────────── │   (Subprocess)   │
│                 │  stdout (JSON-RPC)   │                  │
└─────────────────┘                      └──────────────────┘
```

### Code Structure

The source code is intentionally structured for clarity and maintainability.

- `src/types.ts`: Contains only pure data structures, static constants, and the global logger. It acts as the project's stable "header file."
- `src/server.ts`: The single source of truth for all logic, organized into clear, layered sections:
  1.  **Global State:** Defines the server's in-memory state (e.g., `calculationHistory`).
  2.  **Core Business Logic:** Contains pure, testable functions (e.g., `factorial`, `performBasicCalculation`) that are completely unaware of the MCP protocol.
  3.  **MCP Wiring:** A set of `register...` functions that connect the business logic to the MCP SDK, defining tools, resources, and prompts. This is where the application's capabilities are composed.
  4.  **Execution:** The `main` function that bootstraps the server, handles the process lifecycle, and implements graceful shutdown.

## 🔧 World-Class Best Practices

This server is built on a foundation of non-negotiable best practices for creating professional, resilient software.

### 1. Architecture: Composition over Configuration

Instead of a single, monolithic function, the server's capabilities are built using a clean, compositional pattern. The main `createCalculatorServer` factory assembles the final server by calling a series of dedicated, single-responsibility functions.

**The Principle:** This pattern makes the server's features immediately discoverable by reading the factory's body. It's organized, scalable, and easy to reason about.

```typescript
// ✅ In src/server.ts
export async function createCalculatorServer() {
  // 1. Create the server instance
  const server = new McpServer(...);

  // 2. Compose the server's capabilities by calling focused functions
  registerCoreTools(server);
  registerExtendedTools(server);
  registerResources(server);
  registerPrompts(server);
  registerManagementTools(server);

  // 3. Return the fully configured server
  return server;
}
```

### 2. Logic: Co-location of Schemas and Handlers

Each tool, resource, or prompt is defined as a self-contained unit. Its Zod schema, metadata, and handler logic are co-located, making the code easy to understand, modify, and test.

**The Principle:** A developer should be able to understand everything about a tool by looking at a single, focused block of code, without hunting through other files.

```typescript
// ✅ In src/server.ts inside a registration function
const calculateInputSchema = { a: z.number() /* ... */ };
const calculateOutputSchema = { value: z.number() /* ... */ };

server.registerTool(
  'calculate',
  {
    title: 'Calculate',
    inputSchema: calculateInputSchema,
    outputSchema: calculateOutputSchema,
  },
  async (params) => {
    /* Handler logic here */
  },
);
```

### 3. Resilience: Advanced Error Handling Strategy

This server implements a sophisticated, multi-layered error handling approach that distinguishes between protocol-level and application-level failures.

**The Principle:** Never `throw new Error()`. Always throw an instance of `McpError` from the SDK. This ensures the client _always_ receives a well-formed JSON-RPC error response and prevents internal details like stack traces from ever leaking.

```typescript
// ❌ ANTI-PATTERN: Generic, non-compliant, leaks implementation details.
// if (b === 0) throw new Error('Cannot divide by zero!');

// ✅ BEST PRACTICE: Protocol-compliant, specific, and safe.
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk';

if (b === 0) {
  // The client can programmatically react to the `InvalidParams` code.
  throw new McpError(ErrorCode.InvalidParams, 'Division by zero is not allowed.');
}
```

**Advanced Pattern - Application vs Protocol Errors:** Some tools (like `batch_calculate`) demonstrate application-level error handling where individual item failures don't fail the entire operation, providing granular error feedback while maintaining overall tool success.

### 4. Transport: Protocol-Safe Logging to `stderr`

This is the most critical rule for STDIO transport. `stdout` is a sacred data channel reserved exclusively for JSON-RPC messages.

**The Principle:** All logging, debugging, and other non-protocol text **must** be written to the `stderr` stream to avoid corrupting the communication channel.

```typescript
// ✅ In src/types.ts
export const log = {
  // Uses console.error() to write to the stderr stream.
  info: (msg: string) => console.error(`[INFO] ${msg}`),
  error: (msg: string) => console.error(`[ERROR] ${msg}`),
};
```

## 📊 Features Implemented

This server implements a comprehensive set of capabilities to demonstrate the full power of the Model Context Protocol.

_(The features table remains the same as it accurately reflects the server's capabilities.)_

... (Tools, Resources, Prompts tables here) ...

## 🧪 Testing & Validation

_(This section remains the same.)_

... (Manual Request, Inspector, Test Suite sections here) ...

## 🏭 Deployment & Configuration

A STDIO server is not deployed like a web server. It is designed to be **executed as a child process** by a parent application.

### Configuration

The server's behavior can be modified with command-line flags.

| Flag      | Description                                |
| :-------- | :----------------------------------------- |
| `--debug` | Enables verbose debug logging to `stderr`. |
| `--help`  | Shows the help message and exits.          |

### Production Readiness Checklist

- [x] **Process Isolation:** The OS provides a natural security sandbox.
- [x] **Input Validation:** Zod schemas are used for all incoming tool arguments.
- [x] **No Network Exposure:** The server does not listen on any network ports.
- [x] **Sanitized Errors:** Using `McpError` ensures no internal details are ever leaked.
- [x] **Robust Lifecycle Management:** The `main` function implements modular signal handlers (`SIGINT`, `SIGTERM`) and global exception handlers to ensure the server always exits cleanly with a specific exit code, making it a reliable citizen in any process-managed environment.
- [x] **Compositional Architecture:** Clean separation of setup functions (`setupGracefulShutdown`, `setupGlobalErrorHandlers`) for maximum maintainability and testability.

**Monitoring:**

- **Health & Logs:** The parent process is responsible for monitoring the child process's health and capturing its `stderr` stream for logging.
- **Resources:** Standard OS tools (`top`, `htop`) can be used to monitor CPU and memory usage.
