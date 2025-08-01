#!/usr/bin/env node
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import * as readline from 'readline/promises'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import type { Operation } from './types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Enhanced calculator client with retry logic and comprehensive error handling
 */
class CalculatorClient {
  private client: Client
  private transport?: StdioClientTransport
  private connected = false
  private retryCount = 0
  private readonly maxRetries = 3
  private readonly retryDelays = [1000, 2000, 4000] // Exponential backoff

  constructor() {
    this.client = new Client(
      {
        name: 'calculator-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      },
    )
  }

  /**
   * Connect to the calculator server with retry logic
   */
  async connect(serverPath: string): Promise<void> {
    while (this.retryCount < this.maxRetries) {
      try {
        console.log(`Connecting to calculator server... (attempt ${this.retryCount + 1})`)

        this.transport = new StdioClientTransport({
          command: 'node',
          args: [serverPath, '--stdio'],
          stderr: 'pipe',
        })

        // Monitor server stderr for logs
        if (this.transport.stderr) {
          this.transport.stderr.on('data', (chunk: Buffer) => {
            const lines = chunk.toString().split('\n').filter(Boolean)
            for (const line of lines) {
              try {
                const log = JSON.parse(line)
                if (log.level === 'error') {
                  console.error(`[Server Error] ${log.msg}`)
                } else if (process.env['DEBUG']) {
                  console.error(`[Server ${log.level}] ${log.msg}`)
                }
              } catch {
                // Not JSON, just log as-is in debug mode
                if (process.env['DEBUG']) {
                  console.error(`[Server] ${line}`)
                }
              }
            }
          })
        }

        await this.client.connect(this.transport)
        this.connected = true
        console.log('✓ Connected to calculator server')

        // List capabilities
        await this.displayCapabilities()
        return
      } catch (error) {
        this.retryCount++
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`Connection attempt ${this.retryCount} failed: ${errorMessage}`)

        if (this.retryCount < this.maxRetries) {
          const delay = this.retryDelays[this.retryCount - 1] || 5000
          console.log(`Retrying in ${delay}ms...`)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    throw new Error('Failed to connect after maximum retries')
  }

  /**
   * Display server capabilities
   */
  private async displayCapabilities(): Promise<void> {
    try {
      const [tools, resources, prompts] = await Promise.all([
        this.client.listTools(),
        this.client.listResources(),
        this.client.listPrompts(),
      ])

      console.log('\nServer Capabilities:')
      console.log(`├── Tools (${tools.tools.length}):`)
      tools.tools.forEach((tool, i) => {
        const isLast = i === tools.tools.length - 1
        console.log(`│   ${isLast ? '└──' : '├──'} ${tool.name}: ${tool.description}`)
      })

      console.log(`├── Resources (${resources.resources.length}):`)
      resources.resources.forEach((resource, i) => {
        const isLast = i === resources.resources.length - 1
        console.log(`│   ${isLast ? '└──' : '├──'} ${resource.name}: ${resource.description}`)
      })

      console.log(`└── Prompts (${prompts.prompts.length}):`)
      prompts.prompts.forEach((prompt, i) => {
        const isLast = i === prompts.prompts.length - 1
        console.log(`    ${isLast ? '└──' : '├──'} ${prompt.name}: ${prompt.description}`)
      })
    } catch (error) {
      console.error('Failed to retrieve server capabilities:', error)
    }
  }

  /**
   * Perform a calculation
   */
  async calculate(operation: Operation, a: number, b: number): Promise<{
    text: string
    structured?: { result: number; expression: string; calculationId: string }
  }> {
    if (!this.connected) throw new Error('Not connected to server')

    try {
      const result = await this.client.callTool({
        name: operation,
        arguments: { input_1: a, input_2: b },
      })

      if (result.isError) {
        const errorContent = result.content as Array<{ text?: string }> | undefined
        throw new Error(errorContent?.[0]?.text || 'Calculation failed')
      }

      const successContent = result.content as Array<{ text?: string }> | undefined
      return {
        text: successContent?.[0]?.text || '',
        structured: result.structuredContent as {
          result: number
          expression: string
          calculationId: string
        },
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`Calculation error: ${errorMessage}`)
      throw error
    }
  }

  /**
   * Perform batch calculations
   */
  async batchCalculate(
    calculations: Array<{ operation: Operation; input_1: number; input_2: number }>,
  ): Promise<unknown> {
    if (!this.connected) throw new Error('Not connected to server')

    const result = await this.client.callTool({
      name: 'batch_calculate',
      arguments: { calculations },
    })

    return result.structuredContent
  }

  /**
   * Get calculation history
   */
  async getHistory(limit = 10): Promise<unknown[]> {
    const resources = await this.client.listResources()
    const historyResources = resources.resources.filter((r) =>
      r.uri.startsWith('calculator://history/'),
    )

    const history = []
    for (const resource of historyResources.slice(0, limit)) {
      try {
        const data = await this.client.readResource({ uri: resource.uri })
        const contents = data.contents as Array<{ text?: string }> | undefined
        history.push(JSON.parse(contents?.[0]?.text || '{}'))
      } catch (error) {
        console.error(`Failed to read history ${resource.uri}:`, error)
      }
    }

    return history
  }

  /**
   * Get mathematical constants
   */
  async getConstants(): Promise<Record<string, number>> {
    const result = await this.client.readResource({
      uri: 'calculator://constants',
    })
    const contents = result.contents as Array<{ text?: string }> | undefined
    return JSON.parse(contents?.[0]?.text || '{}')
  }

  /**
   * Get calculator statistics
   */
  async getStats(): Promise<unknown> {
    const result = await this.client.readResource({
      uri: 'calculator://stats',
    })
    const contents = result.contents as Array<{ text?: string }> | undefined
    return JSON.parse(contents?.[0]?.text || '{}')
  }

  /**
   * Get calculation explanation prompt
   */
  async explainCalculation(
    operation: Operation,
    a: number,
    b: number,
    level: 'elementary' | 'intermediate' | 'advanced' = 'intermediate',
  ): Promise<string> {
    const prompt = await this.client.getPrompt({
      name: 'explain-calculation',
      arguments: {
        operation: operation.toString(),
        input_1: a.toString(),
        input_2: b.toString(),
        level: level.toString(),
      },
    })
    const message = prompt.messages[0]
    return (message?.content as { text?: string })?.text || ''
  }

  /**
   * Generate practice problems
   */
  async generateProblems(
    difficulty: 'easy' | 'medium' | 'hard' = 'medium',
    count = 5,
    operations?: Operation[],
  ): Promise<string> {
    const prompt = await this.client.getPrompt({
      name: 'generate-problems',
      arguments: {
        difficulty: difficulty.toString(),
        count: count.toString(),
        operations: operations?.map(op => op.toString()).join(',') || '',
      },
    })
    const message = prompt.messages[0]
    return (message?.content as { text?: string })?.text || ''
  }

  /**
   * Start a tutoring session
   */
  async startTutoring(topic: string, studentLevel: string): Promise<string> {
    const prompt = await this.client.getPrompt({
      name: 'calculator-tutor',
      arguments: {
        topic,
        studentLevel,
      },
    })
    const message = prompt.messages[0]
    return (message?.content as { text?: string })?.text || ''
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    if (this.connected) {
      await this.client.close()
      this.connected = false
    }
  }
}

/**
 * Interactive REPL for the calculator
 */
async function runInteractiveMode(): Promise<void> {
  const client = new CalculatorClient()
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'calc> ',
  })

  // Determine server path
  const serverPath = process.argv[2] || join(__dirname, 'server.js')

  try {
    await client.connect(serverPath)

    console.log('\n📐 Calculator REPL')
    console.log('Type "help" for available commands or "exit" to quit\n')

    rl.prompt()

    for await (const line of rl) {
      const input = line.trim()
      if (!input) {
        rl.prompt()
        continue
      }

      const [command, ...args] = input.split(/\s+/)

      if (!command) {
        rl.prompt()
        continue
      }

      try {
        switch (command.toLowerCase()) {
          case 'add':
          case 'subtract':
          case 'multiply':
          case 'divide': {
            if (args.length !== 2) {
              console.log('Usage: <operation> <number1> <number2>')
              break
            }
            const [aStr, bStr] = args
            const a = Number(aStr)
            const b = Number(bStr)
            if (isNaN(a) || isNaN(b)) {
              console.log('Error: Both arguments must be numbers')
              break
            }
            const result = await client.calculate(command as Operation, a, b)
            console.log(result.text)
            if (result.structured) {
              console.log(`└── ID: ${result.structured.calculationId}`)
            }
            break
          }

          case 'batch': {
            if (args.length < 3 || args.length % 3 !== 0) {
              console.log('Usage: batch <op1> <a1> <b1> [<op2> <a2> <b2> ...]')
              console.log('Example: batch add 1 2 multiply 3 4 divide 10 2')
              break
            }
            const calculations = []
            for (let i = 0; i < args.length; i += 3) {
              const op = args[i] as Operation
              const a = Number(args[i + 1])
              const b = Number(args[i + 2])
              calculations.push({ operation: op, input_1: a, input_2: b })
            }
            const results = await client.batchCalculate(calculations)
            console.log('Batch results:')
            console.log(JSON.stringify(results, null, 2))
            break
          }

          case 'history': {
            const limit = args[0] ? parseInt(args[0]) : 10
            const history = await client.getHistory(limit)
            if (history.length === 0) {
              console.log('No calculation history')
            } else {
              console.log(`\nRecent calculations (showing ${history.length}):`)
              history.forEach((h: any) => {
                const date = new Date(h.timestamp).toLocaleString()
                console.log(`  ${h.expression} (${date})`)
              })
            }
            break
          }

          case 'constants': {
            const constants = await client.getConstants()
            console.log('\nMathematical constants:')
            for (const [name, value] of Object.entries(constants)) {
              console.log(`  ${name}: ${value}`)
            }
            break
          }

          case 'stats': {
            const stats = await client.getStats()
            console.log('\nCalculator statistics:')
            console.log(JSON.stringify(stats, null, 2))
            break
          }

          case 'explain': {
            if (args.length < 3) {
              console.log('Usage: explain <operation> <num1> <num2> [level]')
              console.log('Levels: elementary, intermediate, advanced')
              break
            }
            const [op, n1, n2, level = 'intermediate'] = args
            const explanation = await client.explainCalculation(
              op as Operation,
              Number(n1),
              Number(n2),
              level as 'elementary' | 'intermediate' | 'advanced',
            )
            console.log('\nExplanation prompt:')
            console.log(explanation)
            break
          }

          case 'problems': {
            const difficulty = (args[0] as 'easy' | 'medium' | 'hard') || 'medium'
            const count = args[1] ? parseInt(args[1]) : 5
            const problems = await client.generateProblems(difficulty, count)
            console.log('\nGenerated problems prompt:')
            console.log(problems)
            break
          }

          case 'tutor': {
            if (args.length < 2) {
              console.log('Usage: tutor <topic> <student-level>')
              console.log('Example: tutor multiplication "3rd grade"')
              break
            }
            const topic = args[0]
            if (!topic) {
              console.log('Error: Topic is required')
              break
            }
            const level = args.slice(1).join(' ')
            const tutorPrompt = await client.startTutoring(topic, level)
            console.log('\nTutoring session prompt:')
            console.log(tutorPrompt)
            break
          }

          case 'help': {
            console.log(`
Available commands:
  
Basic Operations:
  add <a> <b>              Add two numbers
  subtract <a> <b>         Subtract b from a  
  multiply <a> <b>         Multiply two numbers
  divide <a> <b>           Divide a by b

Advanced Operations:
  batch <op> <a> <b> ...   Perform multiple calculations
  
Resources:
  history [limit]          Show calculation history
  constants                Show mathematical constants
  stats                    Show usage statistics

AI Features:  
  explain <op> <a> <b> [level]    Get explanation for a calculation
  problems [difficulty] [count]    Generate practice problems
  tutor <topic> <level>           Start tutoring session

System:
  help                     Show this help message
  exit                     Exit the calculator
            `)
            break
          }

          case 'exit':
          case 'quit':
            console.log('Goodbye! 👋')
            return

          default:
            console.log(`Unknown command: ${command}. Type 'help' for available commands.`)
        }
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : String(error))
      }

      rl.prompt()
    }
  } catch (error) {
    console.error('Fatal error:', error)
  } finally {
    await client.close()
    rl.close()
  }
}

// Main entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  runInteractiveMode().catch(console.error)
}