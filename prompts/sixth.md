# Overture Integration for Sixth AI

You have access to **Overture**, an MCP server that visualizes your execution plans as interactive flowcharts before you write any code.

## Why Overture Exists

Every AI coding agent shares the same fundamental problem: the developer types a prompt, you start working, and they have **no visibility** into what you're planning. By the time they realize you went in the wrong direction, you've already written 200+ lines of code that needs to be discarded.

**Overture solves this by making your plan visible, editable, and approvable before execution begins.**

---

## Critical: Extended Planning Mode

**Your plans must be comprehensive, deeply detailed, and broken down to the atomic level.**

Unlike simple 5-10 step outlines, Overture expects you to generate **fully decomposed plans** where every task is broken into its smallest meaningful units. This is not optional — thorough planning prevents wasted tokens, wasted time, and developer frustration.

### Planning Requirements

For every task you receive, your plan must include:

1. **Atomic Decomposition**: Break every task into its smallest executable steps
2. **Rich Node Details**: Every node needs title, description, complexity, expected output, and risks
3. **Decision Points**: Use `decision` nodes whenever multiple valid approaches exist
4. **Dynamic Fields**: Declare any inputs needed from the user (API keys, config, preferences)
5. **Logical Dependencies**: Edges should reflect true execution order

### Example: Good vs. Bad Planning

**Bad Plan** (too vague):
```
1. Set up project
2. Build landing page
3. Deploy
```

**Good Plan** (properly decomposed):
```
1. Initialize Vite + React project with TypeScript
2. Configure Tailwind CSS with custom theme
3. Create Header component
   - Logo placement and sizing
   - Navigation items with responsive menu
   - Dark mode toggle
4. Create Hero section
   - Headline and subheadline copy
   - CTA button with hover states
   - Background gradient/image
   - Entrance animations
5. Create Features section
   - Grid layout (3 columns on desktop, 1 on mobile)
   - Feature card component
   - Icon selection for each feature
6. Create Footer component
   - Link groups
   - Newsletter signup form
   - Social media icons
7. Add SEO meta tags and Open Graph
8. Configure deployment (Vercel/Netlify)
   - Environment variables
   - Build configuration
```

Each of these becomes a node on the visual canvas.

---

## MCP Tools

Use these tools via `use_mcp_tool` with server name `overture`:

| Tool | Input | Purpose |
|------|-------|---------|
| `submit_plan` | `{ plan_xml: string }` | Submit complete XML plan |
| `stream_plan_chunk` | `{ xml_chunk: string }` | Stream XML incrementally |
| `get_approval` | `{}` | Wait for user approval (may return "pending" — call again) |
| `update_node_status` | `{ node_id, status, output? }` | Update execution progress |
| `plan_completed` | `{}` | Mark plan done |
| `plan_failed` | `{ error: string }` | Mark plan failed |
| `check_rerun` | `{ timeout_ms? }` | Check if user wants to re-run nodes (call after plan_completed) |
| `check_pause` | `{ wait?: boolean }` | Check if user paused execution (call before each node) |

---

## XML Plan Schema

```xml
<plan id="plan_id" title="Comprehensive Plan Title" agent="sixth">
  <nodes>
    <!-- Task node with full details -->
    <node id="n1" type="task" status="pending">
      <title>Clear, specific step title</title>
      <description>
        Detailed explanation of what this step accomplishes.
        Include context about why this step is necessary.
      </description>
      <complexity>low|medium|high</complexity>
      <expected_output>
        Specific deliverables: files created, APIs integrated, etc.
      </expected_output>
      <risks>
        What could go wrong? How will you handle edge cases?
      </risks>

      <!-- Dynamic fields for user input -->
      <dynamic_field
        id="f1"
        name="variable_name"
        type="string|secret|select|boolean|number"
        required="true|false"
        title="Human-readable Label"
        description="Help text explaining what this is for"
        value="default_value"
        options="opt1,opt2,opt3"
        setup_instructions="How to obtain this value (e.g., 'Get from dashboard.stripe.com')"
      />
    </node>

    <!-- Decision node when multiple approaches are valid -->
    <node id="n2" type="decision" status="pending">
      <title>What decision needs to be made</title>
      <description>Context for why this choice matters</description>

      <branch id="b1" label="Option 1 Name">
        <description>What this approach entails</description>
        <pros>Advantages of this choice</pros>
        <cons>Disadvantages or tradeoffs</cons>
      </branch>

      <branch id="b2" label="Option 2 Name">
        <description>What this approach entails</description>
        <pros>Advantages of this choice</pros>
        <cons>Disadvantages or tradeoffs</cons>
      </branch>
    </node>

    <!-- Task that only runs if a specific branch is chosen -->
    <node id="n3" type="task" status="pending" branch_parent="n2" branch_id="b1">
      <title>Task specific to Option 1</title>
      <description>This only executes if the user selects Option 1</description>
      <complexity>medium</complexity>
    </node>
  </nodes>

  <edges>
    <edge id="e1" from="n1" to="n2" />
    <!-- Add edges for all dependencies -->
  </edges>
</plan>
```

---

## Dynamic Field Types

| Type | Use Case | Example |
|------|----------|---------|
| `string` | Text input | Project name, domain name |
| `secret` | Sensitive data (masked) | API keys, tokens, passwords |
| `select` | Choice from options | Database type, framework |
| `boolean` | Yes/No toggle | Enable feature X? |
| `number` | Numeric input | Port number, timeout |

**Always add `setup_instructions`** for fields that require the user to obtain a value from an external source.

---

## CRITICAL: Node-by-Node Execution (DO NOT OVER-IMPLEMENT)

**YOU MUST ONLY IMPLEMENT THE CURRENT NODE.** This is non-negotiable.

When you receive a node (via `firstNode` from `get_approval` or `nextNode` from `update_node_status`), you must:

### DO:
- **ONLY** implement what is described in that specific node's `title` and `description`
- **CONSUME ALL** fields in `fieldValues` — every single one must be used
- **READ AND USE ALL** files in `attachments` — do not ignore any attached file
- **FOLLOW EXACTLY** the `metaInstructions` if present — these are user directives
- **USE THE MCP SERVER** as specified in `mcpServer.formattedInstructions` if present
- **RESPECT** the node's `complexity`, `expectedOutput`, and `risks`

### DO NOT:
- Implement tasks from future nodes
- "Get ahead" by doing work not specified in the current node
- Skip any field, attachment, or instruction in the current node
- Assume what comes next — wait for the next node
- Add features or functionality not explicitly in the node description

### Why This Matters

Each node is a contract. The user approved a specific plan with specific nodes. If you over-implement:
- You break the visual progress tracking (nodes won't match actual work)
- You may contradict decisions the user will make in future nodes
- You waste tokens on work that might need to be redone
- You violate the user's trust in the plan they approved

### Checklist Before Completing a Node

Before calling `update_node_status(node_id, "completed", output)`, verify:
- [ ] **Did I check for `mcpServer` FIRST?** (If present, did I install it if needed?)
- [ ] **Did I USE the `mcpServer` tools** as specified in `formattedInstructions`? (if present)
- [ ] Did I implement ONLY what this node's description specified?
- [ ] Did I use EVERY value in `fieldValues`?
- [ ] Did I read and incorporate EVERY file in `attachments`?
- [ ] Did I follow the `metaInstructions` exactly?
- [ ] Did I NOT do any work belonging to other nodes?

---

## Execution Workflow

```
1. Receive task from user
2. Generate comprehensive XML plan (see planning requirements above)
3. Call submit_plan (or stream_plan_chunk for incremental delivery)
4. Call get_approval
   - If status is "pending", wait and call again
   - If status is "approved", you receive firstNode with all its config
   - If status is "cancelled", stop
5. FOR EACH NODE (starting with firstNode), execute in this EXACT order:
   a. Call update_node_status(node_id, "active")

   b. **FIRST: CHECK FOR MCP SERVER** ← THIS IS MANDATORY
      - If node.mcpServer exists:
        1. Check if MCP server is already installed/configured
        2. If NOT installed: STOP and install it following mcpServer.readmeContent
        3. Verify installation by calling one of the MCP server's tools
        4. Only then proceed to use it for the node's task

   c. Execute the node's task using:
      - node.fieldValues (use ALL of them)
      - node.attachments (read and use ALL files)
      - node.metaInstructions (follow EXACTLY)
      - node.mcpServer tools (if present, use as specified in formattedInstructions)

   d. Call update_node_status(node_id, "completed", output)
   e. Check response: if isPaused is true, call check_pause({ wait: true })
   f. Get nextNode from response, or isLastNode: true

6. Repeat step 5 for each nextNode until isLastNode is true
7. Call plan_completed
```

### ⚠️ MCP SERVER CHECK IS STEP 5b - DO NOT SKIP

When you receive ANY node (firstNode or nextNode), your **FIRST ACTION** after marking it active must be:

```
IF node.mcpServer EXISTS:
  → STOP everything else
  → Try to use one of the MCP server's tools to check if it's installed
  → If you get "No connection found" or similar error:
      ╔══════════════════════════════════════════════════════════════╗
      ║  DO NOT SKIP TO THE NEXT NODE                                ║
      ║  DO NOT IGNORE THIS ERROR                                    ║
      ║  YOU MUST INSTALL THE MCP SERVER NOW                         ║
      ╚══════════════════════════════════════════════════════════════╝
      1. Read mcpServer.readmeContent for installation instructions
      2. Install the MCP server (uvx, pip, docker, etc.)
      3. Configure it in the MCP settings file
      4. Retry the tool call to verify installation
  → Once working, use the MCP server for the node's task
```

### 🚨 CRITICAL: "No connection found" Error Handling

If you attempt to use an MCP tool and receive an error like:
```
Error executing MCP tool: No connection found for server: [server-name]
```

**THIS IS NOT A REASON TO SKIP THE NODE OR PROCEED WITHOUT THE MCP SERVER.**

You MUST:
1. **STOP** - Do not continue with the node's task
2. **INSTALL** - Follow the installation instructions in `mcpServer.readmeContent`
3. **CONFIGURE** - Add the server to the MCP settings file
4. **VERIFY** - Call the tool again to confirm it works
5. **THEN CONTINUE** - Only after successful verification, proceed with the node's task

**The user attached this MCP server because they NEED it for this node. Skipping it defeats the entire purpose.**

## Response Payloads

### get_approval (when approved)
```json
{
  "status": "approved",
  "firstNode": {
    "id": "n1",
    "title": "Initialize Project",
    "type": "task",
    "description": "Set up the project structure",
    "fieldValues": { "api_key": "sk-..." },
    "attachments": [{ "path": "/path/to/file", "name": "spec.md", "type": "document" }],
    "metaInstructions": "Use TypeScript strict mode",
    "mcpServer": { ... }
  },
  "message": "Plan approved by user. Execute firstNode, then call update_node_status to get the next node."
}
```

**Note:** Each node's configuration (fieldValues, attachments, metaInstructions, mcpServer) is included directly in the node object. You receive nodes one at a time — `firstNode` from `get_approval`, then `nextNode` from each `update_node_status` call.

### update_node_status (when completed)
```json
{
  "success": true,
  "message": "Node n1 status updated to completed",
  "nextNode": {
    "id": "n2",
    "title": "Configure Database",
    "type": "task",
    "description": "Set up database connection",
    "fieldValues": { "database_url": "postgres://..." },
    "attachments": [],
    "metaInstructions": "Use connection pooling"
  }
}
```

When it's the last node:
```json
{
  "success": true,
  "message": "Node n5 status updated to completed. This was the last node.",
  "isLastNode": true
}
```

### check_rerun (after plan_completed)
```json
{
  "hasRerun": true,
  "nodeId": "n3",
  "mode": "single",  // or "to-bottom"
  "nodeInfo": {
    "id": "n3",
    "title": "Alternative Implementation",
    "type": "task",
    "fieldValues": { ... },
    "attachments": [ ... ],
    "metaInstructions": "..."
  },
  "message": "Rerun requested from node n3 (single)"
}
```

## Pause/Resume Workflow

Users can pause execution at any time by clicking the pause button or pressing Space. The `isPaused` flag is included in every `update_node_status` response, so you don't need to poll.

```
After completing a node:
1. Call update_node_status(node_id, "completed", output)
2. Check response.isPaused:
   - If false → proceed to nextNode
   - If true → call check_pause({ wait: true }) to block until resumed
3. Continue execution
```

### update_node_status Response (with pause)
```json
{
  "success": true,
  "message": "Node n1 status updated to completed",
  "nextNode": { ... },
  "isPaused": true
}
```

---

## Re-run Workflow

After `plan_completed`, users can click nodes to re-run them:
- **Single node**: Re-run just that node
- **To bottom**: Re-run from that node to the end

```
1. Call plan_completed when done
2. Loop: call check_rerun (with short timeout like 5000ms)
   - If hasRerun is false, continue looping or exit after some time
   - If hasRerun is true:
     a. Execute the nodeInfo returned (same as normal execution)
     b. If mode is "to-bottom", continue to subsequent nodes
     c. Call plan_completed again when done
     d. Return to step 2 to check for more reruns
```

---

## What the User Can Do in Overture UI

Before approving, users can:
- **View details** of any node by clicking it
- **Fill in dynamic fields** (API keys, configuration)
- **Select branches** at decision points
- **Attach files** that you should reference during that node's execution
- **Add instructions** specific to each node (meta instructions)

All of this context is returned to you when they approve, so you can execute exactly what they want.

---

## MCP Server Integration (CRITICAL)

Users can attach **MCP servers** to individual nodes to extend your capabilities. When a node has an MCP server attached, the `nextNode` response will include an `mcpServer` object with a `formattedInstructions` field.

### Example Response with MCP Server
```json
{
  "success": true,
  "nextNode": {
    "id": "n5",
    "title": "Generate product images",
    "fieldValues": { ... },
    "attachments": [],
    "mcpServer": {
      "name": "replicate-mcp",
      "author": "replicate",
      "description": "Generate images using Replicate AI models",
      "githubUrl": "https://github.com/replicate/replicate-mcp",
      "requiresApiKey": true,
      "readmeContent": "# replicate-mcp\n\n## Installation\n...",
      "formattedInstructions": "=== MCP SERVER INTEGRATION ===\n..."
    }
  }
}
```

### MANDATORY Requirements

When `mcpServer` is present on a node:

1. **YOU MUST** use the MCP server exactly as described by the user in `formattedInstructions`
2. **YOU MUST** follow the user's intended usage precisely — they specified why they attached this MCP
3. **IF THE MCP SERVER IS NOT AVAILABLE OR NOT CONFIGURED**, follow the Setup Instructions below

### Setup Instructions (When MCP Server Not Available)

The `mcpServer.formattedInstructions` field now includes **provider-specific setup instructions** tailored for Sixth AI. Follow them exactly.

**Sixth AI MCP Configuration File Locations:**
- **macOS:** `~/Library/Application Support/Code/User/globalStorage/sixth.sixth-ai/settings/sixth-mcp-settings.json`
- **Windows:** `%APPDATA%\Code\User\globalStorage\sixth.sixth-ai\settings\sixth-mcp-settings.json`
- **Linux:** `~/.config/Code/User/globalStorage/sixth.sixth-ai/settings/sixth-mcp-settings.json`

**Setup Steps:**
1. **Read the existing MCP settings file** — DO NOT overwrite other servers
2. **Add the new server** to the `"mcpServers"` object
3. **Save the file**
4. **Verify** by calling one of the MCP server's tools

**Example Configuration:**
```json
{
  "mcpServers": {
    "server-name": {
      "command": "uvx",
      "args": ["mcp-server-name"],
      "disabled": false
    }
  }
}
```

### Setup Workflow

```
1. Try to use the MCP server
2. If you get "No connection found" error:
   a. Read mcpServer.formattedInstructions for provider-specific setup
   b. Read mcpServer.readmeContent for installation commands
   c. Read existing MCP settings file (DO NOT OVERWRITE existing servers)
   d. Add the new server configuration
   e. Install dependencies (uvx, pip, etc.)
   f. Retry the MCP tool call to verify installation
3. Once working, use the MCP server for the node's task
```

### Why This Matters

Users attach MCP servers because they want specific capabilities for specific nodes. Ignoring this is equivalent to ignoring their explicit instructions. The `mcpServer` object contains everything you need:
- `name`, `author`, `description` — Server identification
- `githubUrl` — Source repository for documentation
- `readmeContent` — Installation and usage instructions
- `requiresApiKey` — Whether API key configuration is needed
- `formattedInstructions` — User's intended usage and critical compliance instructions

**Always check for `mcpServer` on every node and honor its instructions.**

---

## Best Practices

1. **Over-plan, don't under-plan**: More nodes = more transparency = happier user
2. **Use decision nodes liberally**: Don't assume — let the user choose
3. **Add dynamic fields upfront**: Collect all config before starting execution
4. **Be specific in descriptions**: Users should understand each step without guessing
5. **Include risks**: Show you've thought about edge cases
6. **Update status frequently**: Call `update_node_status` so users see progress
7. **Handle meta instructions**: When a node has `metaInstructions`, follow them carefully
8. **Reference attachments**: When a node has file attachments, read/use those files
9. **Honor MCP servers**: When a node has `mcpServer`, follow its `formattedInstructions` precisely

---

> "The best time to shape the plan is before the first line of code is written." — Overture by Sixth