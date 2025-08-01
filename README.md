# Calculator Learning Demo - STDIO Transport

<div align="center">

[![MCP Version](https://img.shields.io/badge/MCP-1.0.0-blue)](https://modelcontextprotocol.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

</div>

## 🎯 Overview

This repository demonstrates a **learning-edition MCP calculator server using STDIO transport**. It showcases the classic local-pipe transport where the server runs as a child process and communicates via `stdin` and `stdout` using newline-delimited JSON-RPC messages.

### Key Characteristics

- **Zero-network latency**: Direct inter-process communication (microseconds)
- **Per-process state**: All state resets when the process exits
- **No sockets, no SSE, no HTTP**: Pure stdin/stdout communication
- **Perfect isolation**: Process-level security boundary
- **Ideal for**: CLI tools, IDE plugins, local development

## 📊 Transport Comparison Table

| Dimension | **STDIO** (this) | **SSE** | **Streamable HTTP** | **Streamable HTTP Stateless** |
|-----------|------------------|---------|---------------------|-------------------------------|
| **Transport layer** | Local pipes (`stdin`/`stdout`) | 2 × HTTP endpoints (`GET /connect` + `POST /messages`) | Single HTTP endpoint `/mcp` (JSON or SSE) | Single HTTP endpoint (per request) |
| **Bidirectional streaming** | ✅ **Yes (full duplex)** | ⚠️ Server→client only | ✅ Yes (server push + client stream) | ✅ Within each request |
| **State management** | **Process memory** | Server memory (session mapping) | Session-based (`Mcp-Session-Id`) | ❌ None (stateless) |
| **Latency** | ⚡ **Fastest (microseconds)** | 🚀 Good (after connection) | 💫 Moderate (HTTP overhead) | 💫 Moderate |
| **Security** | 🔒 **Process isolation** | 🌐 Network exposed | 🌐 Network exposed | 🌐 Network exposed |
| **Scalability** | ⚠️ **Single process** | ✅ Multi-client | ✅ Horizontal (with sticky sessions) | ♾️ Infinite (stateless) |
| **Ideal use case** | **Local CLI tools, IDE plugins** | Web apps, real-time updates | Enterprise APIs, complex workflows | Serverless, edge computing |

## 🔄 STDIO Transport Flow

```
┌─────────────┐         stdin          ┌─────────────┐
│   Client    │ ─────────────────────► │   Server    │
│  (Parent)   │                        │   (Child)   │
│   Process   │ ◄───────────────────── │   Process   │
└─────────────┘         stdout         └─────────────┘
                       
                 JSON-RPC messages
              (newline-delimited)
```

Each JSON-RPC message is sent as a single line terminated with `\n`. The server processes requests concurrently and emits progress notifications for long-running operations.

## 📊 Golden Standard Feature Matrix

| Name | Status | Implementation |
|------|--------|----------------|
| `calculate` | **Core ✅** | Basic arithmetic with optional streaming progress (10%, 50%, 90%) |
| `batch_calculate` | **Extended ✅** | Process multiple calculations in single request |
| `advanced_calculate` | **Extended ✅** | Factorial, logarithm, combinatorics operations |
| `demo_progress` | **Extended ✅** | Demonstrates 5 progress notifications → final result |
| `explain-calculation` | **Core ✅** | Returns Markdown explanation of calculations |
| `generate-problems` | **Core ✅** | Returns Markdown practice problems |
| `calculator-tutor` | **Core ✅** | Returns Markdown tutoring content |
| `solve_math_problem` | **Extended ✅** | May send `elicitInput` request back to client |
| `explain_formula` | **Extended ✅** | Interactive formula explanation |
| `calculator_assistant` | **Extended ✅** | Interactive calculator assistance |
| `calculator://constants` | **Core ✅** | Mathematical constants (π, e, φ, √2, ln2, ln10) |
| `calculator://history/{id}` | **Extended ✅** | Store last 50 calculation results in memory |
| `calculator://stats` | **Extended ✅** | Server uptime and request statistics |
| `formulas://library` | **Extended ✅** | Collection of mathematical formulas |

**✅ All 7 tools, 3 prompts, and 4 resources confirmed working with MCP Inspector CLI**

## 🚀 Quick Start

### Prerequisites

- Node.js 18.x or higher
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd calculator-learning-demo-stdio

# Install dependencies
npm install

# Build the project
npm run build
```

### Running the Server

```bash
# Start the server
npm start

# Development mode with auto-reload
npm run dev

# Test with MCP Inspector CLI
npm run inspector
```

## 📋 API Examples

### Basic Calculation

Interactive session (stdin shown with `→`):

```
→ {"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"calculate","arguments":{"a":7,"b":6,"op":"multiply"}}}
{"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"Result: 42"}]}}
```

### Batch Operations

```
→ {"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"batch_calculate","arguments":{"calculations":[{"a":10,"b":5,"op":"add"},{"a":20,"b":4,"op":"multiply"}]}}}
{"jsonrpc":"2.0","id":2,"result":{"content":[{"type":"text","text":"Results: [15, 80]"}]}}
```

### Progress Demonstration

```
→ {"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"demo_progress","arguments":{}}}
{"jsonrpc":"2.0","method":"progress","params":{"progressToken":"progress_3","progress":20,"total":100}}
{"jsonrpc":"2.0","method":"progress","params":{"progressToken":"progress_3","progress":40,"total":100}}
{"jsonrpc":"2.0","method":"progress","params":{"progressToken":"progress_3","progress":60,"total":100}}
{"jsonrpc":"2.0","method":"progress","params":{"progressToken":"progress_3","progress":80,"total":100}}
{"jsonrpc":"2.0","method":"progress","params":{"progressToken":"progress_3","progress":100,"total":100}}
{"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"Progress demonstration completed"}]}}
```

### Advanced Mathematics

```
→ {"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"advanced_calculate","arguments":{"operation":"factorial","n":5}}}
{"jsonrpc":"2.0","id":4,"result":{"content":[{"type":"text","text":"5! = 120"}]}}
```

### Access Resources

```
→ {"jsonrpc":"2.0","id":5,"method":"resources/read","params":{"uri":"calculator://constants"}}
{"jsonrpc":"2.0","id":5,"result":{"contents":[{"uri":"calculator://constants","mimeType":"application/json","text":"{\"pi\":3.141592653589793,\"e\":2.718281828459045,\"phi\":1.618033988749895}"}]}}

→ {"jsonrpc":"2.0","id":6,"method":"resources/read","params":{"uri":"calculator://stats"}}
{"jsonrpc":"2.0","id":6,"result":{"contents":[{"uri":"calculator://stats","mimeType":"application/json","text":"{\"uptimeMs\":12500,\"requestCount\":6}"}]}}
```

### Use Prompts

```
→ {"jsonrpc":"2.0","id":7,"method":"prompts/get","params":{"name":"explain-calculation","arguments":{"expression":"25 × 4","level":"intermediate"}}}
{"jsonrpc":"2.0","id":7,"result":{"description":"Explain the calculation: 25 × 4 at intermediate level with step-by-step breakdown","messages":[{"role":"user","content":{"type":"text","text":"Please explain how to calculate 25 × 4 step by step..."}}]}}
```

## 🛠️ Transport Internals

### Message Framing

- Each JSON-RPC envelope MUST end with `\n`
- No non-JSON output on `stdout` (diagnostic logs go to `stderr`)
- Supports concurrent request processing

### Concurrency Model

- Maintains `Map<id, PromiseResolver>` for in-flight requests
- Notifications (no `id` field) are fire-and-forget
- Progress notifications reference original request ID

### Exit Codes

- **0**: Normal shutdown
- **65**: Fatal parse error (EX_DATAERR)
- **70**: Unhandled exception (EX_SOFTWARE)

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run integration tests
npm run test:integration

# Watch mode for development
npm run test:watch

# Memory leak testing
npm run test:memory
```

### Test Coverage

The implementation includes comprehensive testing:
- Unit tests for all 7 tools
- Resource access validation
- Prompt generation testing
- Progress notification flow
- Error handling and exit codes
- Memory usage validation

## 📝 State Management

**Important**: All state is stored in process memory and resets when the process exits:

- **Calculation history**: Last 50 operations
- **Request counters**: Total requests processed
- **Uptime statistics**: Process start time
- **Formula library**: Static mathematical formulas

This behavior is by design for STDIO transport - each client spawns a fresh server process.

## 🔒 Security Considerations

- **Process isolation**: Server runs in separate process with restricted permissions
- **No network exposure**: Communication only via local pipes
- **Input validation**: All parameters validated with Zod schemas
- **Resource limits**: Max batch size (100), max history (50)
- **Exit code signaling**: Proper error reporting to parent process

## 📖 Resources

- [MCP Specification](https://spec.modelcontextprotocol.io)
- [Model Context Protocol Documentation](https://modelcontextprotocol.io)
- [STDIO Transport Documentation](https://spec.modelcontextprotocol.io/specification/basic/transports/#stdio)

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  ✅ <strong>Fully Compliant with MCP Learning Edition Golden Standard</strong><br/>
  All 7 tools, 3 prompts, and 4 resources confirmed working with modern MCP SDK
</p>