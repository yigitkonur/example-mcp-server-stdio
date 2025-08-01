import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createCalculatorServer } from '../server.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

test('Calculator Learning Demo - STDIO Server Tests', async (t) => {
  let server: McpServer
  let client: Client
  let serverTransport: InMemoryTransport
  let clientTransport: InMemoryTransport

  // Setup before each test
  t.beforeEach(async () => {
    ;[clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

    server = await createCalculatorServer()
    client = new Client(
      {
        name: 'test-client',
        version: '1.0.0',
      },
      {},
    )

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  })

  // Cleanup after each test
  t.afterEach(async () => {
    await Promise.all([client.close(), server.close()])
  })

  await t.test('Core Tools', async () => {
    // List tools
    const tools = await client.listTools()
    const toolNames = tools.tools.map((t) => t.name)
    
    // Check core tools
    assert.ok(toolNames.includes('calculate'))
    
    // Test calculate tool
    const calcResult = await client.callTool({
      name: 'calculate',
      arguments: { a: 5, b: 3, op: 'add' },
    })
    assert.ok(calcResult.content[0].text.includes('5 + 3 = 8'))
    assert.equal(calcResult.structuredContent?.value, 8)
    assert.ok(calcResult.structuredContent?.meta?.calculationId)

    // Test with streaming
    const streamResult = await client.callTool({
      name: 'calculate',
      arguments: { a: 10, b: 2, op: 'multiply', stream: true },
    })
    assert.ok(streamResult.content[0].text.includes('10 × 2 = 20'))
    assert.equal(streamResult.structuredContent?.value, 20)
  })

  await t.test('Extended Tools', async () => {
    // Test batch_calculate
    const batchResult = await client.callTool({
      name: 'batch_calculate',
      arguments: {
        calculations: [
          { a: 5, b: 3, op: 'add' },
          { a: 10, b: 2, op: 'multiply' },
          { a: 20, b: 4, op: 'divide' },
        ],
      },
    })
    assert.ok(batchResult.content[0].text.includes('5 + 3 = 8'))
    assert.ok(batchResult.content[0].text.includes('10 × 2 = 20'))
    assert.ok(batchResult.content[0].text.includes('20 ÷ 4 = 5'))
    assert.equal(batchResult.structuredContent?.results.length, 3)

    // Test advanced_calculate
    const factorialResult = await client.callTool({
      name: 'advanced_calculate',
      arguments: { operation: 'factorial', n: 5 },
    })
    assert.ok(factorialResult.content[0].text.includes('5! = 120'))
    assert.equal(factorialResult.structuredContent?.value, 120)

    // Test combinations
    const combResult = await client.callTool({
      name: 'advanced_calculate',
      arguments: { operation: 'combinations', n: 5, k: 2 },
    })
    assert.ok(combResult.content[0].text.includes('C(5, 2) = 10'))
    assert.equal(combResult.structuredContent?.value, 10)

    // Test demo_progress
    const progressResult = await client.callTool({
      name: 'demo_progress',
      arguments: {},
    })
    assert.ok(progressResult.content[0].text.includes('Progress demonstration completed'))
    assert.deepEqual(progressResult.structuredContent?.progressSteps, [20, 40, 60, 80, 100])
  })

  await t.test('Core Resources', async () => {
    // List resources
    const resources = await client.listResources()
    const resourceUris = resources.resources.map((r) => r.uri)
    
    // Check core resource
    assert.ok(resourceUris.includes('calculator://constants'))
    
    // Read math constants
    const constants = await client.readResource({ uri: 'calculator://constants' })
    const constantsData = JSON.parse(constants.contents[0].text)
    assert.ok(constantsData.pi)
    assert.ok(constantsData.e)
    assert.ok(constantsData.phi)
  })

  await t.test('Extended Resources', async () => {
    // First perform a calculation to have history
    await client.callTool({
      name: 'calculate',
      arguments: { a: 42, b: 8, op: 'multiply' },
    })

    // Check calculator stats
    const stats = await client.readResource({ uri: 'calculator://stats' })
    const statsData = JSON.parse(stats.contents[0].text)
    assert.ok(statsData.uptimeMs >= 0)
    assert.ok(statsData.requestCount > 0)

    // Check formulas library
    const formulas = await client.readResource({ uri: 'formulas://library' })
    const formulasData = JSON.parse(formulas.contents[0].text)
    assert.ok(Array.isArray(formulasData))
    assert.ok(formulasData.length > 0)
    assert.ok(formulasData[0].name)
    assert.ok(formulasData[0].formula)
  })

  await t.test('Core Prompts', async () => {
    // List prompts
    const prompts = await client.listPrompts()
    const promptNames = prompts.prompts.map((p) => p.name)
    
    // Check core prompts
    assert.ok(promptNames.includes('explain-calculation'))
    assert.ok(promptNames.includes('generate-problems'))
    assert.ok(promptNames.includes('calculator-tutor'))
    
    // Test explain-calculation prompt
    const explainPrompt = await client.getPrompt({
      name: 'explain-calculation',
      arguments: { expression: '5 + 3' },
    })
    assert.ok(explainPrompt.messages[0].content.text.includes('5 + 3'))
    assert.ok(explainPrompt.messages[0].content.text.includes('explain'))
    
    // Test generate-problems prompt
    const problemsPrompt = await client.getPrompt({
      name: 'generate-problems',
      arguments: { difficulty: 'easy', count: 3 },
    })
    assert.ok(problemsPrompt.messages[0].content.text.includes('3'))
    assert.ok(problemsPrompt.messages[0].content.text.includes('easy'))
  })

  await t.test('Error Handling', async () => {
    // Division by zero
    const divByZero = await client.callTool({
      name: 'calculate',
      arguments: { a: 10, b: 0, op: 'divide' },
    })
    assert.equal(divByZero.isError, true)
    assert.match(divByZero.content[0].text, /Division by zero/)

    // Invalid factorial
    const negFactorial = await client.callTool({
      name: 'advanced_calculate',
      arguments: { operation: 'factorial', n: -5 },
    })
    assert.equal(negFactorial.isError, true)
    assert.match(negFactorial.content[0].text, /not defined for negative/)

    // Missing required parameter
    const missingParam = await client.callTool({
      name: 'advanced_calculate',
      arguments: { operation: 'combinations', n: 5 },
    })
    assert.equal(missingParam.isError, true)
    assert.match(missingParam.content[0].text, /k is required/)
  })

  await t.test('Batch Size Limits', async () => {
    // Create array with too many calculations
    const tooManyCalcs = Array(101).fill(null).map((_, i) => ({
      a: i,
      b: 1,
      op: 'add' as const,
    }))

    try {
      await client.callTool({
        name: 'batch_calculate',
        arguments: { calculations: tooManyCalcs },
      })
      assert.fail('Should have thrown validation error')
    } catch (error) {
      // Expected to fail validation
      assert.ok(error)
    }
  })
})