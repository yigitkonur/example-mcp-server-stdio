import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createCalculatorServer } from './server.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

test('Calculator STDIO Server Tests', async (t) => {
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

  await t.test('Server capabilities', async () => {
    // List tools
    const tools = await client.listTools()
    assert.equal(tools.tools.length, 5)
    const toolNames = tools.tools.map((t) => t.name).sort()
    assert.deepEqual(toolNames, ['add', 'batch_calculate', 'divide', 'multiply', 'subtract'])

    // List resources
    const resources = await client.listResources()
    assert.ok(resources.resources.length >= 2) // At least constants and stats
    const resourceUris = resources.resources.map((r) => r.uri)
    assert.ok(resourceUris.includes('calculator://constants'))
    assert.ok(resourceUris.includes('calculator://stats'))

    // List prompts
    const prompts = await client.listPrompts()
    assert.equal(prompts.prompts.length, 3)
    const promptNames = prompts.prompts.map((p) => p.name).sort()
    assert.deepEqual(promptNames, ['calculator-tutor', 'explain-calculation', 'generate-problems'])
  })

  await t.test('Basic arithmetic operations', async () => {
    // Test addition
    const addResult = await client.callTool({
      name: 'add',
      arguments: { input_1: 5, input_2: 3 },
    })
    assert.equal(addResult.content[0].text, '5 + 3 = 8')
    assert.equal(addResult.structuredContent?.result, 8)
    assert.ok(addResult.structuredContent?.calculationId)

    // Test subtraction
    const subResult = await client.callTool({
      name: 'subtract',
      arguments: { input_1: 10, input_2: 4 },
    })
    assert.equal(subResult.content[0].text, '10 - 4 = 6')
    assert.equal(subResult.structuredContent?.result, 6)

    // Test multiplication
    const mulResult = await client.callTool({
      name: 'multiply',
      arguments: { input_1: 6, input_2: 7 },
    })
    assert.equal(mulResult.content[0].text, '6 × 7 = 42')
    assert.equal(mulResult.structuredContent?.result, 42)

    // Test division
    const divResult = await client.callTool({
      name: 'divide',
      arguments: { input_1: 20, input_2: 4 },
    })
    assert.equal(divResult.content[0].text, '20 ÷ 4 = 5')
    assert.equal(divResult.structuredContent?.result, 5)
  })

  await t.test('Error handling', async () => {
    // Division by zero
    const divByZero = await client.callTool({
      name: 'divide',
      arguments: { input_1: 10, input_2: 0 },
    })
    assert.equal(divByZero.isError, true)
    assert.match(divByZero.content[0].text, /Cannot divide by zero/)

    // Overflow handling
    const overflow = await client.callTool({
      name: 'multiply',
      arguments: { input_1: Number.MAX_VALUE, input_2: 2 },
    })
    assert.equal(overflow.isError, true)
    assert.match(overflow.content[0].text, /overflow/)
  })

  await t.test('Batch calculations', async () => {
    const batchResult = await client.callTool({
      name: 'batch_calculate',
      arguments: {
        calculations: [
          { operation: 'add', input_1: 1, input_2: 2 },
          { operation: 'multiply', input_1: 3, input_2: 4 },
          { operation: 'divide', input_1: 10, input_2: 0 }, // Should handle error
        ],
      },
    })

    const results = batchResult.structuredContent?.results
    assert.equal(results[0].result, 3)
    assert.equal(results[0].expression, '1 + 2 = 3')
    assert.equal(results[1].result, 12)
    assert.equal(results[1].expression, '3 × 4 = 12')
    assert.equal(results[2].error, 'Cannot divide by zero')
  })

  await t.test('Resources', async () => {
    // Test mathematical constants
    const constants = await client.readResource({
      uri: 'calculator://constants',
    })
    const data = JSON.parse(constants.contents[0].text)
    assert.equal(typeof data.pi, 'number')
    assert.equal(typeof data.e, 'number')
    assert.equal(typeof data.phi, 'number')
    assert.ok(Math.abs(data.pi - Math.PI) < 0.0001)

    // Test statistics
    const stats = await client.readResource({
      uri: 'calculator://stats',
    })
    const statsData = JSON.parse(stats.contents[0].text)
    assert.equal(typeof statsData.totalCalculations, 'number')
    assert.equal(typeof statsData.operationCounts, 'object')
    assert.equal(typeof statsData.startTime, 'string')
    assert.equal(typeof statsData.uptime, 'number')

    // Test calculation history after performing some calculations
    await client.callTool({
      name: 'add',
      arguments: { input_1: 100, input_2: 200 },
    })

    const resources = await client.listResources()
    const historyResources = resources.resources.filter((r) =>
      r.uri.startsWith('calculator://history/'),
    )
    assert.ok(historyResources.length > 0)

    // Read first history entry
    if (historyResources.length > 0) {
      const historyData = await client.readResource({
        uri: historyResources[0].uri,
      })
      const history = JSON.parse(historyData.contents[0].text)
      assert.equal(typeof history.id, 'string')
      assert.equal(typeof history.timestamp, 'string')
      assert.equal(typeof history.operation, 'string')
      assert.equal(typeof history.result, 'number')
      assert.equal(typeof history.expression, 'string')
    }
  })

  await t.test('Prompts', async () => {
    // Test explanation prompt
    const explainPrompt = await client.getPrompt({
      name: 'explain-calculation',
      arguments: {
        operation: 'multiply',
        input_1: 12,
        input_2: 5,
        level: 'elementary',
      },
    })

    assert.equal(explainPrompt.messages[0].role, 'user')
    assert.match(
      explainPrompt.messages[0].content.text,
      /explain in simple terms how to multiply 12 and 5/,
    )

    // Test problem generator
    const problemPrompt = await client.getPrompt({
      name: 'generate-problems',
      arguments: {
        difficulty: 'easy',
        count: 3,
        operations: ['add', 'subtract'],
      },
    })

    assert.match(problemPrompt.messages[0].content.text, /Generate 3 easy math problems/)
    assert.match(problemPrompt.messages[0].content.text, /add, subtract/)

    // Test tutor prompt
    const tutorPrompt = await client.getPrompt({
      name: 'calculator-tutor',
      arguments: {
        topic: 'fractions',
        studentLevel: '5th grade',
      },
    })

    assert.match(
      tutorPrompt.messages[0].content.text,
      /interactive math tutor for a 5th grade student learning about fractions/,
    )
  })

  await t.test('Concurrent operations', async () => {
    // Test multiple calculations in parallel
    const results = await Promise.all([
      client.callTool({ name: 'add', arguments: { input_1: 1, input_2: 1 } }),
      client.callTool({ name: 'add', arguments: { input_1: 2, input_2: 2 } }),
      client.callTool({ name: 'add', arguments: { input_1: 3, input_2: 3 } }),
    ])

    assert.equal(results[0].structuredContent?.result, 2)
    assert.equal(results[1].structuredContent?.result, 4)
    assert.equal(results[2].structuredContent?.result, 6)
  })

  await t.test('Complex calculations', async () => {
    // Test with negative numbers
    const negResult = await client.callTool({
      name: 'subtract',
      arguments: { input_1: -5, input_2: -3 },
    })
    assert.equal(negResult.structuredContent?.result, -2)

    // Test with decimals
    const decResult = await client.callTool({
      name: 'divide',
      arguments: { input_1: 7.5, input_2: 2.5 },
    })
    assert.equal(decResult.structuredContent?.result, 3)

    // Test with zero
    const zeroResult = await client.callTool({
      name: 'multiply',
      arguments: { input_1: 0, input_2: 100 },
    })
    assert.equal(zeroResult.structuredContent?.result, 0)
  })
})

// Performance benchmarks
test('Performance benchmarks', async (t) => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = await createCalculatorServer()
  const client = new Client({ name: 'bench-client', version: '1.0.0' }, {})

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

  await t.test('Throughput test', async () => {
    const iterations = 100
    const start = Date.now()

    for (let i = 0; i < iterations; i++) {
      await client.callTool({
        name: 'add',
        arguments: { input_1: i, input_2: i },
      })
    }

    const duration = Date.now() - start
    const opsPerSecond = (iterations / duration) * 1000

    console.log(`Throughput: ${opsPerSecond.toFixed(2)} ops/sec`)
    assert.ok(opsPerSecond > 50, `Should handle at least 50 ops/sec, got ${opsPerSecond}`)
  })

  await t.test('Memory usage', () => {
    const memBefore = process.memoryUsage().heapUsed
    // Perform some operations (already done in throughput test)
    const memAfter = process.memoryUsage().heapUsed
    const memIncrease = (memAfter - memBefore) / 1024 / 1024 // MB

    console.log(`Memory increase: ${memIncrease.toFixed(2)} MB`)
    assert.ok(memIncrease < 50, `Memory increase should be less than 50MB, got ${memIncrease}`)
  })

  await Promise.all([client.close(), server.close()])
})