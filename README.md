# Overture

**Agent Plan Visualizer** — An Open-Source MCP Server by [Sixth](https://trysixth.com)

<p align="center">
  <img src="https://firebasestorage.googleapis.com/v0/b/sixth-v2.appspot.com/o/Screenshot%202026-02-21%20at%207.37.40%E2%80%AFAM.png?alt=media&token=13b29c30-dd91-4f26-bd35-0b87b5d23b6d" alt="Overture Plan Canvas" width="100%" />
</p>

> See what your AI coding agent plans to do **before** it writes a single line of code.

---

## The Problem

Every AI coding agent today — Cursor, Claude Code, Cline, Copilot — shares the same fundamental UX flaw: you type a prompt, the agent starts working, and you have **no visibility** into what it plans to do. By the time you realize it went in the wrong direction, it's already written 200+ lines of code you need to discard.

## The Solution

Overture intercepts the planning phase and renders it as an **interactive visual flowchart**. You can:

- **See** every step the agent plans to take
- **Choose** between alternative approaches at decision points
- **Configure** API keys, settings, and options before execution starts
- **Watch** real-time progress as execution happens

## Features

- **Visual Plan Canvas** — Interactive flowchart built with ReactFlow
- **Decision Nodes** — Choose between branching implementation approaches
- **Dynamic Fields** — Input API keys, configuration, and preferences before execution
- **Real-time Updates** — Watch nodes light up as execution progresses
- **Agent Agnostic** — Works with Claude Code, Cursor, Cline, and any MCP-compatible tool
- **Runs Locally** — Your data never leaves your machine

## Quick Start

### 1. Install

```bash
npx overture
```

This starts the Overture server and opens the visual canvas in your browser.

### 2. Configure Your Agent

Add Overture to your MCP configuration:

**Claude Code** (`~/.config/claude-code/settings.json`):
```json
{
  "mcpServers": {
    "overture": {
      "command": "npx",
      "args": ["overture"]
    }
  }
}
```

**Cursor** (`.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "overture": {
      "command": "npx",
      "args": ["overture"]
    }
  }
}
```

**Cline** (VS Code MCP settings):
```json
{
  "overture": {
    "command": "npx",
    "args": ["overture"]
  }
}
```

### 3. Add Agent Instructions

Include the Overture prompt in your agent's system instructions. See [`prompts/`](./prompts/) for ready-to-use templates.

## How It Works

```
┌──────────────────────────────────────────────────────────────┐
│                         AI AGENT                              │
│  1. Receives task from user                                  │
│  2. Generates XML plan                                       │
│  3. Calls submit_plan() MCP tool                             │
│  4. Waits for get_approval() — blocks until user approves    │
│  5. Executes, calling update_node_status() for each step     │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    OVERTURE MCP SERVER                        │
│  • Parses XML plan (streaming or complete)                   │
│  • Emits nodes/edges via WebSocket                           │
│  • Collects user input (field values, branch selections)     │
│  • Returns approval + config to agent                        │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                      WEB UI CANVAS                            │
│  • Renders plan as interactive graph                         │
│  • User clicks nodes to view details                         │
│  • User fills in dynamic fields                              │
│  • User selects branches at decision points                  │
│  • User clicks "Approve & Execute"                           │
└──────────────────────────────────────────────────────────────┘
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `submit_plan` | Submit a complete plan XML |
| `stream_plan_chunk` | Stream plan XML incrementally for real-time node appearance |
| `get_approval` | Block until user approves the plan, returns field values |
| `update_node_status` | Update a node's status during execution |
| `plan_completed` | Mark the plan as successfully completed |
| `plan_failed` | Mark the plan as failed with an error message |

## Plan XML Schema

```xml
<plan id="unique_id" title="Plan Title" agent="agent-name">
  <nodes>
    <node id="n1" type="task" status="pending">
      <title>Step title</title>
      <description>What this step does</description>
      <complexity>low|medium|high</complexity>
      <expected_output>What this produces</expected_output>
      <risks>Potential issues</risks>

      <dynamic_field
        id="f1" name="api_key" type="secret" required="true"
        title="API Key" description="Your API key"
        setup_instructions="Get from dashboard.example.com"
      />
    </node>

    <node id="n2" type="decision" status="pending">
      <title>Choose approach</title>
      <branch id="b1" label="Option A">
        <description>First approach</description>
        <pros>Benefits</pros>
        <cons>Drawbacks</cons>
      </branch>
    </node>
  </nodes>

  <edges>
    <edge id="e1" from="n1" to="n2" />
  </edges>
</plan>
```

## Development

```bash
# Clone the repo
git clone https://github.com/sixth/overture
cd overture

# Install dependencies
pnpm install

# Start development servers
pnpm dev

# Build for production
pnpm build
```

### Project Structure

```
overture/
├── packages/
│   ├── mcp-server/    # MCP server, XML parser, WebSocket
│   └── ui/            # React + ReactFlow canvas
├── prompts/           # Agent instruction templates
└── examples/          # Example plan XML files
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `OVERTURE_HTTP_PORT` | `3031` | Port for the web UI |
| `OVERTURE_WS_PORT` | `3030` | Port for WebSocket |
| `OVERTURE_AUTO_OPEN` | `true` | Auto-open browser on start |

## Roadmap

- [x] Core MCP server
- [x] Visual canvas with ReactFlow
- [x] Streaming XML parser
- [x] Decision nodes and branch selection
- [x] Dynamic input fields
- [x] Real-time execution tracking
- [ ] Parallel execution (run multiple branches)
- [ ] Plan templates library
- [ ] File/image attachments
- [ ] Collaboration features
- [ ] Export to Markdown/PNG

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT — see [LICENSE](./LICENSE)

---

<p align="center">
  Built with ❤️ by <a href="https://sixth.dev">Sixth</a>
</p>
