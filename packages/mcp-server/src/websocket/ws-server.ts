import { WebSocketServer, WebSocket } from 'ws';
import { WSMessage, WSClientMessage } from '../types.js';
import { planStore } from '../store/plan-store.js';

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private relayClient: WebSocket | null = null;
  private port: number = 3030;

  start(port: number): void {
    this.port = port;

    try {
      this.wss = new WebSocketServer({ port });
    } catch (err) {
      console.error(`[Overture] WebSocket server failed to start on port ${port}, will try relay mode`);
      this.connectAsRelay(port);
      return;
    }

    this.wss.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[Overture] WebSocket port ${port} already in use - connecting as relay client`);
        this.wss = null;
        this.connectAsRelay(port);
      } else {
        console.error(`[Overture] WebSocket server error:`, err);
      }
    });

    console.error(`[Overture] WebSocket server listening on ws://localhost:${port}`);

    this.wss.on('connection', (ws) => {
      console.error('[Overture] Client connected');
      this.clients.add(ws);

      // Send connection confirmation
      this.send(ws, { type: 'connected' });

      // Send current state if plan exists
      const plan = planStore.getPlan();
      if (plan) {
        this.send(ws, { type: 'plan_started', plan });

        // Send all existing nodes
        for (const node of planStore.getNodes()) {
          this.send(ws, { type: 'node_added', node });
        }

        // Send all existing edges
        for (const edge of planStore.getEdges()) {
          this.send(ws, { type: 'edge_added', edge });
        }

        // Send ready status if applicable
        if (plan.status === 'ready') {
          this.send(ws, { type: 'plan_ready' });
        }
      }

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());

          // Handle relay messages from other MCP server instances
          if (message.type === 'relay' && message.payload) {
            console.error('[Overture] Relaying message:', message.payload.type);
            // Broadcast the relayed message to all UI clients
            const relayData = JSON.stringify(message.payload);
            for (const client of this.clients) {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(relayData);
              }
            }
            return;
          }

          this.handleClientMessage(message as WSClientMessage);
        } catch (error) {
          console.error('[Overture] Failed to parse client message:', error);
        }
      });

      ws.on('close', () => {
        console.error('[Overture] Client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('[Overture] WebSocket error:', error);
        this.clients.delete(ws);
      });
    });
  }

  private handleClientMessage(message: WSClientMessage): void {
    switch (message.type) {
      case 'approve_plan':
        console.error('[Overture] Plan approved by user');
        planStore.setApproval(message.fieldValues, message.selectedBranches, message.nodeConfigs || {});
        break;

      case 'cancel_plan':
        console.error('[Overture] Plan cancelled by user');
        planStore.cancelApproval();
        break;
    }
  }

  private connectAsRelay(port: number): void {
    try {
      this.relayClient = new WebSocket(`ws://localhost:${port}`);

      this.relayClient.on('open', () => {
        console.error('[Overture] Connected as relay client to existing server');
      });

      this.relayClient.on('error', (err) => {
        console.error('[Overture] Relay client error:', err.message);
        this.relayClient = null;
      });

      this.relayClient.on('close', () => {
        console.error('[Overture] Relay client disconnected');
        this.relayClient = null;
      });
    } catch (err) {
      console.error('[Overture] Failed to connect as relay:', err);
    }
  }

  broadcast(message: WSMessage): void {
    const data = JSON.stringify(message);

    // If we're in relay mode, send to the main server
    if (this.relayClient && this.relayClient.readyState === WebSocket.OPEN) {
      // Send as a relay message that the main server will broadcast
      this.relayClient.send(JSON.stringify({ type: 'relay', payload: message }));
      return;
    }

    // Otherwise broadcast to our own clients
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  private send(ws: WebSocket, message: WSMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  stop(): void {
    if (this.wss) {
      for (const client of this.clients) {
        client.close();
      }
      this.wss.close();
      this.wss = null;
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();
