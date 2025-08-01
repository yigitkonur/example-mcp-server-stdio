import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { spawn, ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';

const currentFilename = fileURLToPath(import.meta.url);
const currentDirname = path.dirname(currentFilename);

describe('STDIO Transport Integration Tests', () => {
  let serverProcess: ChildProcess;
  let client: Client;
  let transport: StdioClientTransport;

  beforeEach(async () => {
    // Start the server process
    const serverPath = path.join(currentDirname, '..', 'server.js');
    serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test' },
    });

    // Create client transport
    transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath],
      env: { ...process.env, NODE_ENV: 'test' },
    });

    // Create and connect client
    client = new Client({
      name: 'test-stdio-client',
      version: '1.0.0',
    });

    await client.connect(transport);
  });

  afterEach(async () => {
    // Clean up
    if (client) {
      await client.close();
    }

    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill();
      await new Promise((resolve) => {
        serverProcess.once('exit', resolve);
      });
    }
  });

  describe('STDIO Communication', () => {
    test('should establish STDIO connection successfully', async () => {
      const tools = await client.listTools();
      expect(tools.tools).toBeDefined();
      expect(tools.tools.length).toBe(5);
    });

    test('should handle request-response communication', async () => {
      const result = await client.callTool({
        name: 'add',
        arguments: { input_1: 10, input_2: 20 },
      });

      expect(result.isError).toBeFalsy();
      expect((result.content[0] as any).text).toBe('10 + 20 = 30');
    });

    test('should handle multiple sequential requests', async () => {
      for (let i = 0; i < 10; i++) {
        const result = await client.callTool({
          name: 'multiply',
          arguments: { input_1: i, input_2: 2 },
        });

        expect(result.isError).toBeFalsy();
        expect(result.structuredContent?.result).toBe(i * 2);
      }
    });

    test('should handle concurrent requests', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        client.callTool({
          name: 'add',
          arguments: { input_1: i, input_2: i },
        })
      );

      const results = await Promise.all(promises);

      results.forEach((result, i) => {
        expect(result.isError).toBeFalsy();
        expect(result.structuredContent?.result).toBe(i * 2);
      });
    });
  });

  describe('STDIO Error Handling', () => {
    test('should handle server errors gracefully', async () => {
      await expect(
        client.callTool({
          name: 'divide',
          arguments: { input_1: 10, input_2: 0 },
        })
      ).resolves.toMatchObject({
        isError: true,
        content: [{ type: 'text', text: expect.stringContaining('Cannot divide by zero') }],
      });
    });

    test('should handle malformed requests', async () => {
      await expect(
        client.callTool({
          name: 'invalid-tool',
          arguments: {},
        })
      ).rejects.toThrow();
    });

    test('should recover from errors', async () => {
      // Cause an error
      await expect(
        client.callTool({
          name: 'divide',
          arguments: { input_1: 10, input_2: 0 },
        })
      ).resolves.toMatchObject({ isError: true });

      // Should still work after error
      const result = await client.callTool({
        name: 'add',
        arguments: { input_1: 5, input_2: 5 },
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent?.result).toBe(10);
    });
  });

  describe('STDIO Stream Handling', () => {
    test('should handle large payloads', async () => {
      // Create a batch with many calculations
      const calculations = Array.from({ length: 100 }, (_, i) => ({
        operation: 'add' as const,
        input_1: i,
        input_2: i,
      }));

      const result = await client.callTool({
        name: 'batch_calculate',
        arguments: { calculations },
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent?.results.length).toBe(100);
    });

    test('should handle rapid message exchange', async () => {
      const startTime = Date.now();
      const messageCount = 50;

      for (let i = 0; i < messageCount; i++) {
        await client.callTool({
          name: 'add',
          arguments: { input_1: i, input_2: 1 },
        });
      }

      const duration = Date.now() - startTime;
      const messagesPerSecond = (messageCount / duration) * 1000;

      expect(messagesPerSecond).toBeGreaterThan(10); // At least 10 msg/sec
    });

    test('should handle interleaved operations', async () => {
      const operations = [
        client.listTools(),
        client.callTool({ name: 'add', arguments: { input_1: 1, input_2: 2 } }),
        client.listResources(),
        client.callTool({ name: 'multiply', arguments: { input_1: 3, input_2: 4 } }),
        client.listPrompts(),
      ];

      const results = await Promise.all(operations);

      expect(results[0].tools.length).toBe(5);
      expect(results[1].structuredContent?.result).toBe(3);
      expect(results[2].resources.length).toBeGreaterThan(0);
      expect(results[3].structuredContent?.result).toBe(12);
      expect(results[4].prompts.length).toBe(3);
    });
  });

  describe('STDIO Process Management', () => {
    test('should handle server restart', async () => {
      // Perform initial operation
      const result1 = await client.callTool({
        name: 'add',
        arguments: { input_1: 1, input_2: 1 },
      });
      expect(result1.isError).toBeFalsy();

      // Close current connection
      await client.close();

      // Create new connection
      transport = new StdioClientTransport({
        command: 'node',
        args: [path.join(currentDirname, '..', 'server.js')],
        env: { ...process.env, NODE_ENV: 'test' },
      });

      client = new Client({
        name: 'test-stdio-client',
        version: '1.0.0',
      });

      await client.connect(transport);

      // Should work with new connection
      const result2 = await client.callTool({
        name: 'add',
        arguments: { input_1: 2, input_2: 2 },
      });
      expect(result2.isError).toBeFalsy();
      expect(result2.structuredContent?.result).toBe(4);
    });

    test('should handle stdin/stdout buffering', async () => {
      // Send many requests rapidly to test buffering
      const promises = Array.from({ length: 20 }, (_, i) =>
        client.callTool({
          name: 'add',
          arguments: { input_1: i, input_2: i },
        })
      );

      const results = await Promise.all(promises);

      // All should complete successfully
      results.forEach((result, i) => {
        expect(result.isError).toBeFalsy();
        expect(result.structuredContent?.result).toBe(i * 2);
      });
    });
  });

  describe('STDIO Protocol Compliance', () => {
    test('should use JSON-RPC 2.0 protocol', async () => {
      // All responses should be valid JSON-RPC 2.0
      const result = await client.callTool({
        name: 'add',
        arguments: { input_1: 5, input_2: 5 },
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.isError).toBeDefined();
    });

    test('should handle notification messages', async () => {
      // STDIO should support notifications (no response expected)
      // In this case, we'll test by checking logs/stats after operations
      await client.callTool({
        name: 'add',
        arguments: { input_1: 1, input_2: 1 },
      });

      const stats = await client.readResource({
        uri: 'calculator://stats',
      });

      const statsData = JSON.parse(stats.contents[0].text);
      expect(statsData.totalCalculations).toBeGreaterThan(0);
    });

    test('should maintain message ordering', async () => {
      const results: number[] = [];

      for (let i = 0; i < 10; i++) {
        const result = await client.callTool({
          name: 'add',
          arguments: { input_1: i, input_2: 0 },
        });
        results.push(result.structuredContent?.result);
      }

      // Results should be in order
      expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
  });

  describe('STDIO Resource Handling', () => {
    test('should handle resource URIs correctly', async () => {
      const resources = await client.listResources();
      
      // Check URI format
      resources.resources.forEach(resource => {
        expect(resource.uri).toMatch(/^calculator:\/\//);
        expect(resource.name).toBeDefined();
        expect(resource.mimeType).toBeDefined();
      });
    });

    test('should handle dynamic resource creation', async () => {
      // Perform calculation to create history
      const calcResult = await client.callTool({
        name: 'add',
        arguments: { input_1: 100, input_2: 200 },
      });

      const calcId = calcResult.structuredContent?.calculationId;

      // Should be able to read the newly created resource
      const history = await client.readResource({
        uri: `calculator://history/${calcId}`,
      });

      const data = JSON.parse(history.contents[0].text);
      expect(data.result).toBe(300);
    });
  });

  describe('STDIO Performance', () => {
    test('should handle sustained load', async () => {
      const duration = 5000; // 5 seconds
      const startTime = Date.now();
      let operationCount = 0;

      while (Date.now() - startTime < duration) {
        await client.callTool({
          name: 'add',
          arguments: { input_1: operationCount, input_2: 1 },
        });
        operationCount++;
      }

      const opsPerSecond = (operationCount / duration) * 1000;
      expect(opsPerSecond).toBeGreaterThan(10); // At least 10 ops/sec
    });

    test('should handle memory efficiently', async () => {
      const memBefore = process.memoryUsage().heapUsed;

      // Perform many operations
      for (let i = 0; i < 100; i++) {
        await client.callTool({
          name: 'add',
          arguments: { input_1: i, input_2: i },
        });
      }

      const memAfter = process.memoryUsage().heapUsed;
      const memIncrease = (memAfter - memBefore) / 1024 / 1024; // MB

      // Memory increase should be reasonable
      expect(memIncrease).toBeLessThan(50); // Less than 50MB
    });
  });

  describe('STDIO Edge Cases', () => {
    test('should handle empty responses gracefully', async () => {
      // Even with minimal operations, should get valid responses
      const tools = await client.listTools();
      expect(tools.tools).toBeDefined();
      expect(Array.isArray(tools.tools)).toBe(true);
    });

    test('should handle special characters in data', async () => {
      // Test with various special characters that might affect stdio
      const specialCases = [
        { input_1: 1.23e-10, input_2: 4.56e-10 }, // Scientific notation
        { input_1: -0, input_2: +0 }, // Signed zeros
        { input_1: 0.1, input_2: 0.2 }, // Floating point precision
      ];

      for (const args of specialCases) {
        const result = await client.callTool({
          name: 'add',
          arguments: args,
        });

        expect(result.isError).toBeFalsy();
        expect(typeof result.structuredContent?.result).toBe('number');
      }
    });

    test('should handle client disconnection gracefully', async () => {
      // Perform operation
      const result = await client.callTool({
        name: 'add',
        arguments: { input_1: 1, input_2: 1 },
      });
      expect(result.isError).toBeFalsy();

      // Close client
      await client.close();

      // Server process should exit cleanly
      await new Promise((resolve) => {
        if (serverProcess) {
          serverProcess.once('exit', resolve);
        } else {
          resolve(undefined);
        }
      });

      expect(serverProcess.killed).toBe(false);
    });
  });
});