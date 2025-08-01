import { spawn } from 'child_process';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

describe('STDIO Transport Tests', () => {
  let serverPath: string;

  beforeAll(() => {
    serverPath = './dist/server-stdio.js';
  });

  test('should handle basic calculate request', async () => {
    const server = spawn('node', [serverPath]);
    
    return new Promise<void>((resolve, reject) => {
      let output = '';
      
      server.stdout.on('data', (data) => {
        output += data.toString();
        const lines = output.split('\n');
        
        for (const line of lines) {
          if (line.trim() && line.startsWith('{')) {
            try {
              const response = JSON.parse(line);
              if (response.id === 1) {
                expect(response.jsonrpc).toBe('2.0');
                expect(response.result).toBeDefined();
                expect(response.result.value).toBe(8);
                expect(response.result.meta).toBeDefined();
                expect(response.result.meta.calculationId).toBeDefined();
                server.kill();
                resolve();
                return;
              }
            } catch (e) {
              // Ignore parse errors for non-JSON lines
            }
          }
        }
      });

      server.stderr.on('data', () => {
        // Ignore stderr (logging)
      });

      server.on('error', reject);
      server.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          reject(new Error(`Server exited with code ${code}`));
        }
      });

      // Send calculate request
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'calculate',
        params: { a: 5, b: 3, op: 'add' }
      };
      
      server.stdin.write(JSON.stringify(request) + '\n');
      server.stdin.end();
    });
  }, 10000);

  test('should handle demo_progress with progress notifications', async () => {
    const server = spawn('node', [serverPath]);
    
    return new Promise<void>((resolve, reject) => {
      let output = '';
      let progressCount = 0;
      let finalResult = false;
      
      server.stdout.on('data', (data) => {
        output += data.toString();
        const lines = output.split('\n');
        
        for (const line of lines) {
          if (line.trim() && line.startsWith('{')) {
            try {
              const response = JSON.parse(line);
              
              // Check progress notifications
              if (response.method === 'progress') {
                expect(response.jsonrpc).toBe('2.0');
                expect(response.params).toBeDefined();
                expect(response.params.relatedRequestId).toBe(2);
                expect(typeof response.params.pct).toBe('number');
                progressCount++;
              }
              
              // Check final result
              if (response.id === 2) {
                expect(response.jsonrpc).toBe('2.0');
                expect(response.result).toBeDefined();
                expect(response.result.message).toContain('Progress demonstration completed');
                finalResult = true;
                
                // Should have received 5 progress notifications
                expect(progressCount).toBe(5);
                server.kill();
                resolve();
                return;
              }
            } catch (e) {
              // Ignore parse errors for non-JSON lines
            }
          }
        }
      });

      server.stderr.on('data', () => {
        // Ignore stderr (logging)
      });

      server.on('error', reject);
      server.on('exit', (code) => {
        if (code !== 0 && code !== null && !finalResult) {
          reject(new Error(`Server exited with code ${code}`));
        }
      });

      // Send demo_progress request
      const request = {
        jsonrpc: '2.0',
        id: 2,
        method: 'demo_progress',
        params: {}
      };
      
      server.stdin.write(JSON.stringify(request) + '\n');
      server.stdin.end();
    });
  }, 20000);

  test('should handle batch_calculate request', async () => {
    const server = spawn('node', [serverPath]);
    
    return new Promise<void>((resolve, reject) => {
      let output = '';
      
      server.stdout.on('data', (data) => {
        output += data.toString();
        const lines = output.split('\n');
        
        for (const line of lines) {
          if (line.trim() && line.startsWith('{')) {
            try {
              const response = JSON.parse(line);
              if (response.id === 3) {
                expect(response.jsonrpc).toBe('2.0');
                expect(response.result).toBeDefined();
                expect(response.result.results).toBeDefined();
                expect(response.result.results.length).toBe(2);
                expect(response.result.results[0].success).toBe(true);
                expect(response.result.results[0].value).toBe(8);
                expect(response.result.results[1].success).toBe(true);
                expect(response.result.results[1].value).toBe(20);
                server.kill();
                resolve();
                return;
              }
            } catch (e) {
              // Ignore parse errors for non-JSON lines
            }
          }
        }
      });

      server.stderr.on('data', () => {
        // Ignore stderr (logging)
      });

      server.on('error', reject);
      server.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          reject(new Error(`Server exited with code ${code}`));
        }
      });

      // Send batch_calculate request
      const request = {
        jsonrpc: '2.0',
        id: 3,
        method: 'batch_calculate',
        params: {
          calculations: [
            { a: 5, b: 3, op: 'add' },
            { a: 10, b: 2, op: 'multiply' }
          ]
        }
      };
      
      server.stdin.write(JSON.stringify(request) + '\n');
      server.stdin.end();
    });
  }, 10000);

  test('should handle error cases properly', async () => {
    const server = spawn('node', [serverPath]);
    
    return new Promise<void>((resolve, reject) => {
      let output = '';
      
      server.stdout.on('data', (data) => {
        output += data.toString();
        const lines = output.split('\n');
        
        for (const line of lines) {
          if (line.trim() && line.startsWith('{')) {
            try {
              const response = JSON.parse(line);
              if (response.id === 4) {
                expect(response.jsonrpc).toBe('2.0');
                expect(response.error).toBeDefined();
                expect(response.error.message).toContain('Division by zero');
                server.kill();
                resolve();
                return;
              }
            } catch (e) {
              // Ignore parse errors for non-JSON lines
            }
          }
        }
      });

      server.stderr.on('data', () => {
        // Ignore stderr (logging)
      });

      server.on('error', reject);
      server.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          reject(new Error(`Server exited with code ${code}`));
        }
      });

      // Send division by zero request
      const request = {
        jsonrpc: '2.0',
        id: 4,
        method: 'calculate',
        params: { a: 10, b: 0, op: 'divide' }
      };
      
      server.stdin.write(JSON.stringify(request) + '\n');
      server.stdin.end();
    });
  }, 10000);
});