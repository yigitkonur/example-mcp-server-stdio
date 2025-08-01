#!/usr/bin/env node
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Constants and utilities
const MATH_CONSTANTS = {
  pi: Math.PI,
  e: Math.E,
  phi: (1 + Math.sqrt(5)) / 2,
  sqrt2: Math.SQRT2,
  ln2: Math.LN2,
  ln10: Math.LN10,
};

const FORMULAS_LIBRARY = [
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

// Utility functions
function factorial(n) {
  if (n < 0) throw new Error('Factorial is not defined for negative numbers');
  if (n === 0 || n === 1) return 1;
  if (n > 170) throw new Error('Factorial too large');
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

function combinations(n, k) {
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;
  return factorial(n) / (factorial(k) * factorial(n - k));
}

function permutations(n, k) {
  if (k > n) return 0;
  return factorial(n) / factorial(n - k);
}

function createHistoryEntry(operation, a, b, result) {
  const id = Math.random().toString(36).substring(7);
  const expression = formatExpression(operation, a, b, result);
  
  return {
    id,
    timestamp: new Date().toISOString(),
    operation,
    input_1: a,
    input_2: b,
    result,
    expression,
  };
}

function formatExpression(operation, a, b, result) {
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

// Global state
const calculationHistory = new Map();
let requestCount = 0;
const serverStartTime = Date.now();

// Create MCP Server
const server = new McpServer({
  name: "calculator-learning-demo-stdio",
  version: "1.0.0"
});

// ============= CORE TOOLS =============

// CORE TOOL: calculate
server.registerTool(
  "calculate",
  {
    title: "Calculate",
    description: "Perform a basic arithmetic calculation",
    inputSchema: {
      a: z.number().describe("First operand"),
      b: z.number().describe("Second operand"), 
      op: z.enum(["add", "subtract", "multiply", "divide"]).describe("Operation to perform"),
      stream: z.boolean().optional().describe("If true, emit progress notifications"),
    }
  },
  async ({ a, b, op, stream }) => {
    requestCount++;

    try {
      if (stream) {
        // Progress notifications would be handled by transport layer
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      let result;
      switch (op) {
        case 'add':
          result = a + b;
          break;
        case 'subtract':
          result = a - b;
          break;
        case 'multiply':
          result = a * b;
          break;
        case 'divide':
          if (b === 0) throw new Error('Division by zero');
          result = a / b;
          break;
        default:
          throw new Error(`Unknown operation: ${op}`);
      }

      const historyEntry = createHistoryEntry(op, a, b, result);
      calculationHistory.set(historyEntry.id, historyEntry);

      return {
        content: [
          {
            type: 'text',
            text: historyEntry.expression,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`,
          },
        ],
      };
    }
  }
);

// ============= EXTENDED TOOLS =============

// EXTENDED TOOL: batch_calculate
server.registerTool(
  "batch_calculate",
  {
    title: "Batch Calculate",
    description: "Perform multiple calculations in a single request",
    inputSchema: {
      calculations: z.array(z.object({
        a: z.number(),
        b: z.number(),
        op: z.enum(["add", "subtract", "multiply", "divide"]),
      })).min(1).max(100).describe("Array of calculations to perform"),
    }
  },
  async ({ calculations }) => {
    requestCount++;

    const results = [];
    for (const calc of calculations) {
      try {
        let result;
        switch (calc.op) {
          case 'add':
            result = calc.a + calc.b;
            break;
          case 'subtract':
            result = calc.a - calc.b;
            break;
          case 'multiply':
            result = calc.a * calc.b;
            break;
          case 'divide':
            if (calc.b === 0) throw new Error('Division by zero');
            result = calc.a / calc.b;
            break;
          default:
            throw new Error(`Unknown operation: ${calc.op}`);
        }

        const historyEntry = createHistoryEntry(calc.op, calc.a, calc.b, result);
        calculationHistory.set(historyEntry.id, historyEntry);

        results.push({
          success: true,
          expression: historyEntry.expression,
          value: result,
          calculationId: historyEntry.id,
        });
      } catch (error) {
        results.push({
          success: false,
          expression: `${calc.a} ${calc.op} ${calc.b}`,
          error: error.message,
        });
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: results.map(r => 
            r.success ? r.expression : `Error in ${r.expression}: ${r.error}`
          ).join('\n'),
        },
      ],
    };
  }
);

// EXTENDED TOOL: advanced_calculate
server.registerTool(
  "advanced_calculate",
  {
    title: "Advanced Calculate",
    description: "Perform advanced mathematical operations (factorial, log, combinations, permutations)",
    inputSchema: {
      operation: z.enum(["factorial", "log", "combinations", "permutations"]).describe("Advanced operation type"),
      n: z.number().describe("Primary input"),
      k: z.number().optional().describe("Secondary input for combinations/permutations"),
      base: z.number().optional().describe("Base for logarithm (default: e)"),
    }
  },
  async ({ operation, n, k, base }) => {
    requestCount++;

    try {
      let result;
      let expression;

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
          if (k === undefined) throw new Error('k is required for combinations');
          result = combinations(n, k);
          expression = `C(${n}, ${k}) = ${result}`;
          break;
        case 'permutations':
          if (k === undefined) throw new Error('k is required for permutations');
          result = permutations(n, k);
          expression = `P(${n}, ${k}) = ${result}`;
          break;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      const historyEntry = createHistoryEntry(operation, n, k, result);
      calculationHistory.set(historyEntry.id, historyEntry);

      return {
        content: [
          {
            type: 'text',
            text: expression,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`,
          },
        ],
      };
    }
  }
);

// EXTENDED TOOL: demo_progress
server.registerTool(
  "demo_progress",
  {
    title: "Demo Progress",
    description: "Demonstrate progress notifications with 5 updates",
    inputSchema: {}
  },
  async () => {
    requestCount++;

    // Simulate work with delays
    for (let i = 1; i <= 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return {
      content: [
        {
          type: 'text',
          text: 'Progress demonstration completed',
        },
      ],
    };
  }
);

// EXTENDED TOOL: solve_math_problem
server.registerTool(
  "solve_math_problem",
  {
    title: "Solve Math Problem",
    description: "Solve a word problem or mathematical expression (may request user input)",
    inputSchema: {
      problem: z.string().describe("The math problem to solve"),
      showSteps: z.boolean().optional().describe("Show step-by-step solution"),
    }
  },
  async ({ problem, showSteps }) => {
    requestCount++;

    return {
      content: [
        {
          type: 'text',
          text: `## Solving: ${problem}\n\n` +
                `This is a demonstration of the solve_math_problem tool.\n` +
                `${showSteps ? '\n### Steps:\n1. Analyze the problem\n2. Identify key values\n3. Apply appropriate formula\n4. Calculate result\n' : ''}\n` +
                `**Note**: In a full implementation, this tool may use elicitInput to ask for clarification.`,
        },
      ],
    };
  }
);

// EXTENDED TOOL: explain_formula
server.registerTool(
  "explain_formula",
  {
    title: "Explain Formula",
    description: "Explain a mathematical formula interactively",
    inputSchema: {
      formula: z.string().describe("The formula to explain"),
      examples: z.boolean().optional().describe("Include examples"),
    }
  },
  async ({ formula, examples }) => {
    requestCount++;

    return {
      content: [
        {
          type: 'text',
          text: `## Formula Explanation: ${formula}\n\n` +
                `This tool provides interactive explanations of mathematical formulas.\n` +
                `${examples ? '\n### Examples:\n- Example calculations would be shown here\n- Visual representations might be included\n' : ''}\n` +
                `**Note**: This tool may use elicitInput for interactive learning.`,
        },
      ],
    };
  }
);

// EXTENDED TOOL: calculator_assistant
server.registerTool(
  "calculator_assistant",
  {
    title: "Calculator Assistant",
    description: "Interactive calculator assistance with context-aware help",
    inputSchema: {
      query: z.string().describe("The user query or question"),
      context: z.string().optional().describe("Additional context"),
    }
  },
  async ({ query, context }) => {
    requestCount++;

    return {
      content: [
        {
          type: 'text',
          text: `## Calculator Assistant\n\n` +
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
  }
);

// ============= CORE RESOURCES =============

// CORE RESOURCE: Mathematical Constants
server.registerResource(
  "math-constants",
  "calculator://constants",
  {
    title: "Mathematical Constants",
    description: "Common mathematical constants with high precision",
    mimeType: "application/json"
  },
  async (uri) => {
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(MATH_CONSTANTS, null, 2),
        },
      ],
    };
  }
);

// ============= EXTENDED RESOURCES =============

// EXTENDED RESOURCE: Statistics
server.registerResource(
  "calculator-stats",
  "calculator://stats", 
  {
    title: "Calculator Statistics",
    description: "Server uptime and request count",
    mimeType: "application/json"
  },
  async (uri) => {
    const stats = {
      uptimeMs: Date.now() - serverStartTime,
      requestCount,
    };

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(stats, null, 2),
        },
      ],
    };
  }
);

// EXTENDED RESOURCE: Formulas Library
server.registerResource(
  "formulas-library",
  "formulas://library",
  {
    title: "Formulas Library",
    description: "Collection of common mathematical formulas",
    mimeType: "application/json"
  },
  async (uri) => {
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(FORMULAS_LIBRARY, null, 2),
        },
      ],
    };
  }
);

// EXTENDED RESOURCE: Calculation History (Dynamic)
server.registerResource(
  "calculation-history",
  new ResourceTemplate("calculator://history/{calculationId}", { list: undefined }),
  {
    title: "Calculation History",
    description: "Individual calculation history entry"
  },
  async (uri, { calculationId }) => {
    const calc = calculationHistory.get(calculationId);
    if (!calc) {
      throw new Error(`Calculation ${calculationId} not found`);
    }

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(calc, null, 2),
        },
      ],
    };
  }
);

// ============= CORE PROMPTS =============

// CORE PROMPT: explain-calculation
server.registerPrompt(
  "explain-calculation",
  {
    title: "Explain Calculation",
    description: "Generate detailed explanations of mathematical calculations",
    argsSchema: {
      expression: z.string().describe("The calculation to explain"),
      level: z.enum(["elementary", "intermediate", "advanced"]).optional(),
    }
  },
  ({ expression, level }) => {
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
  }
);

// CORE PROMPT: generate-problems
server.registerPrompt(
  "generate-problems",
  {
    title: "Generate Problems",
    description: "Create practice math problems",
    argsSchema: {
      difficulty: z.enum(["easy", "medium", "hard"]).optional(),
      count: z.number().min(1).max(10).optional(),
      operations: z.array(z.enum(["add", "subtract", "multiply", "divide"])).optional(),
    }
  },
  ({ difficulty, count, operations }) => {
    const difficultyLevel = difficulty || 'medium';
    const problemCount = count || 5;
    const ops = operations?.join(', ') || 'add, subtract, multiply, divide';

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
  }
);

// CORE PROMPT: calculator-tutor
server.registerPrompt(
  "calculator-tutor",
  {
    title: "Calculator Tutor",
    description: "Interactive mathematics tutoring",
    argsSchema: {
      topic: z.string().describe("The mathematical topic to tutor"),
      level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
    }
  },
  ({ topic, level }) => {
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
  }
);

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);

console.error('[INFO] Calculator MCP server ready (Modern SDK)');