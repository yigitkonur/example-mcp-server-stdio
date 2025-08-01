import { z } from 'zod';

export type Operation = 'add' | 'subtract' | 'multiply' | 'divide' | 'power' | 'sqrt' | 'factorial' | 'log' | 'combinations' | 'permutations';

export interface CalculationHistory {
  id: string;
  timestamp: string;
  operation: Operation;
  input_1: number;
  input_2: number | undefined;
  result: number;
  expression: string;
}

export interface CalculatorStats {
  uptimeMs: number;
  requestCount: number;
}

export const MATH_CONSTANTS = {
  pi: Math.PI,
  e: Math.E,
  phi: (1 + Math.sqrt(5)) / 2,
  sqrt2: Math.SQRT2,
  ln2: Math.LN2,
  ln10: Math.LN10,
} as const;

export const FORMULAS_LIBRARY = [
  {
    name: "Quadratic Formula",
    formula: "x = (-b ± √(b² - 4ac)) / 2a",
    description: "Solves quadratic equations of the form ax² + bx + c = 0"
  },
  {
    name: "Pythagorean Theorem",
    formula: "a² + b² = c²",
    description: "Relates the sides of a right triangle"
  },
  {
    name: "Area of Circle",
    formula: "A = πr²",
    description: "Calculates the area of a circle given its radius"
  },
  {
    name: "Compound Interest",
    formula: "A = P(1 + r/n)^(nt)",
    description: "Calculates compound interest over time"
  },
  {
    name: "Distance Formula",
    formula: "d = √((x₂-x₁)² + (y₂-y₁)²)",
    description: "Calculates distance between two points"
  }
];

export const SERVER_INFO = {
  name: 'calculator-learning-demo-stdio',
  version: '1.0.0',
  description: 'Learning-edition MCP calculator server demonstrating STDIO transport',
};

export const LIMITS = {
  maxHistorySize: 50,
  maxBatchSize: 100,
  HISTORY_DISPLAY_LIMIT: 50,
};

// Exit codes
export const EXIT_CODES = {
  SUCCESS: 0,
  DATA_ERROR: 65,  // EX_DATAERR
  SOFTWARE_ERROR: 70,  // EX_SOFTWARE
} as const;

// Schema definitions
export const CalculateInputSchema = z.object({
  a: z.number().describe('First operand'),
  b: z.number().describe('Second operand'),
  op: z.enum(['add', 'subtract', 'multiply', 'divide']).describe('Operation to perform'),
  stream: z.boolean().optional().describe('If true, emit progress notifications'),
});

export const BatchCalculateInputSchema = z.object({
  calculations: z.array(z.object({
    a: z.number(),
    b: z.number(),
    op: z.enum(['add', 'subtract', 'multiply', 'divide']),
  })).min(1).max(LIMITS.maxBatchSize),
});

export const AdvancedCalculateInputSchema = z.object({
  operation: z.enum(['factorial', 'log', 'combinations', 'permutations']),
  n: z.number().describe('Primary input'),
  k: z.number().optional().describe('Secondary input for combinations/permutations'),
  base: z.number().optional().describe('Base for logarithm (default: e)'),
});

export const ExplainCalculationArgsSchema = z.object({
  expression: z.string().describe('The calculation to explain'),
  level: z.enum(['elementary', 'intermediate', 'advanced']).optional(),
});

export const GenerateProblemsArgsSchema = z.object({
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  count: z.number().min(1).max(10).optional(),
  operations: z.array(z.enum(['add', 'subtract', 'multiply', 'divide'])).optional(),
});

export const SolveMathProblemArgsSchema = z.object({
  problem: z.string().describe('The math problem to solve'),
  showSteps: z.boolean().optional(),
});

export const ExplainFormulaArgsSchema = z.object({
  formula: z.string().describe('The formula to explain'),
  examples: z.boolean().optional().describe('Include examples'),
});

export const CalculatorAssistantArgsSchema = z.object({
  query: z.string().describe('The user query or question'),
  context: z.string().optional().describe('Additional context'),
});

// Utility functions
export function factorial(n: number): number {
  if (n < 0) throw new Error('Factorial is not defined for negative numbers');
  if (n === 0 || n === 1) return 1;
  if (n > 170) throw new Error('Factorial too large');
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

export function combinations(n: number, k: number): number {
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;
  return factorial(n) / (factorial(k) * factorial(n - k));
}

export function permutations(n: number, k: number): number {
  if (k > n) return 0;
  return factorial(n) / factorial(n - k);
}

export function createHistoryEntry(
  operation: string,
  a: number,
  b: number | undefined,
  result: number
): CalculationHistory {
  const id = Math.random().toString(36).substring(7);
  const expression = formatExpression(operation, a, b, result);
  
  return {
    id,
    timestamp: new Date().toISOString(),
    operation: operation as Operation,
    input_1: a,
    input_2: b,
    result,
    expression,
  };
}

function formatExpression(operation: string, a: number, b?: number, result?: number): string {
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

export class Logger {
  static create(name: string) {
    return new Logger(name);
  }

  constructor(private name: string) {}

  info(message: string, details?: any) {
    console.error(`[INFO] [${this.name}] ${message}${details ? ` ${JSON.stringify(details)}` : ''}`);
  }
  
  error(message: string, details?: any) {
    console.error(`[ERROR] [${this.name}] ${message}${details ? ` ${JSON.stringify(details)}` : ''}`);
  }
  
  debug(message: string, details?: any) {
    if (process.argv.includes('--debug')) {
      console.error(`[DEBUG] [${this.name}] ${message}${details ? ` ${JSON.stringify(details)}` : ''}`);
    }
  }
}