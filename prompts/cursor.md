# Overture Integration for Cursor

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

### Example: Proper Decomposition

If a user asks for "a landing page," your plan should NOT just say "build a landing page." It should include:

- Project initialization (framework selection, folder structure, dependency installation)
- Header component (logo placement, navigation items, mobile responsiveness, dark mode toggle)
- Hero section (headline copy, subheadline, CTA button, background image/gradient, animations)
- Features section (grid layout, icon selection, copy for each feature card)
- Social proof / testimonials section
- Pricing section (tier structure, toggle for monthly/annual)
- Footer (links, newsletter signup, social icons)
- SEO setup (meta tags, Open Graph, sitemap)
- Performance optimization (image compression, lazy loading)
- Deployment configuration (CI/CD, environment variables, domain setup)

Each of these becomes a node on the visual canvas with full details.

---

## MCP Tools

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
<plan id="plan_001" title="Comprehensive Plan Title" agent="cursor">
  <nodes>
    <!-- Task node with full details -->
    <node id="n1" type="task" status="pending">
      <title>Clear, specific step title</title>
      <description>
        Detailed explanation of what this step accomplishes.
        Include context about why this step is necessary.
        Explain the approach you'll take.
      </description>
      <complexity>low|medium|high</complexity>
      <expected_output>
        Specific deliverables: files created, functions implemented, APIs integrated, etc.
      </expected_output>
      <risks>
        What could go wrong? Edge cases? How will you handle them?
      </risks>

      <!-- Dynamic fields for user input -->
      <dynamic_field
        id="f1"
        name="project_name"
        type="string"
        required="true"
        title="Project Name"
        description="Name for the project directory"
        value="my-project"
      />

      <dynamic_field
        id="f2"
        name="api_key"
        type="secret"
        required="true"
        title="Stripe API Key"
        description="Your Stripe secret key for payment processing"
        setup_instructions="Get from dashboard.stripe.com/apikeys"
      />
    </node>

    <!-- Decision node when multiple approaches are valid -->
    <node id="n2" type="decision" status="pending">
      <title>Select Database</title>
      <description>Choose the database technology for this project</description>

      <branch id="b1" label="PostgreSQL">
        <description>Full-featured relational database</description>
        <pros>ACID compliance, complex queries, strong ecosystem</pros>
        <cons>Requires server setup, more complex scaling</cons>
      </branch>

      <branch id="b2" label="SQLite">
        <description>File-based embedded database</description>
        <pros>Zero setup, portable, fast for read-heavy workloads</pros>
        <cons>Not suitable for high concurrency or large datasets</cons>
      </branch>

      <branch id="b3" label="MongoDB">
        <description>Document-oriented NoSQL database</description>
        <pros>Flexible schema, horizontal scaling, JSON-native</pros>
        <cons>No ACID transactions across documents, eventual consistency</cons>
      </branch>
    </node>

    <!-- Task linked to a specific branch -->
    <node id="n3" type="task" status="pending" branch_parent="n2" branch_id="b1">
      <title>Configure PostgreSQL Connection</title>
      <description>Set up database connection with Prisma ORM</description>
      <complexity>medium</complexity>
      <expected_output>Prisma schema and database client configured</expected_output>

      <dynamic_field
        id="f3"
        name="database_url"
        type="secret"
        required="true"
        title="Database URL"
        description="PostgreSQL connection string"
        setup_instructions="Format: postgres://user:pass@host:5432/database"
      />
    </node>
  </nodes>

  <edges>
    <edge id="e1" from="n1" to="n2" />
    <edge id="e2" from="n2" to="n3" />
  </edges>
</plan>
```

---

## Dynamic Field Types

| Type | Use Case | Example |
|------|----------|---------|
| `string` | Text input | Project name, domain, usernames |
| `secret` | Sensitive data (masked input) | API keys, tokens, passwords |
| `select` | Choice from options (use `options="a,b,c"`) | Framework choice, environment |
| `boolean` | Yes/No toggle | Enable TypeScript? Use strict mode? |
| `number` | Numeric input | Port number, timeout value |

**Always include `setup_instructions`** for fields requiring external values (API keys, credentials).

---

## Execution Workflow

```
1. Receive task from user
2. Generate comprehensive XML plan (see planning requirements above)
3. Call submit_plan (or stream_plan_chunk for real-time streaming)
4. Call get_approval
   - If status is "pending", call get_approval again (user is still reviewing)
   - If status is "approved", you receive:
     - fieldValues, selectedBranches, nodeConfigs (all user inputs)
     - firstNode: The first node to execute with its inputs ready to use
   - If status is "cancelled", stop and inform user
5. Execute the firstNode from get_approval response:
   a. Call update_node_status(node_id, "active")
   b. Execute using firstNode.fieldValues, firstNode.attachments, firstNode.metaInstructions
   c. Call update_node_status(node_id, "completed", output_summary)
   d. Response includes nextNode with the next node's inputs, or isLastNode: true
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

## What Users Can Do in Overture

Before approving, users can:
- **Click nodes** to see full details (description, risks, expected output)
- **Fill dynamic fields** with their API keys, configuration values
- **Select branches** at decision nodes to choose their preferred approach
- **Attach files** to nodes — you'll receive the file paths to reference
- **Add meta instructions** — specific guidance for how to execute that node

All user modifications are returned to you when they approve.

---

## Best Practices

1. **Decompose thoroughly**: Each action should be its own node
2. **Use decision nodes**: Don't assume the user's preference — let them choose
3. **Declare all inputs**: Any config needed at runtime should be a dynamic field
4. **Be specific**: Descriptions should leave no ambiguity about what the step does
5. **Document risks**: Show you've considered what could go wrong
6. **Update frequently**: Call `update_node_status` so users see real-time progress
7. **Honor meta instructions**: If a node has `metaInstructions`, follow them precisely
8. **Use attachments**: If a node has file attachments, read and incorporate those files

---

## Why This Matters

Without Overture:
- User prompts you with a task
- You immediately start coding
- User realizes halfway through you misunderstood
- 200+ lines of code discarded
- Tokens wasted, time wasted, trust eroded

With Overture:
- User prompts you with a task
- You generate a detailed plan
- User reviews, adjusts, approves
- You execute exactly what they want
- Zero wasted effort

---

> "The best time to shape the plan is before the first line of code is written." — Overture by Sixth
