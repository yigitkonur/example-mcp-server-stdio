#!/usr/bin/env node
// =================================================================================
// Module: src/server.ts
//
// Purpose:
//   The single, authoritative source file for the MCP STDIO Calculator Server.
//
// Key Error Handling Ideas:
//   - Fail-Fast Validation: Business logic functions (e.g., `performBasicCalculation`)
//     aggressively validate inputs and throw specific `McpError` types on failure.
//   - Protocol Compliance: All thrown errors are instances of `McpError`, ensuring that
//     the client receives a standard JSON-RPC error response. This prevents leaking
//     internal stack traces.
//   - Graceful Shutdown: The `main` function implements robust signal and exception
//     handlers to ensure the process always exits cleanly with a specific exit code,
//     even on catastrophic failure. This is critical for a process-based tool.
//   - Clear Failure Paths: Every public-facing function (tools, resources) documents
//     its specific failure conditions using `@throws` TSDoc tags.
// =================================================================================

// === SECTION: IMPORTS ===
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { completable } from '@modelcontextprotocol/sdk/server/completable.js';
import { z } from 'zod';
import {
  log,
  SERVER_INFO,
  MATH_CONSTANTS,
  FORMULAS_LIBRARY,
  EXIT_CODES,
  HistoryEntry,
} from './types.js';

// === SECTION: GLOBAL STATE & CONFIGURATION ===

/**
 * Configuration limits for various server operations.
 * These values control resource usage and prevent abuse.
 */
const LIMITS = {
  maxHistorySize: 50,
  maxBatchSize: 100,
  HISTORY_DISPLAY_LIMIT: 50,
};

/**
 * In-memory calculation history using a simple array.
 * WHY: For STDIO transport, this process-based isolation means state
 * naturally resets when the process exits, providing clean separation.
 */
const calculationHistory: HistoryEntry[] = [];
const MAX_HISTORY = LIMITS.maxHistorySize;

/**
 * Server statistics tracked in-memory.
 * These provide insights into server usage and uptime.
 */
let requestCount = 0;
const serverStartTime = Date.now();

// === SECTION: CORE BUSINESS LOGIC ===

/**
 * Calculates factorial of a non-negative integer.
 * PURE FUNCTION: No side effects, deterministic output for given input.
 *
 * @param n - The number to calculate factorial for
 * @returns The factorial of n
 * @throws {RangeError} if n is negative or too large to be represented safely.
 */
function factorial(n: number): number {
  if (n < 0) throw new RangeError('Factorial is not defined for negative numbers');
  if (n === 0 || n === 1) return 1;
  if (n > 170) throw new RangeError('Input for factorial is too large to be represented safely.');
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

/**
 * Calculates combinations C(n, k) = n! / (k! * (n-k)!)
 * PURE FUNCTION: Mathematical combination formula implementation.
 *
 * @param n - Total number of items
 * @param k - Number of items to choose
 * @returns Number of combinations
 */
function combinations(n: number, k: number): number {
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;
  return factorial(n) / (factorial(k) * factorial(n - k));
}

/**
 * Calculates permutations P(n, k) = n! / (n-k)!
 * PURE FUNCTION: Mathematical permutation formula implementation.
 *
 * @param n - Total number of items
 * @param k - Number of items to arrange
 * @returns Number of permutations
 */
function permutations(n: number, k: number): number {
  if (k > n) return 0;
  return factorial(n) / factorial(n - k);
}

/**
 * Formats mathematical expressions in human-readable form.
 * PURE FUNCTION: Takes operation details and returns formatted string.
 *
 * @param operation - The mathematical operation performed
 * @param a - First operand
 * @param b - Second operand (optional for unary operations)
 * @param result - The calculated result
 * @returns Human-readable expression string
 */
function formatExpression(
  operation: string,
  a: number,
  b: number | undefined,
  result: number,
): string {
  switch (operation) {
    case 'add':
      return `${a} + ${b} = ${result}`;
    case 'subtract':
      return `${a} - ${b} = ${result}`;
    case 'multiply':
      return `${a} × ${b} = ${result}`;
    case 'divide':
      return `${a} ÷ ${b} = ${result}`;
    case 'factorial':
      return `${a}! = ${result}`;
    case 'log':
      return b ? `log${b}(${a}) = ${result}` : `ln(${a}) = ${result}`;
    case 'combinations':
      return `C(${a}, ${b}) = ${result}`;
    case 'permutations':
      return `P(${a}, ${b}) = ${result}`;
    default:
      return `${operation}(${a}${b !== undefined ? `, ${b}` : ''}) = ${result}`;
  }
}

/**
 * Creates a new history entry with generated ID and timestamp.
 * PURE FUNCTION: Generates deterministic output based on inputs (except for ID/timestamp).
 *
 * @param operation - The operation that was performed
 * @param a - First operand
 * @param b - Second operand (optional)
 * @param result - The calculation result
 * @returns A complete HistoryEntry object
 */
function createHistoryEntry(
  operation: string,
  a: number,
  b: number | undefined,
  result: number,
): HistoryEntry {
  const id = Math.random().toString(36).substring(7);
  const expression = formatExpression(operation, a, b, result);
  return {
    id,
    timestamp: new Date().toISOString(),
    operation: operation,
    input_1: a,
    input_2: b,
    result,
    expression,
  };
}

/**
 * Adds a calculation entry to the in-memory history with automatic cleanup.
 * SIDE EFFECT: Modifies global calculationHistory array.
 *
 * @param entry - The history entry to add
 */
function addToHistory(entry: HistoryEntry): void {
  calculationHistory.push(entry);
  if (calculationHistory.length > MAX_HISTORY) {
    calculationHistory.shift(); // O(n) but simple and fast for small arrays
  }
}

/**
 * @summary Performs basic arithmetic operations with protocol-compliant error handling.
 * @remarks This is a pure function that forms the core of the calculator's logic.
 * It is designed to fail fast with a specific, client-consumable error for
 * predictable failure conditions like division by zero.
 *
 * @param op The operation to perform ('add', 'subtract', 'multiply', 'divide').
 * @param a The first operand.
 * @param b The second operand.
 *
 * @throws {McpError} with code `InvalidParams` if the operation is unknown.
 * @throws {McpError} with code `InvalidParams` on an attempt to divide by zero.
 *
 * @returns The calculated result.
 */
function performBasicCalculation(op: string, a: number, b: number): number {
  switch (op) {
    case 'add':
      return a + b;
    case 'subtract':
      return a - b;
    case 'multiply':
      return a * b;
    case 'divide':
      if (b === 0) throw new McpError(ErrorCode.InvalidParams, 'Division by zero');
      return a / b;
    default:
      throw new McpError(ErrorCode.InvalidParams, `Unknown operation: ${op}`);
  }
}

// === SECTION: MCP WIRING ===

/**
 * Registers core calculation tools with the MCP server.
 * These are the fundamental arithmetic operations that form the foundation
 * of the calculator functionality.
 *
 * @param server - The MCP server instance to register tools with
 */
function registerCoreTools(server: McpServer): void {
  // --- TOOL: calculate ---
  // The most fundamental tool. Demonstrates basic SDK usage.

  // WHY: Co-locating the schema with the tool registration makes the tool's
  // entire definition (its contract) visible in one place. It is self-contained.
  const calculateInputSchema = {
    a: z.number().describe('First operand'),
    b: z.number().describe('Second operand'),
    op: z.enum(['add', 'subtract', 'multiply', 'divide']).describe('Operation to perform'),
    stream: z.boolean().optional().describe('If true, emit progress notifications'),
  };

  const calculateOutputSchema = {
    value: z.number(),
    meta: z.object({
      calculationId: z.string(),
      timestamp: z.string(),
    }),
  };

  server.registerTool(
    'calculate',
    {
      title: 'Calculate',
      description: 'Perform a basic arithmetic calculation',
      inputSchema: calculateInputSchema,
      outputSchema: calculateOutputSchema,
    },
    // HANDLER LOGIC:
    // - Async function, receives validated & typed parameters.
    // - The SDK automatically parses the input against `inputSchema`.
    // - If validation fails, the SDK sends the error; this code doesn't run.
    async ({ a, b, op, stream }, { sendNotification }) => {
      log.info(`Executing calculate: ${a} ${op} ${b}`);
      requestCount++;

      try {
        // FEATURE: Progress notifications for streaming calculations
        // WHY: Demonstrates real-time feedback using sendNotification
        if (stream) {
          const progressId = `calc-${Date.now()}`;
          await sendNotification({
            method: 'notifications/progress',
            params: {
              progressToken: progressId,
              progress: 33,
              message: `Calculating ${a} ${op} ${b}`,
            },
          });
          await new Promise((resolve) => setTimeout(resolve, 100));
          await sendNotification({
            method: 'notifications/progress',
            params: { progressToken: progressId, progress: 66 },
          });
          await new Promise((resolve) => setTimeout(resolve, 100));
          await sendNotification({
            method: 'notifications/progress',
            params: { progressToken: progressId, progress: 100, message: 'Complete' },
          });
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // Core business logic: perform the calculation
        const result = performBasicCalculation(op, a, b);

        // Create and store history entry
        const historyEntry = createHistoryEntry(op, a, b, result);
        addToHistory(historyEntry);

        // SDK-NOTE: The return object must match the `outputSchema`.
        // The SDK will validate this before sending the response.
        // We provide both a simple text `content` for basic UIs and a
        // `structuredContent` for richer clients.
        return {
          content: [
            {
              type: 'text',
              text: historyEntry.expression,
            },
          ],
          structuredContent: {
            value: result,
            meta: {
              calculationId: historyEntry.id,
              timestamp: historyEntry.timestamp,
            },
          },
        };
      } catch (error) {
        // CAVEAT: We catch the error from our business logic and re-throw it.
        // While `performBasicCalculation` already returns an McpError, this pattern
        // is crucial for wrapping any *unexpected* errors that might occur,
        // preventing stack traces from leaking to the client.
        log.error(`Calculation failed: ${error instanceof Error ? error.message : String(error)}`);
        throw new McpError(
          ErrorCode.InvalidParams,
          `Calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          { operation: op, a, b },
        );
      }
    },
  );
}

/**
 * Registers extended tools that provide advanced functionality.
 * These tools demonstrate more complex SDK patterns like batch processing,
 * advanced mathematics, and interactive features.
 *
 * @param server - The MCP server instance to register tools with
 */
function registerExtendedTools(server: McpServer): void {
  // --- TOOL: batch_calculate ---
  // Demonstrates array processing and error handling for individual items

  const batchCalculateInputSchema = {
    calculations: z
      .array(
        z.object({
          a: z.number(),
          b: z.number(),
          op: z.enum(['add', 'subtract', 'multiply', 'divide']),
        }),
      )
      .min(1)
      .max(LIMITS.maxBatchSize),
  };

  const batchCalculateOutputSchema = {
    results: z.array(
      z.discriminatedUnion('success', [
        z.object({
          success: z.literal(true),
          expression: z.string(),
          value: z.number(),
          calculationId: z.string(),
        }),
        z.object({
          success: z.literal(false),
          expression: z.string(),
          error: z.string(),
        }),
      ]),
    ),
  };

  server.registerTool(
    'batch_calculate',
    {
      title: 'Batch Calculate',
      description: 'Perform multiple calculations in a single request',
      inputSchema: batchCalculateInputSchema,
      outputSchema: batchCalculateOutputSchema,
    },
    async ({ calculations }) => {
      log.info(`Executing batch calculations: ${calculations.length} operations`);
      requestCount++;

      const results = [];
      for (const calc of calculations) {
        try {
          const result = performBasicCalculation(calc.op, calc.a, calc.b);
          const historyEntry = createHistoryEntry(calc.op, calc.a, calc.b, result);
          addToHistory(historyEntry);

          results.push({
            success: true as const,
            expression: historyEntry.expression,
            value: result,
            calculationId: historyEntry.id,
          });
        } catch (error) {
          // NOTE: This is an example of APPLICATION-LEVEL error handling.
          // Instead of throwing and failing the entire batch (a protocol-level error),
          // we catch the error for a single item. The tool itself still succeeds,
          // but its structured output contains the specific error information.
          // This gives the client detailed feedback on a per-item basis.
          results.push({
            success: false as const,
            expression: `${calc.a} ${calc.op} ${calc.b}`,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: results
              .map((r) => (r.success ? r.expression : `Error in ${r.expression}: ${r.error}`))
              .join('\n'),
          },
        ],
        structuredContent: { results },
      };
    },
  );

  // --- TOOL: advanced_calculate ---
  // Demonstrates complex mathematical operations and conditional parameter handling

  const advancedCalculateInputSchema = {
    operation: z.enum(['factorial', 'log', 'combinations', 'permutations']),
    n: z.number().describe('Primary input'),
    k: z.number().optional().describe('Secondary input for combinations/permutations'),
    base: z.number().optional().describe('Base for logarithm (default: e)'),
  };

  const advancedCalculateOutputSchema = {
    value: z.number(),
    expression: z.string(),
    calculationId: z.string(),
  };

  /**
   * @summary Handler for the `advanced_calculate` tool.
   * @remarks Implements complex mathematical operations and validates conditional parameters.
   * This handler demonstrates throwing specific errors for both invalid parameters (`k` missing)
   * and underlying business logic failures (e.g., `factorial` out of range).
   *
   * @throws {McpError} with code `InvalidParams` if the `k` parameter is required for an operation but is not provided.
   * @throws {RangeError} Propagated from the `factorial` function if inputs are out of the representable range.
   */
  async function handleAdvancedCalculate({
    operation,
    n,
    k,
    base,
  }: {
    operation: 'factorial' | 'log' | 'combinations' | 'permutations';
    n: number;
    k?: number | undefined;
    base?: number | undefined;
  }) {
    log.info(`Executing advanced calculation: ${operation}`);
    requestCount++;

    try {
      let result: number;
      let expression: string;

      switch (operation) {
        case 'factorial':
          result = factorial(n);
          expression = `${n}! = ${result}`;
          break;
        case 'log':
          if (base) {
            result = Math.log(n) / Math.log(base);
            expression = `log${base}(${n}) = ${result}`;
          } else {
            result = Math.log(n);
            expression = `ln(${n}) = ${result}`;
          }
          break;
        case 'combinations':
          if (k === undefined)
            throw new McpError(
              ErrorCode.InvalidParams,
              'The parameter "k" is required for the "combinations" operation',
            );
          result = combinations(n, k);
          expression = `C(${n}, ${k}) = ${result}`;
          break;
        case 'permutations':
          if (k === undefined)
            throw new McpError(
              ErrorCode.InvalidParams,
              'The parameter "k" is required for the "permutations" operation',
            );
          result = permutations(n, k);
          expression = `P(${n}, ${k}) = ${result}`;
          break;
        default:
          throw new McpError(ErrorCode.InvalidParams, `Unknown operation: ${operation}`);
      }

      const historyEntry = createHistoryEntry(operation, n, k, result);
      addToHistory(historyEntry);

      return {
        content: [
          {
            type: 'text' as const,
            text: expression,
          },
        ],
        structuredContent: {
          value: result,
          expression,
          calculationId: historyEntry.id,
        },
      };
    } catch (error) {
      log.error(
        `Advanced calculation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new McpError(
        ErrorCode.InvalidParams,
        `Advanced calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { operation, n, k, base },
      );
    }
  }

  server.registerTool(
    'advanced_calculate',
    {
      title: 'Advanced Calculate',
      description:
        'Perform advanced mathematical operations (factorial, log, combinations, permutations)',
      inputSchema: advancedCalculateInputSchema,
      outputSchema: advancedCalculateOutputSchema,
    },
    handleAdvancedCalculate,
  );

  // --- TOOL: demo_progress ---
  // Demonstrates progress notifications with multiple updates

  const demoProgressOutputSchema = {
    message: z.string(),
    progressSteps: z.array(z.number()),
  };

  server.registerTool(
    'demo_progress',
    {
      title: 'Demo Progress',
      description: 'Demonstrate progress notifications with 5 updates',
      inputSchema: {},
      outputSchema: demoProgressOutputSchema,
    },
    async (_, { sendNotification }) => {
      log.info('Executing demo_progress');
      requestCount++;

      const progressId = 'demo-progress-task';

      for (let i = 1; i <= 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        await sendNotification({
          method: 'notifications/progress',
          params: {
            progressToken: progressId,
            progress: i * 20,
            message: `Step ${i} of 5 - Processing complex calculations...`,
          },
        });
      }

      return {
        content: [
          {
            type: 'text',
            text: 'Progress demonstration completed',
          },
        ],
        structuredContent: {
          message: 'Progress demonstration completed',
          progressSteps: [20, 40, 60, 80, 100],
        },
      };
    },
  );

  // --- TOOL: solve_math_problem ---
  // Demonstrates elicitInput for interactive problem solving

  const solveMathProblemInputSchema = {
    problem: z.string().describe('The math problem to solve'),
    showSteps: z.boolean().optional().describe('Show step-by-step solution'),
  };

  server.registerTool(
    'solve_math_problem',
    {
      title: 'Solve Math Problem',
      description: 'Solve a word problem or mathematical expression (may request user input)',
      inputSchema: solveMathProblemInputSchema,
    },
    async ({ problem, showSteps }) => {
      log.info('Solving math problem');
      requestCount++;

      // Check for ambiguous area problems
      if (problem.toLowerCase().includes('area') && !problem.match(/\d+/)) {
        // Determine shape type
        let shape = 'unknown';
        if (problem.toLowerCase().includes('rectangle')) shape = 'rectangle';
        else if (problem.toLowerCase().includes('circle')) shape = 'circle';
        else if (problem.toLowerCase().includes('triangle')) shape = 'triangle';

        if (shape === 'rectangle') {
          try {
            const result = await server.server.elicitInput({
              message: 'I need the dimensions to calculate the area of a rectangle.',
              requestedSchema: {
                type: 'object',
                properties: {
                  length: { type: 'number', description: 'Length of the rectangle' },
                  width: { type: 'number', description: 'Width of the rectangle' },
                },
                required: ['length', 'width'],
              },
            });

            if (result.action === 'accept') {
              const { length, width } = result.content as { length: number; width: number };
              const area = length * width;
              const steps = showSteps
                ? `\n### Steps:\n1. Formula: Area = length × width\n2. Substitution: Area = ${length} × ${width}\n3. Calculation: Area = ${area}\n`
                : '';
              return {
                content: [
                  {
                    type: 'text',
                    text: `## Area of Rectangle\n\nThe area is ${length} × ${width} = ${area} square units.${steps}`,
                  },
                ],
              };
            } else {
              return { content: [{ type: 'text', text: 'Area calculation cancelled by user.' }] };
            }
          } catch (e) {
            // NOTE: `elicitInput` can fail for several reasons: the transport
            // was closed, the request timed out, or the client explicitly
            // rejected the elicitation. We wrap this in a generic InternalError
            // because from the tool's perspective, its interactive flow was
            // unexpectedly interrupted.
            throw new McpError(
              ErrorCode.InternalError,
              'Failed to complete interactive input with the user.',
            );
          }
        } else if (shape === 'circle') {
          try {
            const result = await server.server.elicitInput({
              message: 'I need the radius to calculate the area of a circle.',
              requestedSchema: {
                type: 'object',
                properties: {
                  radius: { type: 'number', description: 'Radius of the circle' },
                },
                required: ['radius'],
              },
            });

            if (result.action === 'accept') {
              const { radius } = result.content as { radius: number };
              const area = Math.PI * radius * radius;
              const steps = showSteps
                ? `\n### Steps:\n1. Formula: Area = π × r²\n2. Substitution: Area = π × ${radius}²\n3. Calculation: Area = ${area.toFixed(2)}\n`
                : '';
              return {
                content: [
                  {
                    type: 'text',
                    text: `## Area of Circle\n\nThe area is π × ${radius}² = ${area.toFixed(2)} square units.${steps}`,
                  },
                ],
              };
            } else {
              return { content: [{ type: 'text', text: 'Area calculation cancelled by user.' }] };
            }
          } catch (e) {
            // NOTE: `elicitInput` can fail for several reasons: the transport
            // was closed, the request timed out, or the client explicitly
            // rejected the elicitation. We wrap this in a generic InternalError
            // because from the tool's perspective, its interactive flow was
            // unexpectedly interrupted.
            throw new McpError(
              ErrorCode.InternalError,
              'Failed to complete interactive input with the user.',
            );
          }
        }
      }

      // Default response for non-area or non-ambiguous problems
      return {
        content: [
          {
            type: 'text',
            text:
              `## Solving: ${problem}\n\n` +
              `This problem would be solved using appropriate mathematical methods.\n` +
              `${showSteps ? '\n### Steps:\n1. Analyze the problem\n2. Identify key values\n3. Apply appropriate formula\n4. Calculate result\n' : ''}`,
          },
        ],
      };
    },
  );

  // --- TOOL: explain_formula ---
  // Demonstrates informational tools with optional parameters

  const explainFormulaInputSchema = {
    formula: z.string().describe('The formula to explain'),
    examples: z.boolean().optional().describe('Include examples'),
  };

  server.registerTool(
    'explain_formula',
    {
      title: 'Explain Formula',
      description: 'Explain a mathematical formula interactively',
      inputSchema: explainFormulaInputSchema,
    },
    async ({ formula, examples }) => {
      log.info('Explaining formula');
      requestCount++;

      return {
        content: [
          {
            type: 'text',
            text:
              `## Formula Explanation: ${formula}\n\n` +
              `This tool provides interactive explanations of mathematical formulas.\n` +
              `${examples ? '\n### Examples:\n- Example calculations would be shown here\n- Visual representations might be included\n' : ''}\n` +
              `**Note**: This tool may use elicitInput for interactive learning.`,
          },
        ],
      };
    },
  );

  // --- TOOL: calculator_assistant ---
  // Demonstrates context-aware assistance

  const calculatorAssistantInputSchema = {
    query: z.string().describe('The user query or question'),
    context: z.string().optional().describe('Additional context'),
  };

  server.registerTool(
    'calculator_assistant',
    {
      title: 'Calculator Assistant',
      description: 'Interactive calculator assistance with context-aware help',
      inputSchema: calculatorAssistantInputSchema,
    },
    async ({ query, context }) => {
      log.info('Calculator assistant activated');
      requestCount++;

      return {
        content: [
          {
            type: 'text',
            text:
              `## Calculator Assistant\n\n` +
              `**Query**: ${query}\n` +
              `${context ? `**Context**: ${context}\n` : ''}\n` +
              `I can help you with:\n` +
              `- Basic arithmetic operations\n` +
              `- Advanced calculations (factorials, logarithms, etc.)\n` +
              `- Formula explanations\n` +
              `- Step-by-step problem solving\n\n` +
              `**Note**: This assistant may use elicitInput for clarification.`,
          },
        ],
      };
    },
  );
}

/**
 * The main factory for the MCP Calculator Server.
 * This function creates a new McpServer instance and then composes it by
 * calling a series of dedicated registration functions for tools, resources,
 * and prompts. This pattern keeps the setup logic organized and scannable.
 */
export async function createCalculatorServer() {
  // 1. Create the server instance with metadata and instructions.
  const server = new McpServer(
    {
      name: SERVER_INFO.name,
      version: SERVER_INFO.version,
    },
    {
      instructions: `${SERVER_INFO.description}
    
This learning-edition server provides:
1. **Core Tools**: calculate, explain-calculation, generate-problems
2. **Extended Tools**: batch_calculate, advanced_calculate, demo_progress, solve_math_problem, explain_formula, calculator_assistant
3. **Core Resources**: calculator://constants
4. **Extended Resources**: calculator://history/{id}, calculator://stats, formulas://library
5. **Prompts**: Interactive mathematical assistance with potential elicitInput requests

All operations support the golden standard feature set.`,
    },
  );

  // 2. Register all capabilities by calling dedicated functions.
  //    This composition pattern is easier to read and maintain.
  registerCoreTools(server);
  registerExtendedTools(server);
  registerResources(server);
  registerPrompts(server);
  registerManagementTools(server);

  // 3. Return the fully configured server instance.
  return server;
}

/**
 * Registers all resource endpoints with the MCP server.
 * Resources provide read-only access to data and content.
 *
 * @param server - The MCP server instance to register resources with
 */
function registerResources(server: McpServer): void {
  // --- RESOURCE: Mathematical Constants ---
  // Demonstrates static data serving with JSON format

  server.registerResource(
    'math-constants',
    'calculator://constants',
    {
      title: 'Mathematical Constants',
      description: 'Common mathematical constants with high precision',
      mimeType: 'application/json',
    },
    async (uri) => {
      log.info('Serving mathematical constants');
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(MATH_CONSTANTS, null, 2),
          },
        ],
      };
    },
  );

  // --- RESOURCE: Calculation History (Template) ---
  // Demonstrates dynamic resources with completion support and parameterized URIs

  server.registerResource(
    'calculation-history',
    new ResourceTemplate('calculator://history/{calculationId}', {
      list: async () => {
        const sortedHistory = [...calculationHistory]
          .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
          .slice(0, LIMITS.HISTORY_DISPLAY_LIMIT);

        return {
          resources: sortedHistory.map((calc) => ({
            uri: `calculator://history/${calc.id}`,
            name: calc.expression,
            description: `Calculation performed at ${new Date(calc.timestamp).toLocaleString()}`,
            mimeType: 'application/json',
          })),
        };
      },
      complete: {
        calculationId: async (value: string) => {
          return calculationHistory
            .map((h) => h.id)
            .filter((id) => id.startsWith(value))
            .slice(0, 10);
        },
      },
    }),
    {
      title: 'Calculation History',
      description: 'Access the last 50 calculations by ID',
    },
    async (uri, { calculationId }) => {
      const calculation = calculationHistory.find((h) => h.id === calculationId);
      if (!calculation) {
        // NOTE: This is a client error. The client requested a resource with an ID
        // that does not exist. `InvalidParams` is the correct code because the
        // `{calculationId}` parameter in the URI template is invalid.
        throw new McpError(
          ErrorCode.InvalidParams,
          `Resource not found. No calculation exists with ID '${calculationId}'.`,
        );
      }

      log.info(`Serving calculation history for ${calculationId}`);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(calculation, null, 2),
          },
        ],
      };
    },
  );

  // --- RESOURCE: Statistics ---
  // Demonstrates dynamic data generation from server state

  server.registerResource(
    'calculator-stats',
    'calculator://stats',
    {
      title: 'Calculator Statistics',
      description: 'Server uptime and request count',
      mimeType: 'application/json',
    },
    async (uri) => {
      const stats = {
        uptimeMs: Date.now() - serverStartTime,
        requestCount,
      };

      log.info('Serving calculator statistics');
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(stats, null, 2),
          },
        ],
      };
    },
  );

  // --- RESOURCE: Formulas Library ---
  // Demonstrates serving structured knowledge data

  server.registerResource(
    'formulas-library',
    'formulas://library',
    {
      title: 'Formulas Library',
      description: 'Collection of common mathematical formulas',
      mimeType: 'application/json',
    },
    async (uri) => {
      log.info('Serving formulas library');
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(FORMULAS_LIBRARY, null, 2),
          },
        ],
      };
    },
  );
}

/**
 * Registers prompt templates that can be used to generate context for LLMs.
 * Prompts demonstrate the completable pattern for argument autocompletion.
 *
 * @param server - The MCP server instance to register prompts with
 */
function registerPrompts(server: McpServer): void {
  // --- PROMPT: explain-calculation ---
  // Demonstrates prompt generation with completable arguments

  server.registerPrompt(
    'explain-calculation',
    {
      title: 'Explain Calculation',
      description: 'Generate detailed explanations of mathematical calculations',
      argsSchema: {
        expression: z.string().describe('The calculation to explain'),
        level: completable(z.enum(['elementary', 'intermediate', 'advanced']), async (value) => {
          const options: ('elementary' | 'intermediate' | 'advanced')[] = [
            'elementary',
            'intermediate',
            'advanced',
          ];
          if (!value) return options;
          return options.filter((l) => l.startsWith(value));
        }).optional(),
      },
    },
    ({ expression, level }) => {
      log.info('Generated explanation prompt');

      const levelText = level || 'intermediate';
      const prompt = `Please explain the calculation "${expression}" at an ${levelText} level.

Include:
- What the operation means
- Step-by-step breakdown
- Why this calculation might be useful
- Common mistakes to avoid

Make the explanation clear and educational.`;

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: prompt,
            },
          },
        ],
      };
    },
  );

  // --- PROMPT: generate-problems ---
  // Demonstrates dynamic prompt generation with multiple completable parameters

  server.registerPrompt(
    'generate-problems',
    {
      title: 'Generate Problems',
      description: 'Create practice math problems',
      argsSchema: {
        difficulty: completable(
          z.enum(['easy', 'medium', 'hard']).describe('The difficulty of the problems'),
          async (value) => {
            const options: ('easy' | 'medium' | 'hard')[] = ['easy', 'medium', 'hard'];
            if (!value) return options;
            return options.filter((d) => d.startsWith(value));
          },
        ).optional(),
        count: z.string().optional(),
        operations: completable(
          z.string().describe('Comma-separated list of operations'),
          async (value) => {
            const ops = ['add', 'subtract', 'multiply', 'divide'];
            if (!value) return ops;
            return ops.filter((op) => op.includes(value.toLowerCase()));
          },
        ).optional(),
      },
    },
    ({ difficulty, count, operations }) => {
      log.info('Generated problems prompt');

      const difficultyLevel = difficulty || 'medium';
      const problemCount = count ? parseInt(count, 10) : 5;
      const ops = operations || 'add, subtract, multiply, divide';

      const prompt = `Generate ${problemCount} math practice problems at ${difficultyLevel} difficulty level.

Use these operations: ${ops}

For each problem:
1. Provide the problem statement
2. Leave space for the student to work
3. Include the answer (marked clearly)

Make the problems progressively challenging and educational.`;

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: prompt,
            },
          },
        ],
      };
    },
  );

  // --- PROMPT: calculator-tutor ---
  // Demonstrates interactive tutoring with topic-based completion

  server.registerPrompt(
    'calculator-tutor',
    {
      title: 'Calculator Tutor',
      description: 'Interactive mathematics tutoring',
      argsSchema: {
        topic: completable(
          z.string().describe('The mathematical topic to tutor'),
          async (value) => {
            const topics = [
              'algebra',
              'geometry',
              'calculus',
              'arithmetic',
              'statistics',
              'trigonometry',
            ];
            if (!value) return topics;
            return topics.filter((t) => t.toLowerCase().includes(value.toLowerCase()));
          },
        ),
        level: completable(z.enum(['beginner', 'intermediate', 'advanced']), async (value) => {
          const options: ('beginner' | 'intermediate' | 'advanced')[] = [
            'beginner',
            'intermediate',
            'advanced',
          ];
          if (!value) return options;
          return options.filter((l) => l.startsWith(value));
        }).optional(),
      },
    },
    ({ topic, level }) => {
      log.info('Generated tutor prompt');

      const studentLevel = level || 'beginner';
      const prompt = `Act as a friendly and patient math tutor helping a ${studentLevel} student with "${topic}".

Your approach should:
- Start by assessing what the student already knows
- Break down complex concepts into simple steps
- Use relatable examples and analogies
- Encourage the student with positive reinforcement
- Provide practice problems appropriate to their level

Begin the tutoring session by introducing yourself and the topic.`;

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: prompt,
            },
          },
        ],
      };
    },
  );
}

/**
 * Registers management and administrative tools.
 * These tools demonstrate advanced SDK features like tool management.
 *
 * @param server - The MCP server instance to register management tools with
 */
function registerManagementTools(server: McpServer): void {
  // NOTE: At this point, the core tools have already been registered by registerCoreTools
  // and registerExtendedTools. This function adds management and administrative tools.
  // For this demo, we implement a simplified maintenance mode that simulates tool lifecycle management.

  // --- TOOL: maintenance_mode ---
  // Demonstrates a management tool (simplified version for this demo)

  const maintenanceModeInputSchema = {
    toolName: z
      .enum(['calculate', 'batch_calculate', 'advanced_calculate'])
      .describe('Tool to simulate managing'),
    enable: z.boolean().describe('Enable (true) or disable (false) the tool'),
  };

  const maintenanceModeOutputSchema = {
    status: z.string(),
    toolName: z.string(),
    enabled: z.boolean(),
    message: z.string(),
  };

  server.registerTool(
    'maintenance_mode',
    {
      title: 'Maintenance Mode',
      description: 'Simulate enabling or disabling tools for maintenance (demo only)',
      inputSchema: maintenanceModeInputSchema,
      outputSchema: maintenanceModeOutputSchema,
    },
    async ({ toolName, enable }) => {
      log.info(`Simulating maintenance mode for ${toolName}: ${enable ? 'enabled' : 'disabled'}`);
      requestCount++;

      // NOTE: In a real implementation, this would use tool handles to actually
      // enable/disable tools. For this educational demo, we simulate the action.

      const message = enable
        ? `Tool '${toolName}' would be enabled and available for use.`
        : `Tool '${toolName}' would be disabled for maintenance and temporarily unavailable.`;

      return {
        content: [
          {
            type: 'text',
            text: `## Maintenance Mode (Demo)\n\n${message}\n\n**Note**: This is a demonstration tool. In a production server, this would use actual tool lifecycle management.`,
          },
        ],
        structuredContent: {
          status: enable ? 'enabled' : 'disabled',
          toolName,
          enabled: enable,
          message,
        },
      };
    },
  );
}

// === SECTION: EXECUTION ===

// Protocol Error Flow for STDIO Transport (high-level):
// 1. Client (Parent Process) sends a JSON-RPC request string to the server's `stdin`.
// 2. The `StdioServerTransport` reads and parses the JSON.
//    - On malformed JSON -> throws McpError(ErrorCode.ParseError).
// 3. The SDK routes the request to the appropriate handler (`registerTool`, etc.).
//    - On unknown method -> throws McpError(ErrorCode.MethodNotFound).
// 4. The SDK validates the request `params` against the tool's `inputSchema`.
//    - On schema mismatch -> throws McpError(ErrorCode.InvalidParams).
// 5. The registered handler function is executed.
//    - On business logic failure (e.g., divide by zero) -> handler throws McpError.
//    - On unexpected internal failure (e.g., bug) -> caught and wrapped in McpError(ErrorCode.InternalError).
// 6. The `StdioServerTransport` serializes the success or error response to JSON
//    and writes it to `stdout`, where the client reads it.

/**
 * Sets up signal handlers for graceful process termination.
 * This is critical for a process-based tool to ensure it cleans up
 * and exits correctly when its parent process sends a signal.
 */
function setupGracefulShutdown(): void {
  process.on('SIGINT', () => {
    log.info('Received SIGINT, shutting down gracefully');
    process.exit(EXIT_CODES.SUCCESS);
  });

  process.on('SIGTERM', () => {
    log.info('Received SIGTERM, shutting down gracefully');
    process.exit(EXIT_CODES.SUCCESS);
  });
}

/**
 * Sets up global "last-resort" error handlers.
 * If these are triggered, it signifies a bug in the application that was
 * not caught by local try/catch blocks. They prevent the process from
 * hanging and ensure it exits with a non-zero error code.
 */
function setupGlobalErrorHandlers(): void {
  process.on('uncaughtException', (error) => {
    log.error(`[FATAL] Uncaught exception: ${error.message}`);
    log.error(`Stack trace: ${error.stack}`);
    process.exit(EXIT_CODES.SOFTWARE_ERROR);
  });

  process.on('unhandledRejection', (reason) => {
    log.error(`[FATAL] Unhandled promise rejection: ${String(reason)}`);
    process.exit(EXIT_CODES.SOFTWARE_ERROR);
  });
}

/**
 * Main entry point for the MCP STDIO Calculator Server.
 *
 * This function orchestrates the complete server lifecycle:
 * 1. Command-line argument processing for help and debug modes
 * 2. Server instantiation and configuration via createCalculatorServer()
 * 3. Transport connection using the standard STDIO transport
 * 4. Signal handling for graceful shutdown (SIGINT, SIGTERM)
 * 5. Global error handling for uncaught exceptions and promise rejections
 *
 * WHY this approach:
 * - STDIO transport is ideal for process-based tools and IDE integrations
 * - Signal handling ensures clean shutdown when parent process terminates
 * - Error boundaries prevent the server from crashing unexpectedly
 * - Command-line args provide essential debugging and help functionality
 */
async function main() {
  try {
    log.info('Starting calculator server');

    // STEP 1: Process command-line arguments
    // WHY: Essential for debugging and user guidance
    if (process.argv.includes('--help')) {
      console.error(`
${SERVER_INFO.name} v${SERVER_INFO.version}

${SERVER_INFO.description}

Usage: node server.js [options]

Options:
  --debug    Enable debug logging to stderr
  --help     Show this help message and exit
      `);
      process.exit(EXIT_CODES.SUCCESS);
    }

    // STEP 2: Create and configure the MCP server
    // This calls our modular createCalculatorServer function which registers
    // all tools, resources, and prompts through dedicated registration functions
    const server = await createCalculatorServer();

    // STEP 3: Connect to STDIO transport
    // WHY: STDIO transport provides the simplest and most secure communication
    // channel for process-based MCP servers. stdin/stdout handle JSON-RPC.
    const transport = new StdioServerTransport();
    await server.connect(transport);

    log.info('Calculator server ready (SDK STDIO transport)');

    // STEP 4: Set up process lifecycle handlers
    setupGracefulShutdown();
    setupGlobalErrorHandlers();

    // At this point, the server is fully operational and will run until
    // it receives a termination signal or encounters an unrecoverable error.
  } catch (error) {
    // This block catches errors during the server's INITIALIZATION phase.
    // If `createCalculatorServer()` or `server.connect()` fails, this ensures
    // the failure is logged and the process exits with a software error code.
    log.error(`Failed to start server: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      log.error(`Stack trace: ${error.stack}`);
    }
    process.exit(EXIT_CODES.SOFTWARE_ERROR);
  }
}

// ENTRY POINT CHECK
// Only run main() if this file is executed directly (not imported as a module)
// WHY: This allows the server to be imported for testing without auto-starting
if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
