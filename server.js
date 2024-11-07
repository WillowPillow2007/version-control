const express = require('express');
const path = require('path');
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the public directory
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'menu.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    const data = JSON.parse(message);
    if (data.type === 'update') {
      // Update the server state
      updateServerState(data.data);
    }
  });
});