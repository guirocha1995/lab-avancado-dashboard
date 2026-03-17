const clients = [];
let eventIdCounter = 0;

function addClient(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  res.write(`event: connected\ndata: ${JSON.stringify({ type: 'connected', message: 'SSE connection established', clientCount: clients.length + 1 })}\n\n`);

  clients.push(res);
  console.log(`SSE client connected. Total clients: ${clients.length}`);

  req.on('close', () => {
    const index = clients.indexOf(res);
    if (index !== -1) {
      clients.splice(index, 1);
    }
    console.log(`SSE client disconnected. Total clients: ${clients.length}`);
  });
}

function broadcast(event) {
  eventIdCounter += 1;

  const now = new Date().toISOString();
  const eventType = event.type || 'unknown';

  const payload = {
    id: eventIdCounter,
    eventType,
    source: event.source || 'app-service',
    payload: event.payload || {},
    severity: event.severity || 'info',
    createdAt: event.timestamp || now,
  };

  const data = `event: event\ndata: ${JSON.stringify(payload)}\n\n`;

  clients.forEach((client) => {
    try {
      client.write(data);
    } catch (err) {
      console.error('Error writing to SSE client:', err.message);
    }
  });

  return payload;
}

function getClientCount() {
  return clients.length;
}

module.exports = { addClient, broadcast, getClientCount };
