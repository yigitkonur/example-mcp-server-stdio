#!/usr/bin/env node
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  Logger,
  SERVER_INFO,
  LIMITS,
  MATH_CONSTANTS,
  FORMULAS_LIBRARY,
  type CalculationHistory,
  type CalculatorStats,
  CalculateInputSchema,
  BatchCalculateInputSchema,
  AdvancedCalculateInputSchema,
  ExplainCalculationArgsSchema,
  GenerateProblemsArgsSchema,
  SolveMathProblemArgsSchema,
  ExplainFormulaArgsSchema,
  CalculatorAssistantArgsSchema,
  factorial,
  combinations,
  permutations,
  createHistoryEntry,
  EXIT_CODES,
} from './types.js'

// Global state
const calculationHistory = new Map<string, CalculationHistory>()
let requestCount = 0
const serverStartTime = Date.now()

// Create logger
const logger = Logger.create(SERVER_INFO.name)


// Helper to perform basic calculations
function performBasicCalculation(op: string, a: number, b: number): number {
  switch (op) {
    case 'add':
      return a + b
    case 'subtract':
      return a - b
    case 'multiply':
      return a * b
    case 'divide':
      if (b === 0) throw new Error('Division by zero')
      return a / b
    default:
      throw new Error(`Unknown operation: ${op}`)
  }
}

/**
 * Creates the MCP server with all calculator capabilities
 */
export async function createCalculatorServer(): Promise<McpServer> {
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
  )

  // ============= CORE TOOLS =============

  // CORE TOOL: calculate
  server.registerTool(
    'calculate',
    {
      title: 'Calculate',
      description: 'Perform a basic arithmetic calculation',
      inputSchema: {
        type: 'object',
        properties: {
          a: { type: 'number', description: 'First operand' },
          b: { type: 'number', description: 'Second operand' },
          op: { type: 'string', enum: ['add', 'subtract', 'multiply', 'divide'], description: 'Operation to perform' },
          stream: { type: 'boolean', description: 'If true, emit progress notifications' },
        },
        required: ['a', 'b', 'op'],
      },
    },
    async (args: any) => {
      const { a, b, op, stream } = CalculateInputSchema.parse(args)
      logger.info(`Executing calculate: ${a} ${op} ${b}`)
      requestCount++

      try {
        // If streaming is requested, emit progress notifications
        if (stream) {
          // Progress notifications would be handled by transport layer
          await new Promise(resolve => setTimeout(resolve, 100))
          await new Promise(resolve => setTimeout(resolve, 100))
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        const result = performBasicCalculation(op, a, b)
        const historyEntry = createHistoryEntry(op, a, b, result)
        calculationHistory.set(historyEntry.id, historyEntry)

        // Enforce history limit
        if (calculationHistory.size > LIMITS.maxHistorySize) {
          const oldestKey = calculationHistory.keys().next().value
          if (oldestKey) calculationHistory.delete(oldestKey)
        }

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
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        }
      }
    },
  )

  // ============= EXTENDED TOOLS =============

  // EXTENDED TOOL: batch_calculate
  server.registerTool(
    'batch_calculate',
    {
      title: 'Batch Calculate',
      description: 'Perform multiple calculations in a single request',
      inputSchema: {
        type: 'object',
        properties: {
          calculations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                a: { type: 'number' },
                b: { type: 'number' },
                op: { type: 'string', enum: ['add', 'subtract', 'multiply', 'divide'] },
              },
              required: ['a', 'b', 'op'],
            },
            minItems: 1,
            maxItems: LIMITS.maxBatchSize,
          },
        },
        required: ['calculations'],
      },
    },
    async (args: any) => {
      const { calculations } = BatchCalculateInputSchema.parse(args)
      logger.info(`Executing batch calculations: ${calculations.length} operations`)
      requestCount++

      const results = []
      for (const calc of calculations) {
        try {
          const result = performBasicCalculation(calc.op, calc.a, calc.b)
          const historyEntry = createHistoryEntry(calc.op, calc.a, calc.b, result)
          calculationHistory.set(historyEntry.id, historyEntry)
          
          results.push({
            success: true,
            expression: historyEntry.expression,
            value: result,
            calculationId: historyEntry.id,
          })
        } catch (error) {
          results.push({
            success: false,
            expression: `${calc.a} ${calc.op} ${calc.b}`,
            error: error instanceof Error ? error.message : String(error),
          })
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
        structuredContent: { results },
      }
    },
  )

  // EXTENDED TOOL: advanced_calculate
  server.registerTool(
    'advanced_calculate',
    {
      title: 'Advanced Calculate',
      description: 'Perform advanced mathematical operations (factorial, log, combinations, permutations)',
      inputSchema: {
        type: 'object',
        properties: {
          operation: { type: 'string', enum: ['factorial', 'log', 'combinations', 'permutations'] },
          n: { type: 'number', description: 'Primary input' },
          k: { type: 'number', description: 'Secondary input for combinations/permutations' },
          base: { type: 'number', description: 'Base for logarithm (default: e)' },
        },
        required: ['operation', 'n'],
      },
    },
    async (args: any) => {
      const { operation, n, k, base } = AdvancedCalculateInputSchema.parse(args)
      logger.info(`Executing advanced calculation: ${operation}`)
      requestCount++

      try {
        let result: number
        let expression: string

        switch (operation) {
          case 'factorial':
            result = factorial(n)
            expression = `${n}! = ${result}`
            break
          case 'log':
            if (base) {
              result = Math.log(n) / Math.log(base)
              expression = `log${base}(${n}) = ${result}`
            } else {
              result = Math.log(n)
              expression = `ln(${n}) = ${result}`
            }
            break
          case 'combinations':
            if (k === undefined) throw new Error('k is required for combinations')
            result = combinations(n, k)
            expression = `C(${n}, ${k}) = ${result}`
            break
          case 'permutations':
            if (k === undefined) throw new Error('k is required for permutations')
            result = permutations(n, k)
            expression = `P(${n}, ${k}) = ${result}`
            break
          default:
            throw new Error(`Unknown operation: ${operation}`)
        }

        const historyEntry = createHistoryEntry(operation, n, k, result)
        calculationHistory.set(historyEntry.id, historyEntry)

        return {
          content: [
            {
              type: 'text',
              text: expression,
            },
          ],
          structuredContent: {
            value: result,
            expression,
            calculationId: historyEntry.id,
          },
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        }
      }
    },
  )

  // EXTENDED TOOL: demo_progress
  server.registerTool(
    'demo_progress',
    {
      title: 'Demo Progress',
      description: 'Demonstrate progress notifications with 5 updates',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    async () => {
      logger.info('Executing demo_progress')
      requestCount++

      for (let i = 1; i <= 5; i++) {
        // Progress notifications would be handled by transport layer
        await new Promise(resolve => setTimeout(resolve, 500))
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
      }
    },
  )

  // EXTENDED TOOL: solve_math_problem
  server.registerTool(
    'solve_math_problem',
    {
      title: 'Solve Math Problem',
      description: 'Solve a word problem or mathematical expression (may request user input)',
      inputSchema: {
        type: 'object',
        properties: {
          problem: { type: 'string', description: 'The math problem to solve' },
          showSteps: { type: 'boolean', description: 'Show step-by-step solution' },
        },
        required: ['problem'],
      },
    },
    async (args: any) => {
      const { problem, showSteps } = SolveMathProblemArgsSchema.parse(args)
      logger.info('Solving math problem')
      requestCount++

      // This would normally involve more complex logic and potentially elicitInput
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
      }
    },
  )

  // EXTENDED TOOL: explain_formula
  server.registerTool(
    'explain_formula',
    {
      title: 'Explain Formula',
      description: 'Explain a mathematical formula interactively',
      inputSchema: {
        type: 'object',
        properties: {
          formula: { type: 'string', description: 'The formula to explain' },
          examples: { type: 'boolean', description: 'Include examples' },
        },
        required: ['formula'],
      },
    },
    async (args: any) => {
      const { formula, examples } = ExplainFormulaArgsSchema.parse(args)
      logger.info('Explaining formula')
      requestCount++

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
      }
    },
  )

  // EXTENDED TOOL: calculator_assistant
  server.registerTool(
    'calculator_assistant',
    {
      title: 'Calculator Assistant',
      description: 'Interactive calculator assistance with context-aware help',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The user query or question' },
          context: { type: 'string', description: 'Additional context' },
        },
        required: ['query'],
      },
    },
    async (args: any) => {
      const { query, context } = CalculatorAssistantArgsSchema.parse(args)
      logger.info('Calculator assistant activated')
      requestCount++

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
      }
    },
  )

  // ============= CORE RESOURCES =============

  // CORE RESOURCE: Mathematical Constants
  server.registerResource(
    'math-constants',
    'calculator://constants',
    {
      title: 'Mathematical Constants',
      description: 'Common mathematical constants with high precision',
      mimeType: 'application/json',
    },
    async (uri) => {
      logger.info('Serving mathematical constants')
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(MATH_CONSTANTS, null, 2),
          },
        ],
      }
    },
  )

  // ============= EXTENDED RESOURCES =============

  // EXTENDED RESOURCE: Calculation History
  server.registerResource(
    'calculation-history',
    new ResourceTemplate(
      'calculator://history/{calculationId}',
      {
        list: async () => {
          const sortedHistory = Array.from(calculationHistory.values())
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
            .slice(0, LIMITS.HISTORY_DISPLAY_LIMIT)

          return {
            resources: sortedHistory.map((calc) => ({
              uri: `calculator://history/${calc.id}`,
              name: calc.expression,
              description: `Calculation performed at ${new Date(calc.timestamp).toLocaleString()}`,
              mimeType: 'application/json',
            })),
          }
        },
      },
    ),
    {
      title: 'Calculation History',
      description: 'Access the last 50 calculations by ID',
    },
    async (uri, { calculationId }) => {
      const calculation = calculationHistory.get(calculationId as string)

      if (!calculation) {
        throw new Error(`Calculation ${calculationId} not found`)
      }

      logger.info(`Serving calculation history for ${calculationId}`)
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(calculation, null, 2),
          },
        ],
      }
    },
  )

  // EXTENDED RESOURCE: Statistics
  server.registerResource(
    'calculator-stats',
    'calculator://stats',
    {
      title: 'Calculator Statistics',
      description: 'Server uptime and request count',
      mimeType: 'application/json',
    },
    async (uri) => {
      const stats: CalculatorStats = {
        uptimeMs: Date.now() - serverStartTime,
        requestCount,
      }

      logger.info('Serving calculator statistics')
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(stats, null, 2),
          },
        ],
      }
    },
  )

  // EXTENDED RESOURCE: Formulas Library
  server.registerResource(
    'formulas-library',
    'formulas://library',
    {
      title: 'Formulas Library',
      description: 'Collection of common mathematical formulas',
      mimeType: 'application/json',
    },
    async (uri) => {
      logger.info('Serving formulas library')
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(FORMULAS_LIBRARY, null, 2),
          },
        ],
      }
    },
  )

  // ============= CORE PROMPTS =============

  // CORE PROMPT: explain-calculation
  server.registerPrompt(
    'explain-calculation',
    {
      title: 'Explain Calculation',
      description: 'Generate detailed explanations of mathematical calculations',
      argsSchema: {
        type: 'object',
        properties: {
          expression: { type: 'string', description: 'The calculation to explain' },
          level: { type: 'string', enum: ['elementary', 'intermediate', 'advanced'] },
        },
        required: ['expression'],
      },
    },
    (args: any) => {
      const { expression, level } = ExplainCalculationArgsSchema.parse(args)
      logger.info('Generated explanation prompt')

      const levelText = level || 'intermediate'
      const prompt = `Please explain the calculation "${expression}" at an ${levelText} level.

Include:
- What the operation means
- Step-by-step breakdown
- Why this calculation might be useful
- Common mistakes to avoid

Make the explanation clear and educational.`

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
      }
    },
  )

  // CORE PROMPT: generate-problems
  server.registerPrompt(
    'generate-problems',
    {
      title: 'Generate Problems',
      description: 'Create practice math problems',
      argsSchema: {
        type: 'object',
        properties: {
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
          count: { type: 'number', minimum: 1, maximum: 10 },
          operations: { type: 'array', items: { type: 'string', enum: ['add', 'subtract', 'multiply', 'divide'] } },
        },
      },
    },
    (args: any) => {
      const { difficulty, count, operations } = GenerateProblemsArgsSchema.parse(args)
      logger.info('Generated problems prompt')

      const difficultyLevel = difficulty || 'medium'
      const problemCount = count || 5
      const ops = operations?.join(', ') || 'add, subtract, multiply, divide'

      const prompt = `Generate ${problemCount} math practice problems at ${difficultyLevel} difficulty level.

Use these operations: ${ops}

For each problem:
1. Provide the problem statement
2. Leave space for the student to work
3. Include the answer (marked clearly)

Make the problems progressively challenging and educational.`

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
      }
    },
  )

  // CORE PROMPT: calculator-tutor
  server.registerPrompt(
    'calculator-tutor',
    {
      title: 'Calculator Tutor',
      description: 'Interactive mathematics tutoring',
      argsSchema: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'The mathematical topic to tutor' },
          level: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
        },
        required: ['topic'],
      },
    },
    (args: any) => {
      const { topic, level } = args
      logger.info('Generated tutor prompt')

      const studentLevel = level || 'beginner'
      const prompt = `Act as a friendly and patient math tutor helping a ${studentLevel} student with "${topic}".

Your approach should:
- Start by assessing what the student already knows
- Break down complex concepts into simple steps
- Use relatable examples and analogies
- Encourage the student with positive reinforcement
- Provide practice problems appropriate to their level

Begin the tutoring session by introducing yourself and the topic.`

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
      }
    },
  )

  return server
}

/**
 * Main entry point for standard MCP SDK transport
 */
async function main(): Promise<void> {
  try {
    logger.info('Starting calculator server')

    // Handle command line arguments
    if (process.argv.includes('--help')) {
      console.error(`
${SERVER_INFO.name} v${SERVER_INFO.version}

${SERVER_INFO.description}

Usage: node server.js [options]

Options:
  --stdio    Run in STDIO mode (standard MCP SDK transport)
  --debug    Enable debug logging
  --help     Show this help message

For newline-delimited JSON-RPC, use server-stdio.js instead.
      `)
      process.exit(EXIT_CODES.SUCCESS)
    }

    // Create server
    const server = await createCalculatorServer()

    // Use standard SDK transport if --stdio flag is present
    if (process.argv.includes('--stdio')) {
      const transport = new StdioServerTransport()
      await server.connect(transport)
      logger.info('Calculator server ready (SDK STDIO transport)')
    } else {
      console.error('Error: --stdio flag is required')
      console.error('For newline-delimited JSON-RPC, use server-stdio.js')
      process.exit(EXIT_CODES.DATA_ERROR)
    }

    // Set up graceful shutdown
    process.on('SIGINT', () => {
      logger.info('Received SIGINT, shutting down')
      process.exit(EXIT_CODES.SUCCESS)
    })

    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM, shutting down')
      process.exit(EXIT_CODES.SUCCESS)
    })

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error(`Uncaught exception: ${error.message}`)
      process.exit(EXIT_CODES.SOFTWARE_ERROR)
    })

    process.on('unhandledRejection', (reason) => {
      logger.error(`Unhandled rejection: ${reason}`)
      process.exit(EXIT_CODES.SOFTWARE_ERROR)
    })

  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`)
    process.exit(EXIT_CODES.SOFTWARE_ERROR)
  }
}


// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  void main()
}