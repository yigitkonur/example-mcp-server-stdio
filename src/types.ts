// =================================================================================
// src/types.ts
//
// PURPOSE:
//   - Defines shared, static data structures and constants used across the server.
//   - Exports the global logger utility.
//   - Contains pure type interfaces (e.g., HistoryEntry).
//
// STYLE-GUIDE:
//   - This file should NOT contain business logic (functions).
//   - This file should NOT contain Zod schemas for specific tools/prompts.
//     Those belong with their respective registrations in `server.ts`.
// =================================================================================

/**
 * Global, static information about the server.
 */
export const SERVER_INFO = {
  name: 'calculator-learning-demo-stdio',
  version: '1.0.0',
  description: 'Learning-edition MCP calculator server demonstrating STDIO transport',
};

/**
 * Standard exit codes for process termination. Follows standard UNIX conventions.
 */
export const EXIT_CODES = {
  SUCCESS: 0,
  SOFTWARE_ERROR: 70, // EX_SOFTWARE: An internal software error has been detected.
};

/**
 * A library of high-precision mathematical constants.
 */
export const MATH_CONSTANTS = {
  pi: Math.PI,
  e: Math.E,
  phi: (1 + Math.sqrt(5)) / 2,
  sqrt2: Math.SQRT2,
  ln2: Math.LN2,
  ln10: Math.LN10,
};

/**
 * A static, in-memory knowledge base of mathematical formulas.
 */
export const FORMULAS_LIBRARY = [
  {
    name: 'Quadratic Formula',
    formula: 'x = (-b ± √(b² - 4ac)) / 2a',
    description: 'Solves quadratic equations of the form ax² + bx + c = 0',
  },
  {
    name: 'Pythagorean Theorem',
    formula: 'a² + b² = c²',
    description: 'Relates the sides of a right triangle',
  },
  {
    name: 'Area of Circle',
    formula: 'A = πr²',
    description: 'Calculates the area of a circle given its radius',
  },
  {
    name: 'Compound Interest',
    formula: 'A = P(1 + r/n)^(nt)',
    description: 'Calculates compound interest over time',
  },
  {
    name: 'Distance Formula',
    formula: 'd = √((x₂-x₁)² + (y₂-y₁)²)',
    description: 'Calculates distance between two points',
  },
];

/**
 * A simple, protocol-compliant logger.
 * WHY: In STDIO transport, `stdout` is reserved for JSON-RPC messages.
 * All logging, debugging, or other text MUST go to `stderr` to avoid
 * corrupting the communication channel. `console.error` writes to stderr.
 */
export const log = {
  info: (msg: string) => console.error(`[INFO] ${msg}`),
  error: (msg: string) => console.error(`[ERROR] ${msg}`),
  debug: (msg: string) => process.argv.includes('--debug') && console.error(`[DEBUG] ${msg}`),
};

/**
 * Defines the data structure for a single entry in the calculation history.
 */
export interface HistoryEntry {
  id: string;
  timestamp: string;
  operation: string;
  input_1: number;
  input_2: number | undefined;
  result: number;
  expression: string;
}
