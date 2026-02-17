import { WebSocketServer, WebSocket } from 'ws';
import { WSMessage, WSClientMessage } from '../types.js';
import { planStore } from '../store/plan-store.js';

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();

  start(port: number): void {
    try {
      this.wss = new WebSocketServer({ port });
    } catch (err) {
      console.error(`[Overture] WebSocket server failed to start on port ${port}:`, err);
      return;
    }

    this.wss.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[Overture] WebSocket port ${port} already in use - another instance may be running`);
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
          const message: WSClientMessage = JSON.parse(data.toString());
          this.handleClientMessage(message);
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

  broadcast(message: WSMessage): void {
    const data = JSON.stringify(message);
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
