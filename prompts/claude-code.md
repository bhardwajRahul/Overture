# Overture Integration for Claude Code

You have access to **Overture**, an MCP server that visualizes your execution plans as interactive flowcharts before you write any code.

## Why Overture Exists

Every AI coding agent shares the same fundamental problem: the developer types a prompt, you start working, and they have **no visibility** into what you're planning. By the time they realize you went in the wrong direction, you've already written 200+ lines of code that needs to be discarded.

**Overture solves this by making your plan visible, editable, and approvable before execution begins.**

---

## When to Use Overture

**USE** Overture for any task involving:
- Multiple steps or files to create/modify
- Architectural decisions the user should weigh in on
- User configuration (API keys, preferences, settings)
- Complex implementations with multiple valid approaches
- Tasks where getting alignment upfront saves significant rework

**DO NOT USE** Overture for:
- Simple questions or explanations
- Single-file, small edits
- Quick bug fixes with obvious solutions
- Research or exploration tasks

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

If a user asks for "a full-stack e-commerce app with Stripe integration," your plan should include nodes like:

**Project Setup Phase:**
- Initialize Next.js project with TypeScript and App Router
- Configure Tailwind CSS and component library
- Set up ESLint and Prettier configuration
- Initialize Git repository with .gitignore

**Database Phase:**
- Decision node: Choose database (PostgreSQL vs Planetscale vs Supabase)
- Configure Prisma ORM with selected database
- Create database schema (products, users, orders, cart)
- Set up database migrations

**Authentication Phase:**
- Decision node: Choose auth approach (NextAuth vs Clerk vs custom)
- Implement sign up flow with email verification
- Implement login flow with session management
- Add password reset functionality

**Product Catalog:**
- Create Product model and API routes
- Build product listing page with filters
- Build product detail page
- Implement search functionality

**Shopping Cart:**
- Create Cart context/store
- Build cart drawer/page component
- Implement add/remove/update quantity
- Add cart persistence (localStorage + database sync)

**Stripe Integration:**
- Configure Stripe API keys
- Create checkout session endpoint
- Build checkout page with Stripe Elements
- Implement webhook handler for payment events
- Handle success/failure states

**Order Management:**
- Create Order model and API routes
- Build order confirmation page
- Implement order history page
- Add email notifications

**Deployment:**
- Decision node: Choose platform (Vercel vs Railway vs custom)
- Configure environment variables
- Set up CI/CD pipeline
- Configure production database

Each of these becomes a node on the visual canvas with full details, risks, and expected outputs.

---

## MCP Tools

| Tool | Input | Purpose |
|------|-------|---------|
| `submit_plan` | `{ plan_xml: string }` | Submit complete XML plan |
| `stream_plan_chunk` | `{ xml_chunk: string }` | Stream XML incrementally for real-time display |
| `get_approval` | `{}` | Wait for user approval (may return "pending" — call again) |
| `update_node_status` | `{ node_id, status, output? }` | Update execution progress |
| `plan_completed` | `{}` | Mark plan done |
| `plan_failed` | `{ error: string }` | Mark plan failed |

---

## XML Plan Schema

```xml
<plan id="plan_001" title="Comprehensive Plan Title" agent="claude-code">
  <nodes>
    <!-- Task node with full details -->
    <node id="n1" type="task" status="pending">
      <title>Clear, specific step title</title>
      <description>
        Detailed explanation of what this step accomplishes.
        Include context about why this step is necessary.
        Explain the technical approach you'll take.
      </description>
      <complexity>low|medium|high</complexity>
      <expected_output>
        Specific deliverables:
        - Files created: src/components/Button.tsx
        - APIs integrated: Stripe checkout session
        - Database changes: New User table
      </expected_output>
      <risks>
        What could go wrong? Edge cases to handle?
        - Risk: API rate limiting
        - Mitigation: Implement exponential backoff
      </risks>

      <!-- Dynamic fields for user input -->
      <dynamic_field
        id="f1"
        name="stripe_secret_key"
        type="secret"
        required="true"
        title="Stripe Secret Key"
        description="Your Stripe secret API key for payment processing"
        setup_instructions="Get from dashboard.stripe.com/apikeys. Use test key (sk_test_...) for development."
      />

      <dynamic_field
        id="f2"
        name="enable_typescript"
        type="boolean"
        required="false"
        title="Enable TypeScript"
        description="Use TypeScript for type safety"
        value="true"
      />

      <dynamic_field
        id="f3"
        name="css_framework"
        type="select"
        required="true"
        title="CSS Framework"
        description="Choose your styling approach"
        options="Tailwind CSS,CSS Modules,Styled Components,Plain CSS"
        value="Tailwind CSS"
      />
    </node>

    <!-- Decision node when multiple approaches are valid -->
    <node id="n2" type="decision" status="pending">
      <title>Select Authentication Strategy</title>
      <description>
        Choose how users will authenticate with your application.
        This affects security model, user experience, and maintenance burden.
      </description>

      <branch id="b1" label="NextAuth.js">
        <description>Full-featured auth library with provider support</description>
        <pros>Many OAuth providers, session management, database adapters</pros>
        <cons>Can be complex to customize, learning curve</cons>
      </branch>

      <branch id="b2" label="Clerk">
        <description>Managed authentication service</description>
        <pros>Beautiful UI components, easy setup, handles edge cases</pros>
        <cons>Third-party dependency, potential vendor lock-in, costs at scale</cons>
      </branch>

      <branch id="b3" label="Custom JWT">
        <description>Build authentication from scratch</description>
        <pros>Full control, no dependencies, deep understanding</pros>
        <cons>Security risks if done wrong, more code to maintain</cons>
      </branch>
    </node>

    <!-- Task linked to a specific branch -->
    <node id="n3" type="task" status="pending" branch_parent="n2" branch_id="b1">
      <title>Configure NextAuth.js</title>
      <description>
        Set up NextAuth.js with email/password and OAuth providers.
        Configure session strategy and database adapter.
      </description>
      <complexity>medium</complexity>
      <expected_output>
        - /app/api/auth/[...nextauth]/route.ts configured
        - Prisma adapter connected
        - Google OAuth provider enabled
        - Session callback customized
      </expected_output>
      <risks>
        - OAuth redirect URLs must match exactly
        - Database session table must exist
      </risks>

      <dynamic_field
        id="f4"
        name="google_client_id"
        type="string"
        required="true"
        title="Google OAuth Client ID"
        setup_instructions="Create at console.cloud.google.com/apis/credentials"
      />

      <dynamic_field
        id="f5"
        name="google_client_secret"
        type="secret"
        required="true"
        title="Google OAuth Client Secret"
        setup_instructions="From the same OAuth 2.0 Client ID"
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

| Type | Use Case | Required Attributes |
|------|----------|---------------------|
| `string` | Text input | `name`, `title` |
| `secret` | Masked input for sensitive data | `name`, `title`, `setup_instructions` |
| `select` | Dropdown options | `name`, `title`, `options` (comma-separated) |
| `boolean` | Toggle switch | `name`, `title` |
| `number` | Numeric input | `name`, `title` |

**Always include `setup_instructions`** when the user needs to obtain a value from an external service.

---

## Execution Workflow

```
1. Receive task from user
2. Analyze task complexity
   - If simple (single file, obvious fix): execute directly without Overture
   - If complex (multiple files, decisions, config needed): use Overture
3. Generate comprehensive XML plan
4. Call submit_plan (or stream_plan_chunk for incremental display)
5. Call get_approval and handle response:
   - status: "pending" → call get_approval again (user is still reviewing)
   - status: "approved" → proceed with execution
   - status: "cancelled" → stop and inform user
6. Extract from approval response:
   - fieldValues: Map of field names to user-provided values
   - selectedBranches: Map of decision node IDs to chosen branch IDs
   - nodeConfigs: Per-node data including:
     - attachments: Array of file paths user attached
     - metaInstructions: User's specific guidance for this node
7. Execute each node in order:
   a. Skip nodes whose branch wasn't selected
   b. Call update_node_status(node_id, "active")
   c. Execute using fieldValues, attachments, and metaInstructions
   d. Call update_node_status(node_id, "completed", summary)
   e. If error: update_node_status(node_id, "failed", error) and plan_failed(error)
8. Call plan_completed when all nodes succeed
```

---

## Handling User Additions

When `get_approval` returns, check `nodeConfigs` for user customizations:

```json
{
  "nodeConfigs": {
    "n1": {
      "fieldValues": { "api_key": "sk_test_..." },
      "attachments": [
        { "path": "/Users/dev/project/design.figma", "name": "design.figma", "type": "other" },
        { "path": "/Users/dev/project/api-spec.yaml", "name": "api-spec.yaml", "type": "code" }
      ],
      "metaInstructions": "Use the exact colors from the Figma file. Follow the API spec strictly."
    }
  }
}
```

**Attachments**: Read these files and incorporate their content into your work for that node.

**Meta Instructions**: These are specific directives from the user for how to execute this node. Follow them precisely.

---

## Best Practices

1. **Decompose thoroughly**: One action per node. "Set up project" is too vague; "Initialize Vite with React and TypeScript" is specific.

2. **Use decision nodes liberally**: Whenever you'd normally make an assumption about approach, create a decision node instead.

3. **Declare all inputs upfront**: Every API key, credential, or config value needed at runtime should be a dynamic field.

4. **Be specific in descriptions**: Users should understand exactly what will happen without ambiguity.

5. **Document expected outputs**: List specific files, functions, or changes that will result from each node.

6. **Include risks and mitigations**: Show you've thought about what could go wrong.

7. **Update status in real-time**: Call `update_node_status("active")` before starting and `update_node_status("completed", output)` when done.

8. **Honor user additions**: Always check for and follow `metaInstructions`. Always read and use `attachments`.

9. **Stream for long plans**: Use `stream_plan_chunk` for plans with many nodes so users see progress immediately.

---

## The Value Proposition

**Without Overture:**
- User: "Build me an e-commerce site"
- You: Start coding immediately
- 20 minutes later: User realizes you used MongoDB when they wanted PostgreSQL
- Result: Wasted tokens, wasted time, frustrated user

**With Overture:**
- User: "Build me an e-commerce site"
- You: Generate detailed plan with database decision node
- User: Reviews plan, selects PostgreSQL, adds Stripe API key, attaches design file
- You: Execute exactly what they approved with their exact inputs
- Result: Perfect alignment, happy user

---

> "The best time to shape the plan is before the first line of code is written." — Overture by Sixth
