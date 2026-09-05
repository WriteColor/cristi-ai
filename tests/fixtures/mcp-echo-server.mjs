// Minimal newline-delimited MCP stdio server used by the packaged Electron
// smoke test. It deliberately has no dependencies so it runs in a clean CI
// profile and exercises the same JSON-RPC framing as production servers.
let buffer = '';

function send(message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
}

function handle(message) {
  if (message.method === 'initialize') {
    send({ id: message.id, result: {
      protocolVersion: '2025-03-26',
      capabilities: { tools: {} },
      serverInfo: { name: 'cristi-test-mcp', version: '1.0.0' }
    } });
    return;
  }
  if (message.method === 'tools/list') {
    send({ id: message.id, result: {
      tools: [{
        name: 'echo',
        description: 'Devuelve el texto recibido.',
        inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] }
      }]
    } });
    return;
  }
  if (message.method === 'tools/call') {
    send({ id: message.id, result: { content: [{ type: 'text', text: String(message.params?.arguments?.text || '') }] } });
  }
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    try { handle(JSON.parse(line)); } catch (_) { /* malformed input is ignored */ }
  }
});
