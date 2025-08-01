#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

/**
 * Simple calculator server for testing MCP Inspector
 */
async function createSimpleServer(): Promise<McpServer> {
  const server = new McpServer(
    {
      name: 'simple-calculator',
      version: '1.0.0',
    },
    {
      instructions: 'A simple calculator server with basic arithmetic operations, resources, and prompts.',
    },
  )

  // Register simple add tool
  server.registerTool(
    'add',
    {
      title: 'Add Numbers',
      description: 'Add two numbers together',
      inputSchema: {
        type: 'object',
        properties: {
          a: { type: 'number', description: 'First number' },
          b: { type: 'number', description: 'Second number' },
        },
        required: ['a', 'b'],
      },
    },
    async ({ a, b }: { a: number; b: number }) => {
      const result = a + b
      return {
        content: [
          {
            type: 'text',
            text: `${a} + ${b} = ${result}`,
          },
        ],
        structuredContent: {
          result,
          expression: `${a} + ${b} = ${result}`,
        },
      }
    },
  )

  // Register subtract tool
  server.registerTool(
    'subtract',
    {
      title: 'Subtract Numbers',
      description: 'Subtract second number from first',
      inputSchema: {
        type: 'object',
        properties: {
          a: { type: 'number', description: 'First number' },
          b: { type: 'number', description: 'Second number' },
        },
        required: ['a', 'b'],
      },
    },
    async ({ a, b }: { a: number; b: number }) => {
      const result = a - b
      return {
        content: [
          {
            type: 'text',
            text: `${a} - ${b} = ${result}`,
          },
        ],
        structuredContent: {
          result,
          expression: `${a} - ${b} = ${result}`,
        },
      }
    },
  )

  // Register multiply tool
  server.registerTool(
    'multiply',
    {
      title: 'Multiply Numbers',
      description: 'Multiply two numbers',
      inputSchema: {
        type: 'object',
        properties: {
          a: { type: 'number', description: 'First number' },
          b: { type: 'number', description: 'Second number' },
        },
        required: ['a', 'b'],
      },
    },
    async ({ a, b }: { a: number; b: number }) => {
      const result = a * b
      return {
        content: [
          {
            type: 'text',
            text: `${a} × ${b} = ${result}`,
          },
        ],
        structuredContent: {
          result,
          expression: `${a} × ${b} = ${result}`,
        },
      }
    },
  )

  // Register divide tool
  server.registerTool(
    'divide',
    {
      title: 'Divide Numbers',
      description: 'Divide first number by second',
      inputSchema: {
        type: 'object',
        properties: {
          a: { type: 'number', description: 'First number' },
          b: { type: 'number', description: 'Second number' },
        },
        required: ['a', 'b'],
      },
    },
    async ({ a, b }: { a: number; b: number }) => {
      if (b === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: Cannot divide by zero',
            },
          ],
          isError: true,
        }
      }
      const result = a / b
      return {
        content: [
          {
            type: 'text',
            text: `${a} ÷ ${b} = ${result}`,
          },
        ],
        structuredContent: {
          result,
          expression: `${a} ÷ ${b} = ${result}`,
        },
      }
    },
  )

  // Register batch calculator tool
  server.registerTool(
    'batch_calculate',
    {
      title: 'Batch Calculator',
      description: 'Perform multiple calculations at once',
      inputSchema: {
        type: 'object',
        properties: {
          calculations: {
            type: 'array',
            description: 'Array of calculations to perform',
            items: {
              type: 'object',
              properties: {
                operation: { type: 'string', enum: ['add', 'subtract', 'multiply', 'divide'] },
                a: { type: 'number' },
                b: { type: 'number' },
              },
              required: ['operation', 'a', 'b'],
            },
          },
        },
        required: ['calculations'],
      },
    },
    async ({ calculations }: { calculations: Array<{ operation: string; a: number; b: number }> }) => {
      const results = calculations.map((calc) => {
        const { operation, a, b } = calc
        let result: number
        let expression: string

        switch (operation) {
          case 'add':
            result = a + b
            expression = `${a} + ${b} = ${result}`
            break
          case 'subtract':
            result = a - b
            expression = `${a} - ${b} = ${result}`
            break
          case 'multiply':
            result = a * b
            expression = `${a} × ${b} = ${result}`
            break
          case 'divide':
            if (b === 0) return { operation, error: 'Cannot divide by zero' }
            result = a / b
            expression = `${a} ÷ ${b} = ${result}`
            break
          default:
            return { operation, error: 'Unknown operation' }
        }

        return { operation, result, expression }
      })

      return {
        content: [
          {
            type: 'text',
            text: results.map((r) => ('error' in r ? `${r.operation}: ${r.error}` : r.expression)).join('\n'),
          },
        ],
        structuredContent: { results },
      }
    },
  )

  // Register math constants resource
  server.registerResource(
    'math-constants',
    'calculator://constants',
    {
      title: 'Mathematical Constants',
      description: 'Common mathematical constants',
      mimeType: 'application/json',
    },
    async () => {
      const constants = {
        pi: Math.PI,
        e: Math.E,
        phi: (1 + Math.sqrt(5)) / 2,
        sqrt2: Math.SQRT2,
        ln2: Math.LN2,
        ln10: Math.LN10,
      }
      return {
        contents: [
          {
            uri: 'calculator://constants',
            mimeType: 'application/json',
            text: JSON.stringify(constants, null, 2),
          },
        ],
      }
    },
  )

  // Register calculator stats resource
  server.registerResource(
    'calculator-stats',
    'calculator://stats',
    {
      title: 'Calculator Statistics',
      description: 'Usage statistics',
      mimeType: 'application/json',
    },
    async () => {
      const stats = {
        totalCalculations: 0,
        startTime: new Date().toISOString(),
        uptime: process.uptime(),
      }
      return {
        contents: [
          {
            uri: 'calculator://stats',
            mimeType: 'application/json',
            text: JSON.stringify(stats, null, 2),
          },
        ],
      }
    },
  )

  // Register calculation history resource
  server.registerResource(
    'calculation-history',
    'calculator://history',
    {
      title: 'Calculation History',
      description: 'Recent calculations',
      mimeType: 'application/json',
    },
    async () => {
      const history = [
        {
          id: 'calc_1',
          expression: '2 + 3 = 5',
          timestamp: new Date().toISOString(),
        },
        {
          id: 'calc_2',
          expression: '10 × 4 = 40',
          timestamp: new Date().toISOString(),
        },
      ]
      return {
        contents: [
          {
            uri: 'calculator://history',
            mimeType: 'application/json',
            text: JSON.stringify(history, null, 2),
          },
        ],
      }
    },
  )

  // Register explain calculation prompt
  server.registerPrompt(
    'explain-calculation',
    {
      title: 'Explain Calculation',
      description: 'Generate an explanation for a mathematical operation',
      argsSchema: {
        type: 'object',
        properties: {
          operation: { type: 'string', enum: ['add', 'subtract', 'multiply', 'divide'] },
          a: { type: 'number' },
          b: { type: 'number' },
          level: { type: 'string', enum: ['elementary', 'intermediate', 'advanced'], default: 'intermediate' },
        },
        required: ['operation', 'a', 'b'],
      },
    },
    ({ operation, a, b, level = 'intermediate' }: { operation: string; a: number; b: number; level?: string }) => {
      const prompt = `Please explain how to ${operation} ${a} and ${b} at a ${level} level. Include step-by-step process and why this operation is useful.`
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

  // Register generate problems prompt
  server.registerPrompt(
    'generate-problems',
    {
      title: 'Generate Math Problems',
      description: 'Generate practice math problems',
      argsSchema: {
        type: 'object',
        properties: {
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'], default: 'medium' },
          count: { type: 'number', default: 5 },
          operations: {
            type: 'array',
            items: { type: 'string', enum: ['add', 'subtract', 'multiply', 'divide'] },
          },
        },
      },
    },
    ({ difficulty = 'medium', count = 5, operations = ['add', 'subtract', 'multiply', 'divide'] }: {
      difficulty?: string
      count?: number
      operations?: string[]
    }) => {
      const prompt = `Generate ${count} ${difficulty} math problems using these operations: ${operations.join(', ')}. Format each problem clearly and provide answers.`
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

  // Register calculator tutor prompt
  server.registerPrompt(
    'calculator-tutor',
    {
      title: 'Math Tutor',
      description: 'Start an interactive math tutoring session',
      argsSchema: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'Math topic to focus on' },
          studentLevel: { type: 'string', description: 'Student grade level' },
        },
        required: ['topic', 'studentLevel'],
      },
    },
    ({ topic, studentLevel }: { topic: string; studentLevel: string }) => {
      const prompt = `Act as an interactive math tutor for a ${studentLevel} student learning about ${topic}. Be encouraging, break down concepts into simple steps, and provide examples.`
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

async function main(): Promise<void> {
  if (!process.argv.includes('--stdio')) {
    console.error('This server requires --stdio flag')
    process.exit(1)
  }

  const server = await createSimpleServer()
  const transport = new StdioServerTransport()

  await server.connect(transport)
  console.error('Simple calculator server ready')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}