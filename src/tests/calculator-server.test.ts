import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createCalculatorServer } from '../server.js';
import type { CallToolResultSchema, GetPromptResultSchema, ListResourcesResultSchema } from '@modelcontextprotocol/sdk/types.js';

describe('STDIO Calculator Server - Comprehensive Test Suite', () => {
  let server: McpServer;
  let client: Client;
  let serverTransport: InMemoryTransport;
  let clientTransport: InMemoryTransport;

  beforeEach(async () => {
    // Create linked transport pair for in-memory communication
    [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    // Initialize server and client
    server = await createCalculatorServer();
    client = new Client(
      {
        name: 'test-client',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: { subscribe: true },
          prompts: {},
          logging: {},
        },
      },
    );

    // Connect both endpoints
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
  });

  afterEach(async () => {
    // Clean up connections
    await Promise.all([
      client.close(),
      server.close(),
    ]);
  });

  describe('Server Initialization and Capabilities', () => {
    test('should have correct server info', () => {
      expect(server.serverInfo.name).toBe('calculator-server');
      expect(server.serverInfo.version).toBe('1.0.0');
    });

    test('should list all available tools', async () => {
      const tools = await client.listTools();
      
      expect(tools.tools).toBeDefined();
      expect(Array.isArray(tools.tools)).toBe(true);
      expect(tools.tools.length).toBe(5);
      
      const toolNames = tools.tools.map(t => t.name).sort();
      expect(toolNames).toEqual(['add', 'batch_calculate', 'divide', 'multiply', 'subtract']);
      
      // Check individual tool schemas
      const addTool = tools.tools.find(t => t.name === 'add');
      expect(addTool).toBeDefined();
      expect(addTool?.description).toContain('Add two numbers');
      expect(addTool?.inputSchema).toBeDefined();
      expect(addTool?.inputSchema.type).toBe('object');
      expect(addTool?.inputSchema.properties).toHaveProperty('input_1');
      expect(addTool?.inputSchema.properties).toHaveProperty('input_2');
      
      // Check batch_calculate tool
      const batchTool = tools.tools.find(t => t.name === 'batch_calculate');
      expect(batchTool).toBeDefined();
      expect(batchTool?.description).toContain('batch');
      expect(batchTool?.inputSchema.properties).toHaveProperty('calculations');
    });

    test('should list all available resources', async () => {
      const resources = await client.listResources();
      
      expect(resources.resources).toBeDefined();
      expect(Array.isArray(resources.resources)).toBe(true);
      expect(resources.resources.length).toBeGreaterThanOrEqual(2);
      
      const resourceUris = resources.resources.map(r => r.uri);
      expect(resourceUris).toContain('calculator://constants');
      expect(resourceUris).toContain('calculator://stats');
      
      // Check resource metadata
      const constantsResource = resources.resources.find(r => r.uri === 'calculator://constants');
      expect(constantsResource).toBeDefined();
      expect(constantsResource?.name).toBe('Mathematical Constants');
      expect(constantsResource?.mimeType).toBe('application/json');
      
      const statsResource = resources.resources.find(r => r.uri === 'calculator://stats');
      expect(statsResource).toBeDefined();
      expect(statsResource?.name).toBe('Calculator Statistics');
    });

    test('should list all available prompts', async () => {
      const prompts = await client.listPrompts();
      
      expect(prompts.prompts).toBeDefined();
      expect(Array.isArray(prompts.prompts)).toBe(true);
      expect(prompts.prompts.length).toBe(3);
      
      const promptNames = prompts.prompts.map(p => p.name).sort();
      expect(promptNames).toEqual(['calculator-tutor', 'explain-calculation', 'generate-problems']);
      
      // Check prompt metadata
      const explainPrompt = prompts.prompts.find(p => p.name === 'explain-calculation');
      expect(explainPrompt).toBeDefined();
      expect(explainPrompt?.description).toContain('step-by-step explanation');
      
      const generatePrompt = prompts.prompts.find(p => p.name === 'generate-problems');
      expect(generatePrompt).toBeDefined();
      expect(generatePrompt?.description).toContain('practice problems');
    });
  });

  describe('Basic Arithmetic Operations', () => {
    const testCases = [
      { tool: 'add', input_1: 10, input_2: 5, expected: 15, symbol: '+' },
      { tool: 'subtract', input_1: 20, input_2: 8, expected: 12, symbol: '-' },
      { tool: 'multiply', input_1: 7, input_2: 6, expected: 42, symbol: '×' },
      { tool: 'divide', input_1: 20, input_2: 4, expected: 5, symbol: '÷' },
    ];

    testCases.forEach(({ tool, input_1, input_2, expected, symbol }) => {
      test(`should perform ${tool} correctly`, async () => {
        const result = await client.callTool({
          name: tool,
          arguments: {
            input_1,
            input_2,
          },
        });

        expect(result.isError).toBeFalsy();
        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');
        expect((result.content[0] as any).text).toBe(`${input_1} ${symbol} ${input_2} = ${expected}`);
        
        // Check structured content
        expect(result.structuredContent).toBeDefined();
        expect(result.structuredContent?.result).toBe(expected);
        expect(result.structuredContent?.calculationId).toBeDefined();
        expect(typeof result.structuredContent?.calculationId).toBe('string');
      });
    });

    test('should handle decimal operations', async () => {
      const result = await client.callTool({
        name: 'divide',
        arguments: {
          input_1: 7.5,
          input_2: 2.5,
        },
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent?.result).toBe(3);
    });

    test('should handle negative numbers', async () => {
      const result = await client.callTool({
        name: 'subtract',
        arguments: {
          input_1: -5,
          input_2: -3,
        },
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent?.result).toBe(-2);
      expect((result.content[0] as any).text).toBe('-5 - -3 = -2');
    });

    test('should handle zero correctly', async () => {
      const result = await client.callTool({
        name: 'multiply',
        arguments: {
          input_1: 0,
          input_2: 100,
        },
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent?.result).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle division by zero', async () => {
      const result = await client.callTool({
        name: 'divide',
        arguments: {
          input_1: 10,
          input_2: 0,
        },
      });

      expect(result.isError).toBeTruthy();
      expect((result.content[0] as any).text).toContain('Cannot divide by zero');
    });

    test('should handle overflow in multiplication', async () => {
      const result = await client.callTool({
        name: 'multiply',
        arguments: {
          input_1: Number.MAX_VALUE,
          input_2: 2,
        },
      });

      expect(result.isError).toBeTruthy();
      expect((result.content[0] as any).text).toContain('overflow');
    });

    test('should handle underflow in subtraction', async () => {
      const result = await client.callTool({
        name: 'subtract',
        arguments: {
          input_1: -Number.MAX_VALUE,
          input_2: Number.MAX_VALUE,
        },
      });

      expect(result.isError).toBeTruthy();
      expect((result.content[0] as any).text).toContain('underflow');
    });

    test('should handle invalid tool name', async () => {
      await expect(
        client.callTool({
          name: 'non-existent-tool',
          arguments: {},
        }),
      ).rejects.toThrow();
    });

    test('should handle missing required arguments', async () => {
      await expect(
        client.callTool({
          name: 'add',
          arguments: {
            input_1: 10,
            // Missing input_2
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('Batch Calculations', () => {
    test('should perform batch calculations successfully', async () => {
      const result = await client.callTool({
        name: 'batch_calculate',
        arguments: {
          calculations: [
            { operation: 'add', input_1: 1, input_2: 2 },
            { operation: 'multiply', input_1: 3, input_2: 4 },
            { operation: 'subtract', input_1: 10, input_2: 3 },
            { operation: 'divide', input_1: 20, input_2: 5 },
          ],
        },
      });

      expect(result.isError).toBeFalsy();
      
      const results = result.structuredContent?.results;
      expect(results).toBeDefined();
      expect(results.length).toBe(4);
      
      expect(results[0].result).toBe(3);
      expect(results[0].expression).toBe('1 + 2 = 3');
      
      expect(results[1].result).toBe(12);
      expect(results[1].expression).toBe('3 × 4 = 12');
      
      expect(results[2].result).toBe(7);
      expect(results[2].expression).toBe('10 - 3 = 7');
      
      expect(results[3].result).toBe(4);
      expect(results[3].expression).toBe('20 ÷ 5 = 4');
    });

    test('should handle errors in batch calculations', async () => {
      const result = await client.callTool({
        name: 'batch_calculate',
        arguments: {
          calculations: [
            { operation: 'add', input_1: 1, input_2: 2 },
            { operation: 'divide', input_1: 10, input_2: 0 }, // Error
            { operation: 'multiply', input_1: 3, input_2: 4 },
          ],
        },
      });

      expect(result.isError).toBeFalsy();
      
      const results = result.structuredContent?.results;
      expect(results.length).toBe(3);
      
      expect(results[0].result).toBe(3);
      expect(results[0].error).toBeUndefined();
      
      expect(results[1].result).toBeUndefined();
      expect(results[1].error).toBe('Cannot divide by zero');
      
      expect(results[2].result).toBe(12);
      expect(results[2].error).toBeUndefined();
    });

    test('should handle empty batch', async () => {
      const result = await client.callTool({
        name: 'batch_calculate',
        arguments: {
          calculations: [],
        },
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent?.results).toEqual([]);
    });

    test('should handle large batch calculations', async () => {
      const calculations = Array.from({ length: 50 }, (_, i) => ({
        operation: 'add',
        input_1: i,
        input_2: i,
      }));

      const result = await client.callTool({
        name: 'batch_calculate',
        arguments: { calculations },
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent?.results.length).toBe(50);
      
      // Verify some results
      expect(result.structuredContent?.results[0].result).toBe(0);
      expect(result.structuredContent?.results[10].result).toBe(20);
      expect(result.structuredContent?.results[49].result).toBe(98);
    });
  });

  describe('Resources - Mathematical Constants', () => {
    test('should provide all mathematical constants', async () => {
      const result = await client.readResource({
        uri: 'calculator://constants',
      });

      expect(result.contents).toHaveLength(1);
      const content = JSON.parse(result.contents[0].text);
      
      // Check all constants are present
      const expectedConstants = ['pi', 'e', 'phi', 'sqrt2', 'ln2', 'ln10'];
      expectedConstants.forEach(constant => {
        expect(content).toHaveProperty(constant);
        expect(typeof content[constant]).toBe('number');
      });
      
      // Verify some values
      expect(content.pi).toBeCloseTo(Math.PI, 10);
      expect(content.e).toBeCloseTo(Math.E, 10);
      expect(content.sqrt2).toBeCloseTo(Math.SQRT2, 10);
      expect(content.phi).toBeCloseTo(1.618033988749895, 10);
    });
  });

  describe('Resources - Calculator Statistics', () => {
    test('should track calculation statistics correctly', async () => {
      // Perform various calculations
      await client.callTool({ name: 'add', arguments: { input_1: 1, input_2: 1 } });
      await client.callTool({ name: 'add', arguments: { input_1: 2, input_2: 2 } });
      await client.callTool({ name: 'multiply', arguments: { input_1: 3, input_2: 3 } });
      await client.callTool({ name: 'divide', arguments: { input_1: 10, input_2: 2 } });
      await client.callTool({ name: 'subtract', arguments: { input_1: 5, input_2: 3 } });

      const result = await client.readResource({
        uri: 'calculator://stats',
      });

      expect(result.contents).toHaveLength(1);
      const stats = JSON.parse(result.contents[0].text);
      
      expect(stats.totalCalculations).toBe(5);
      expect(stats.operationCounts).toBeDefined();
      expect(stats.operationCounts.add).toBe(2);
      expect(stats.operationCounts.multiply).toBe(1);
      expect(stats.operationCounts.divide).toBe(1);
      expect(stats.operationCounts.subtract).toBe(1);
      expect(stats.startTime).toBeDefined();
      expect(stats.uptime).toBeGreaterThan(0);
      expect(stats.lastCalculation).toBeDefined();
    });

    test('should include batch calculations in statistics', async () => {
      await client.callTool({
        name: 'batch_calculate',
        arguments: {
          calculations: [
            { operation: 'add', input_1: 1, input_2: 1 },
            { operation: 'multiply', input_1: 2, input_2: 2 },
          ],
        },
      });

      const result = await client.readResource({
        uri: 'calculator://stats',
      });

      const stats = JSON.parse(result.contents[0].text);
      expect(stats.totalCalculations).toBe(2);
      expect(stats.operationCounts.add).toBe(1);
      expect(stats.operationCounts.multiply).toBe(1);
    });
  });

  describe('Resources - Calculation History', () => {
    test('should maintain calculation history', async () => {
      // Perform a calculation
      const calcResult = await client.callTool({
        name: 'add',
        arguments: { input_1: 100, input_2: 200 },
      });
      
      const calculationId = calcResult.structuredContent?.calculationId;
      expect(calculationId).toBeDefined();

      // List resources to find history
      const resources = await client.listResources();
      const historyResources = resources.resources.filter(r => 
        r.uri.startsWith('calculator://history/')
      );

      expect(historyResources.length).toBeGreaterThan(0);
      
      // Find the specific calculation
      const targetUri = `calculator://history/${calculationId}`;
      const targetResource = historyResources.find(r => r.uri === targetUri);
      expect(targetResource).toBeDefined();

      // Read the history entry
      const historyResult = await client.readResource({
        uri: targetUri,
      });

      const history = JSON.parse(historyResult.contents[0].text);
      expect(history.id).toBe(calculationId);
      expect(history.operation).toBe('add');
      expect(history.inputs).toEqual([100, 200]);
      expect(history.result).toBe(300);
      expect(history.expression).toBe('100 + 200 = 300');
      expect(history.timestamp).toBeDefined();
    });

    test('should track batch calculations in history', async () => {
      const result = await client.callTool({
        name: 'batch_calculate',
        arguments: {
          calculations: [
            { operation: 'add', input_1: 10, input_2: 20 },
            { operation: 'multiply', input_1: 5, input_2: 6 },
          ],
        },
      });

      const batchId = result.structuredContent?.batchId;
      expect(batchId).toBeDefined();

      // Check individual calculation IDs
      const results = result.structuredContent?.results;
      expect(results[0].calculationId).toBeDefined();
      expect(results[1].calculationId).toBeDefined();

      // Verify we can read individual calculations from history
      const resources = await client.listResources();
      const historyResources = resources.resources.filter(r => 
        r.uri.startsWith('calculator://history/')
      );

      const firstCalcUri = `calculator://history/${results[0].calculationId}`;
      const firstCalcResource = historyResources.find(r => r.uri === firstCalcUri);
      expect(firstCalcResource).toBeDefined();
    });
  });

  describe('Prompts - Explain Calculation', () => {
    test('should generate elementary level explanation', async () => {
      const result = await client.getPrompt({
        name: 'explain-calculation',
        arguments: {
          operation: 'multiply',
          input_1: 12,
          input_2: 5,
          level: 'elementary',
        },
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content.type).toBe('text');
      
      const text = (result.messages[0].content as any).text;
      expect(text).toContain('explain in simple terms');
      expect(text).toContain('multiply 12 and 5');
      expect(text).toContain('visual');
    });

    test('should generate advanced level explanation', async () => {
      const result = await client.getPrompt({
        name: 'explain-calculation',
        arguments: {
          operation: 'divide',
          input_1: 17,
          input_2: 3,
          level: 'advanced',
        },
      });

      const text = (result.messages[0].content as any).text;
      expect(text).toContain('mathematical properties');
      expect(text).toContain('17 divided by 3');
      expect(text).toContain('applications');
    });

    test('should handle different operations', async () => {
      const operations = ['add', 'subtract', 'multiply', 'divide'];
      
      for (const operation of operations) {
        const result = await client.getPrompt({
          name: 'explain-calculation',
          arguments: {
            operation,
            input_1: 10,
            input_2: 5,
            level: 'intermediate',
          },
        });

        const text = (result.messages[0].content as any).text;
        expect(text).toContain(operation);
        expect(text).toContain('10');
        expect(text).toContain('5');
      }
    });
  });

  describe('Prompts - Generate Problems', () => {
    test('should generate easy problems', async () => {
      const result = await client.getPrompt({
        name: 'generate-problems',
        arguments: {
          difficulty: 'easy',
          count: 5,
          operations: ['add', 'subtract'],
        },
      });

      expect(result.messages).toHaveLength(1);
      const text = (result.messages[0].content as any).text;
      expect(text).toContain('Generate 5 easy math problems');
      expect(text).toContain('add, subtract');
      expect(text).toContain('show work');
    });

    test('should generate hard problems with all operations', async () => {
      const result = await client.getPrompt({
        name: 'generate-problems',
        arguments: {
          difficulty: 'hard',
          count: 3,
          operations: ['add', 'subtract', 'multiply', 'divide'],
        },
      });

      const text = (result.messages[0].content as any).text;
      expect(text).toContain('Generate 3 hard math problems');
      expect(text).toContain('all operations');
    });

    test('should handle single operation', async () => {
      const result = await client.getPrompt({
        name: 'generate-problems',
        arguments: {
          difficulty: 'medium',
          count: 10,
          operations: ['multiply'],
        },
      });

      const text = (result.messages[0].content as any).text;
      expect(text).toContain('multiply');
      expect(text).not.toContain('add');
      expect(text).not.toContain('subtract');
      expect(text).not.toContain('divide');
    });
  });

  describe('Prompts - Calculator Tutor', () => {
    test('should create fractions tutor for 5th grade', async () => {
      const result = await client.getPrompt({
        name: 'calculator-tutor',
        arguments: {
          topic: 'fractions',
          studentLevel: '5th grade',
        },
      });

      expect(result.messages).toHaveLength(1);
      const text = (result.messages[0].content as any).text;
      expect(text).toContain('interactive math tutor');
      expect(text).toContain('5th grade student');
      expect(text).toContain('fractions');
      expect(text).toContain('patient');
      expect(text).toContain('encouraging');
    });

    test('should create multiplication tutor for 3rd grade', async () => {
      const result = await client.getPrompt({
        name: 'calculator-tutor',
        arguments: {
          topic: 'multiplication',
          studentLevel: '3rd grade',
        },
      });

      const text = (result.messages[0].content as any).text;
      expect(text).toContain('3rd grade');
      expect(text).toContain('multiplication');
      expect(text).toContain('visual aids');
    });

    test('should create algebra tutor for high school', async () => {
      const result = await client.getPrompt({
        name: 'calculator-tutor',
        arguments: {
          topic: 'algebra',
          studentLevel: 'high school',
        },
      });

      const text = (result.messages[0].content as any).text;
      expect(text).toContain('high school');
      expect(text).toContain('algebra');
    });
  });

  describe('Type Validation', () => {
    test('should reject non-numeric inputs', async () => {
      await expect(
        client.callTool({
          name: 'add',
          arguments: {
            input_1: 'not a number' as any,
            input_2: 5,
          },
        }),
      ).rejects.toThrow();
    });

    test('should reject invalid operation in batch', async () => {
      await expect(
        client.callTool({
          name: 'batch_calculate',
          arguments: {
            calculations: [
              { operation: 'invalid_op' as any, input_1: 1, input_2: 2 },
            ],
          },
        }),
      ).rejects.toThrow();
    });

    test('should reject invalid difficulty level', async () => {
      await expect(
        client.getPrompt({
          name: 'generate-problems',
          arguments: {
            difficulty: 'super-hard' as any,
            count: 5,
            operations: ['add'],
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('Performance and Concurrency', () => {
    test('should handle multiple concurrent calculations', async () => {
      const calculations = Array.from({ length: 10 }, (_, i) => ({
        name: 'add',
        arguments: { input_1: i, input_2: i },
      }));

      const promises = calculations.map(calc => client.callTool(calc));
      const results = await Promise.all(promises);
      
      results.forEach((result, i) => {
        expect(result.isError).toBeFalsy();
        expect(result.structuredContent?.result).toBe(i * 2);
      });
    });

    test('should handle rapid sequential calculations', async () => {
      const startTime = Date.now();
      const iterations = 100;
      
      for (let i = 0; i < iterations; i++) {
        await client.callTool({
          name: 'add',
          arguments: {
            input_1: i,
            input_2: 1,
          },
        });
      }
      
      const duration = Date.now() - startTime;
      const opsPerSecond = (iterations / duration) * 1000;
      
      expect(opsPerSecond).toBeGreaterThan(50); // At least 50 ops/sec
    });

    test('should handle mixed operations concurrently', async () => {
      const operations = [
        client.callTool({ name: 'add', arguments: { input_1: 1, input_2: 2 } }),
        client.callTool({ name: 'multiply', arguments: { input_1: 3, input_2: 4 } }),
        client.listResources(),
        client.readResource({ uri: 'calculator://constants' }),
        client.getPrompt({ name: 'generate-problems', arguments: { difficulty: 'easy', count: 3, operations: ['add'] } }),
      ];

      const results = await Promise.all(operations);
      
      expect(results[0].structuredContent?.result).toBe(3);
      expect(results[1].structuredContent?.result).toBe(12);
      expect(results[2].resources.length).toBeGreaterThan(0);
      expect(JSON.parse(results[3].contents[0].text)).toHaveProperty('pi');
      expect(results[4].messages.length).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    test('should handle very large numbers', async () => {
      const result = await client.callTool({
        name: 'add',
        arguments: {
          input_1: Number.MAX_SAFE_INTEGER - 1,
          input_2: 1,
        },
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent?.result).toBe(Number.MAX_SAFE_INTEGER);
    });

    test('should handle very small numbers', async () => {
      const result = await client.callTool({
        name: 'multiply',
        arguments: {
          input_1: Number.MIN_VALUE,
          input_2: 1,
        },
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent?.result).toBe(Number.MIN_VALUE);
    });

    test('should handle scientific notation', async () => {
      const result = await client.callTool({
        name: 'multiply',
        arguments: {
          input_1: 1e5,
          input_2: 1e3,
        },
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent?.result).toBe(1e8);
    });
  });

  describe('Integration Tests', () => {
    test('should maintain consistency between operations and statistics', async () => {
      // Clear initial state by reading current stats
      const initialStats = await client.readResource({ uri: 'calculator://stats' });
      const initialData = JSON.parse(initialStats.contents[0].text);
      const initialTotal = initialData.totalCalculations;

      // Perform operations
      const operations = [
        { name: 'add', arguments: { input_1: 10, input_2: 5 } },
        { name: 'subtract', arguments: { input_1: 20, input_2: 8 } },
        { name: 'multiply', arguments: { input_1: 3, input_2: 7 } },
      ];

      for (const op of operations) {
        await client.callTool(op);
      }

      // Check updated stats
      const statsResult = await client.readResource({
        uri: 'calculator://stats',
      });
      const stats = JSON.parse(statsResult.contents[0].text);
      
      expect(stats.totalCalculations).toBe(initialTotal + 3);
    });

    test('should handle resource reading after calculations', async () => {
      // Perform calculation
      const calcResult = await client.callTool({
        name: 'divide',
        arguments: { input_1: 100, input_2: 25 },
      });

      const calcId = calcResult.structuredContent?.calculationId;

      // Read multiple resources
      const [constants, stats, history] = await Promise.all([
        client.readResource({ uri: 'calculator://constants' }),
        client.readResource({ uri: 'calculator://stats' }),
        client.readResource({ uri: `calculator://history/${calcId}` }),
      ]);

      expect(JSON.parse(constants.contents[0].text)).toHaveProperty('pi');
      expect(JSON.parse(stats.contents[0].text).totalCalculations).toBeGreaterThan(0);
      expect(JSON.parse(history.contents[0].text).result).toBe(4);
    });
  });

  describe('STDIO-Specific Features', () => {
    test('should support all STDIO transport capabilities', () => {
      // STDIO transport should support all standard capabilities
      expect(server.serverCapabilities).toBeDefined();
      expect(client.clientCapabilities).toBeDefined();
      
      // Client capabilities
      expect(client.clientCapabilities.tools).toBeDefined();
      expect(client.clientCapabilities.resources).toBeDefined();
      expect(client.clientCapabilities.prompts).toBeDefined();
      expect(client.clientCapabilities.logging).toBeDefined();
    });

    test('should handle structured content in responses', async () => {
      const result = await client.callTool({
        name: 'add',
        arguments: { input_1: 42, input_2: 58 },
      });

      // STDIO should support structured content
      expect(result.structuredContent).toBeDefined();
      expect(result.structuredContent?.result).toBe(100);
      expect(result.structuredContent?.calculationId).toBeDefined();
      
      // Should also have text content
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
    });

    test('should maintain session state across operations', async () => {
      // STDIO maintains a single session throughout
      const results: string[] = [];
      
      for (let i = 0; i < 5; i++) {
        const result = await client.callTool({
          name: 'add',
          arguments: { input_1: i, input_2: 1 },
        });
        results.push(result.structuredContent?.calculationId);
      }

      // All calculation IDs should be unique
      const uniqueIds = new Set(results);
      expect(uniqueIds.size).toBe(5);
      
      // Should be able to read all calculations from history
      for (const id of results) {
        const history = await client.readResource({
          uri: `calculator://history/${id}`,
        });
        expect(history.contents).toHaveLength(1);
      }
    });
  });
});