#!/usr/bin/env node
/**
 * STDIO Transport Server for Calculator Learning Demo
 * 
 * This server implements newline-delimited JSON-RPC over stdin/stdout
 * as specified in the learning-edition golden standard.
 */

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

const EXIT_CODES = {
  SUCCESS: 0,
  DATA_ERROR: 65,  // EX_DATAERR
  SOFTWARE_ERROR: 70,  // EX_SOFTWARE
};

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

class Logger {
  constructor(name) {
    this.name = name;
  }

  static create(name) {
    return new Logger(name);
  }

  info(message, details) {
    console.error(`[INFO] [${this.name}] ${message}${details ? ` ${JSON.stringify(details)}` : ''}`);
  }

  error(message, details) {
    console.error(`[ERROR] [${this.name}] ${message}${details ? ` ${JSON.stringify(details)}` : ''}`);
  }

  debug(message, details) {
    if (process.argv.includes('--debug')) {
      console.error(`[DEBUG] [${this.name}] ${message}${details ? ` ${JSON.stringify(details)}` : ''}`);
    }
  }
}

const logger = Logger.create('stdio-transport');
const startTime = Date.now();

// Global state
const calculationHistory = new Map();
let requestCount = 0;

// Progress notification helper
function sendProgressNotification(relatedRequestId, percentage) {
  const notification = {
    jsonrpc: '2.0',
    method: 'progress',
    params: {
      relatedRequestId,
      pct: percentage
    }
  };
  process.stdout.write(JSON.stringify(notification) + '\n');
}

// Send JSON-RPC response
function sendResponse(id, result) {
  const response = {
    jsonrpc: '2.0',
    id,
    result
  };
  process.stdout.write(JSON.stringify(response) + '\n');
}

// Send JSON-RPC error
function sendError(id, code, message) {
  const response = {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message
    }
  };
  process.stdout.write(JSON.stringify(response) + '\n');
}

// Handle calculate tool
async function handleCalculate(params, id) {
  try {
    const { a, b, op, stream } = params;
    
    if (stream) {
      sendProgressNotification(id, 10);
      await new Promise(resolve => setTimeout(resolve, 100));
      sendProgressNotification(id, 50);
      await new Promise(resolve => setTimeout(resolve, 100));
      sendProgressNotification(id, 90);
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
      value: result,
      meta: {
        calculationId: historyEntry.id,
        timestamp: historyEntry.timestamp
      }
    };
  } catch (error) {
    throw error;
  }
}

// Handle batch_calculate tool
async function handleBatchCalculate(params) {
  const { calculations } = params;
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
        calculationId: historyEntry.id
      });
    } catch (error) {
      results.push({
        success: false,
        expression: `${calc.a} ${calc.op} ${calc.b}`,
        error: error.message
      });
    }
  }
  
  return { results };
}

// Handle advanced_calculate tool
async function handleAdvancedCalculate(params) {
  const { operation, n, k, base } = params;
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
    value: result,
    expression,
    calculationId: historyEntry.id
  };
}

// Handle demo_progress tool
async function handleDemoProgress(params, id) {
  for (let i = 1; i <= 5; i++) {
    sendProgressNotification(id, i * 20);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return {
    message: 'Progress demonstration completed',
    progressSteps: [20, 40, 60, 80, 100]
  };
}

// Handle JSON-RPC request
async function handleRequest(message) {
  const { method, params, id } = message;
  requestCount++;
  
  try {
    let result;
    
    switch (method) {
      case 'calculate':
        result = await handleCalculate(params, id);
        break;
      case 'batch_calculate':
        result = await handleBatchCalculate(params);
        break;
      case 'advanced_calculate':
        result = await handleAdvancedCalculate(params);
        break;
      case 'demo_progress':
        result = await handleDemoProgress(params, id);
        break;
      case 'solve_math_problem':
      case 'explain_formula':
      case 'calculator_assistant':
        // These are placeholder implementations
        result = { 
          message: `Tool ${method} called with params: ${JSON.stringify(params)}`,
          note: 'This tool may use elicitInput in a full implementation'
        };
        break;
      
      // Resources
      case 'read_resource':
        if (params.uri === 'calculator://constants') {
          result = MATH_CONSTANTS;
        } else if (params.uri === 'calculator://stats') {
          result = {
            uptimeMs: Date.now() - startTime,
            requestCount
          };
        } else if (params.uri === 'formulas://library') {
          result = FORMULAS_LIBRARY;
        } else if (params.uri && params.uri.startsWith('calculator://history/')) {
          const calcId = params.uri.split('/').pop();
          const calc = calculationHistory.get(calcId);
          if (!calc) {
            throw new Error(`Calculation ${calcId} not found`);
          }
          result = calc;
        } else {
          throw new Error(`Unknown resource: ${params.uri}`);
        }
        break;
        
      // Prompts
      case 'explain-calculation':
      case 'generate-problems':
      case 'calculator-tutor':
        result = { 
          prompt: `Generated prompt for ${method} with args: ${JSON.stringify(params)}` 
        };
        break;
        
      default:
        throw new Error(`Unknown method: ${method}`);
    }
    
    sendResponse(id, result);
  } catch (error) {
    sendError(id, -32603, error.message || 'Internal error');
  }
}

// Main entry point
async function main() {
  try {
    // Handle help flag
    if (process.argv.includes('--help')) {
      console.error(`
Calculator Learning Demo - STDIO Transport

Usage: node server-stdio.js

This server communicates via stdin/stdout using newline-delimited JSON-RPC.
Each message must be a complete JSON object on a single line.

Example:
  echo '{"jsonrpc":"2.0","id":1,"method":"calculate","params":{"a":5,"b":3,"op":"add"}}' | node server-stdio.js

Exit codes:
  0  - Normal shutdown
  65 - Fatal parse error (EX_DATAERR)
  70 - Unhandled exception (EX_SOFTWARE)
`);
      process.exit(EXIT_CODES.SUCCESS);
    }

    logger.info('Starting calculator STDIO server');

    // Set up input handling
    let buffer = '';
    process.stdin.setEncoding('utf8');
    
    process.stdin.on('data', (chunk) => {
      buffer += chunk;
      
      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          try {
            const message = JSON.parse(trimmed);
            
            if (!message.jsonrpc || message.jsonrpc !== '2.0') {
              throw new Error('Invalid JSON-RPC version');
            }
            
            if (message.method && message.id !== undefined) {
              // Request with ID
              handleRequest(message);
            } else if (message.method && message.id === undefined) {
              // Notification (no response needed)
              logger.info(`Received notification: ${message.method}`);
            }
          } catch (error) {
            logger.error(`Failed to parse message: ${error.message}`);
            // For parse errors, exit with data error
            process.exit(EXIT_CODES.DATA_ERROR);
          }
        }
      }
    });

    process.stdin.on('end', () => {
      logger.info('Input stream ended, shutting down');
      process.exit(EXIT_CODES.SUCCESS);
    });

    // Handle signals
    process.on('SIGINT', () => {
      logger.info('Received SIGINT, shutting down');
      process.exit(EXIT_CODES.SUCCESS);
    });

    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM, shutting down');
      process.exit(EXIT_CODES.SUCCESS);
    });

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error(`Uncaught exception: ${error.message}`);
      process.exit(EXIT_CODES.SOFTWARE_ERROR);
    });

    process.on('unhandledRejection', (reason) => {
      logger.error(`Unhandled rejection: ${reason}`);
      process.exit(EXIT_CODES.SOFTWARE_ERROR);
    });

    logger.info('Calculator STDIO server ready');
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(EXIT_CODES.SOFTWARE_ERROR);
  }
}

// Run the server
main();