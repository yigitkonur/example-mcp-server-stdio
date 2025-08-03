# Test Cases for Interactive Elicitation

## Test Case 1: Rectangle Area
**Input**: "What is the area of a rectangle?"
**Expected**: Should trigger elicitation asking for length and width

## Test Case 2: Circle Area  
**Input**: "Calculate the area of a circle"
**Expected**: Should trigger elicitation asking for radius

## Test Case 3: Non-Ambiguous Area
**Input**: "What is the area of a rectangle with length 5 and width 3?"
**Expected**: Should calculate directly without elicitation (result: 15)

## Test Case 4: Non-Area Problem
**Input**: "What is 2 + 2?"
**Expected**: Should respond with generic solver message, no elicitation

## Test Case 5: Triangle Area (Not Implemented)
**Input**: "Find the area of a triangle"
**Expected**: Should use default response (elicitation not implemented for triangles)

## Testing with MCP Inspector

```bash
# Start the server
npm start

# In another terminal, test with inspector
npx @modelcontextprotocol/inspector --cli "node dist/server.js --stdio" --method tools/call --params '{"name":"solve_math_problem","arguments":{"problem":"What is the area of a rectangle?"}}'
```