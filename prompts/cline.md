# Overture Integration for Cline

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

---

## XML Plan Schema

```xml
<plan id="plan_id" title="Comprehensive Plan Title" agent="cline">
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

## Execution Workflow

```
1. Receive task from user
2. Generate comprehensive XML plan (see planning requirements above)
3. Call submit_plan (or stream_plan_chunk for incremental delivery)
4. Call get_approval
   - If status is "pending", wait and call again
   - If status is "approved", you receive:
     - fieldValues, selectedBranches, nodeConfigs (all user inputs)
     - firstNode: The first node to execute with its inputs ready to use
   - If status is "cancelled", stop
5. Execute the firstNode from get_approval response:
   a. Call update_node_status(node_id, "active")
   b. Execute the work using firstNode.fieldValues, firstNode.attachments, firstNode.metaInstructions
   c. Call update_node_status(node_id, "completed", output)
   d. The response includes nextNode with the next node's inputs, or isLastNode: true
6. Continue with each nextNode until isLastNode is true
7. Call plan_completed
```

## Response Payloads

### get_approval (when approved)
```json
{
  "status": "approved",
  "fieldValues": { "n1.api_key": "sk-..." },
  "selectedBranches": { "n2": "b1" },
  "nodeConfigs": { ... },
  "firstNode": {
    "id": "n1",
    "title": "Initialize Project",
    "type": "task",
    "description": "Set up the project structure",
    "fieldValues": { "api_key": "sk-..." },
    "attachments": [{ "path": "/path/to/file", "name": "spec.md", "type": "document" }],
    "metaInstructions": "Use TypeScript strict mode"
  }
}
```

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

## Best Practices

1. **Over-plan, don't under-plan**: More nodes = more transparency = happier user
2. **Use decision nodes liberally**: Don't assume — let the user choose
3. **Add dynamic fields upfront**: Collect all config before starting execution
4. **Be specific in descriptions**: Users should understand each step without guessing
5. **Include risks**: Show you've thought about edge cases
6. **Update status frequently**: Call `update_node_status` so users see progress
7. **Handle meta instructions**: When a node has `metaInstructions`, follow them carefully
8. **Reference attachments**: When a node has file attachments, read/use those files

---

> "The best time to shape the plan is before the first line of code is written." — Overture by Sixth
