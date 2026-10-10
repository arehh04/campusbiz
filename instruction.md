# instruction.md — CampusBiz Autopilot
## WorkBuddy-Powered AI Business Operating System

## 1. Mission

Build **CampusBiz Autopilot**, a WorkBuddy-powered AI business operating system that helps students and beginner entrepreneurs transform a business idea into a validated, launch-ready, and manageable micro-business.

The application should help users answer five questions:

1. Is my business idea financially viable?
2. How much do I need to sell to reach my income target?
3. What should I prepare before launching?
4. How can I attract customers and manage orders?
5. What should I do next based on my business performance?

The system combines specialist AI agents, deterministic financial calculations, demand estimation, business artifact generation, and a functional order management interface.

The goal is not to build another chatbot. The goal is to turn a natural-language business goal into a collection of useful business decisions and working tools.

### Core value proposition

**From business idea to operational micro-business in one workflow.**

Example user request:

> I want to sell homemade cookies on campus. I have RM300 starting capital, can produce 40 cookies per day, and want to earn RM800 in monthly profit. Help me determine whether this is feasible and prepare everything I need to launch.

The application should analyse the goal, calculate the financial requirements, identify risks, recommend a launch strategy, generate marketing assets, create an operational checklist, and provide a working order tracker.

---

## 2. Critical Constraints

### 2.1 Mandatory Tencent WorkBuddy integration

Tencent WorkBuddy is the required AI execution platform.

The application MUST use WorkBuddy to perform meaningful AI reasoning, specialist orchestration, or business artifact generation.

The Web UI is the visualization and control layer. It must not pretend that WorkBuddy executed a task when the task was actually handled entirely by local mock functions.

Use WorkBuddy for:
- Business goal interpretation and task decomposition.
- Specialist agent collaboration where supported.
- Business strategy and launch recommendations.
- Demand analysis using explicitly identified data sources.
- Marketing copy and artifact generation.
- Operational planning.
- Consolidating specialist outputs into a consistent business plan.

Use the application backend for:
- Deterministic financial calculations.
- Schema validation and output validation.
- Order creation, updates, and persistence.
- Business state management.
- Feasibility rule evaluation.
- Serving application data to the frontend.
- Safe handling of WorkBuddy credentials and integration errors.

### 2.2 Greenfield project

The repository is initially empty except for this instruction file.

There is no existing application, codebase, or architecture that needs to be preserved.

You must:
- Choose a practical tech stack suitable for a one-day hackathon.
- Initialize the project.
- Install the necessary dependencies.
- Implement the frontend and backend.
- Implement the WorkBuddy integration.
- Build the database and required schema.
- Run and test the application.
- Provide setup and execution instructions.

Do not stop after creating the project structure, writing a plan, or generating placeholder pages.

**The deliverable is a working application, not a scaffold.**

### 2.3 Hackathon time constraint

Prioritize a complete, reliable end-to-end workflow over excessive architecture.

Avoid:
- Microservices.
- Kubernetes.
- Distributed queues unless genuinely necessary.
- Complex authentication systems.
- Unnecessary databases or infrastructure.
- Elaborate agent frameworks that duplicate WorkBuddy's capabilities.
- Integrations that cannot be tested during the hackathon.

### 2.4 Truthful execution

Never fabricate:
- Successful API calls.
- Agent execution logs.
- Generated files.
- Competitor prices.
- Customer demand.
- Historical sales records.
- Grant eligibility or deadlines.
- External verification.

When real integration is unavailable, expose the limitation clearly and provide a labelled fallback workflow.

---

## 3. Architecture

Use the following logical architecture:

```text
                    USER
                      |
                      v
             NEXT.JS WEB APPLICATION
                      |
                      v
              APPLICATION BACKEND
                /      |       \
               /       |        \
              v        v         v
       WORKBUDDY    FINANCE    SQLITE
       INTEGRATION  ENGINE     DATABASE
           |
           v
    WORKBUDDY PLATFORM
           |
           v
      ORCHESTRATOR
           |
    +------+------+------+------+
    |             |             |
    v             v             v
 Finance        Demand        Growth
 Specialist     Specialist    Specialist
    |             |             |
    +-------------+-------------+
                  |
                  v
            Operations
            Specialist
                  |
                  v
        CONSOLIDATED BUSINESS PLAN
                  |
                  v
       VALIDATION AND ARTIFACT STORAGE
                  |
                  v
             NEXT.JS UI
```

This is a logical architecture. Implement the actual integration according to the WorkBuddy capabilities available in the installed environment.

Do not assume every component requires a separate deployed service.

### Recommended technology stack

- **Frontend:** Next.js with TypeScript.
- **Styling:** Tailwind CSS or another lightweight styling approach.
- **Backend:** Next.js Route Handlers for a compact application.
- **Database:** SQLite.
- **Database access:** Prisma or a lightweight SQLite library.
- **Validation:** Zod or equivalent schema validation.
- **Charts:** A lightweight chart library only where useful.
- **WorkBuddy:** Tencent WorkBuddy's supported agent or enterprise API integration.
- **Artifacts:** Local filesystem storage for generated files during development.

If the available runtime or WorkBuddy integration makes another stack materially simpler, choose the simplest reliable alternative and document the decision.

Do not add a separate FastAPI service unless a concrete requirement justifies it.

---

## 4. WorkBuddy Setup and Integration

### 4.1 Integration-first workflow

Before implementing the complete application:

1. Inspect the installed WorkBuddy version and its official documentation.
2. Determine whether the required agent API is available to this account.
3. Identify the correct authentication method.
4. Verify how an agent or Expert Group receives a task.
5. Verify how execution status and results are retrieved.
6. Determine whether generated files can be downloaded or accessed through the API.
7. Perform a small real integration test.
8. Only then implement the integration layer used by the application.

The following endpoint is a proposed integration target, not an assumed fact:

`POST /v1/agents/{agentId}/sessions`

Verify the actual endpoint, request body, authentication scheme, and response format against current official documentation or a successful API test before using it.

Do not invent endpoints, SDK methods, response fields, or authentication headers.

### 4.2 WorkBuddy environment configuration

Provide an `.env.example` containing the required variables.

Example:

```dotenv
DATABASE_URL="file:./dev.db"

WORKBUDDY_API_BASE_URL=""
WORKBUDDY_API_KEY=""
WORKBUDDY_AGENT_ID=""
WORKBUDDY_TIMEOUT_MS="120000"

ARTIFACT_STORAGE_DIR="./storage/artifacts"
```

Adjust the variables to match the verified WorkBuddy API.

Rules:
- Never hard-code credentials.
- Never expose credentials to browser-side code.
- Never commit `.env`.
- Add `.env` to `.gitignore`.
- Never log full API keys or authorization headers.
- Validate required configuration at application startup or before invoking WorkBuddy.
- Display an actionable setup error when credentials or agent configuration are missing.

Do not assume a custom model endpoint is interchangeable with WorkBuddy's agent API. A model API and an agent orchestration API may be separate interfaces.

### 4.3 WorkBuddy setup instructions

If the hackathon environment requires manual setup, document these steps in the README:

1. Install Tencent WorkBuddy using its official distribution.
2. Configure a supported model through the available settings.
3. Confirm that the selected model is accessible.
4. Configure the Expert Group or agents using the features available in the installed version.
5. Create or obtain the necessary API credentials through the authorized enterprise console if required.
6. Configure any required Skills.
7. Configure environment variables in the application.
8. Run the integration smoke test.
9. Run the application.

A model endpoint such as the following may be used only if it is currently supported and the user has valid credentials:

`https://tokenhub-intl.tencentcloudmaas.com/v1/chat/completions`

Do not assume the model identifier `deepseek-v4-pro` or any other model identifier is currently available. Verify the model catalogue and endpoint configuration.

### 4.4 Integration adapter

Create a dedicated WorkBuddy integration module.

Suggested responsibilities:

- `checkConfiguration()`
- `checkConnectivity()`
- `submitBusinessGoal()`
- `getExecutionStatus()`
- `getExecutionResult()`
- `retrieveGeneratedArtifacts()`

These are conceptual responsibilities, not prescribed API method names.

The adapter should:
- Encapsulate all external API calls.
- Apply timeouts.
- Handle HTTP and authentication errors.
- Handle incomplete or malformed responses.
- Avoid duplicate task submissions during retries.
- Return typed application-level results.
- Preserve the distinction between pending, completed, failed, and unavailable executions.

The rest of the application should not depend directly on undocumented WorkBuddy response structures.

### 4.5 Integration fallback

If the verified API is unavailable or access has not been granted:

- Keep the application functional.
- Allow the user to copy the business goal and submit it through WorkBuddy manually.
- Allow the user to paste or import the resulting structured analysis.
- Label the workflow `MANUAL WORKBUDDY EXECUTION`.
- Do not display fabricated live agent activity.
- Do not mark WorkBuddy tasks as completed until completion is confirmed.

This fallback is for development resilience, not a replacement for mandatory WorkBuddy integration.

---

## 5. WorkBuddy Expert Group

Configure the following specialist roles when the available WorkBuddy version supports them.

Start with the minimum working orchestration workflow. Add the remaining specialists only after the end-to-end integration succeeds.

### 5.1 Main Orchestrator

**Role:** Business workflow coordinator.

System prompt:

"You are the CampusBiz Autopilot Orchestrator. Convert the user's business goal into a structured business execution plan. Identify missing information, delegate relevant tasks to available specialist experts, consolidate their results, identify contradictions, and return a structured response. Do not invent financial calculations, external facts, completed actions, or unavailable data. Clearly identify assumptions, estimates, simulations, and unresolved risks."

Responsibilities:
- Interpret the user's business goal.
- Extract budget, income target, costs, capacity, and timeline.
- Identify missing critical information.
- Coordinate specialist tasks.
- Consolidate results.
- Detect contradictory recommendations.
- Request clarification when a critical missing fact prevents meaningful analysis.
- Produce a unified execution plan.

### 5.2 Finance Specialist

**Role:** Financial planning and feasibility.

System prompt:

"You are the CampusBiz Finance Specialist. Assess the financial viability of a small business. Use the deterministic calculation engine for all arithmetic. Never invent financial results or override the calculator's numerical outputs. Identify assumptions, missing cost information, break-even requirements, capital constraints, and financial risks."

Responsibilities:
- Review startup capital.
- Identify unit costs and selling prices.
- Calculate unit contribution.
- Calculate required sales volume.
- Calculate break-even.
- Estimate monthly profit using verified calculation outputs.
- Identify working-capital risks.
- Explain financial feasibility in plain language.

Important: If WorkBuddy Skills cannot call the application's calculator directly, return the required calculation inputs in a structured schema. The application backend must perform the arithmetic.

### 5.3 Demand Specialist

**Role:** Demand estimation and market analysis.

System prompt:

"You are the CampusBiz Demand Specialist. Estimate potential customer demand only from available evidence, supplied assumptions, or clearly labelled simulated scenarios. Never present simulated demand as actual customer behaviour. Explain the basis, uncertainty, and limitations of every estimate."

Responsibilities:
- Identify target customer segments.
- Identify customer problems and purchase motivations.
- Suggest practical campus research.
- Estimate demand ranges when enough assumptions are available.
- Analyse supplied sales history.
- Simulate scenarios when actual evidence is absent.
- Identify demand risks.

No unsupported claims about real competitors, customer counts, campus events, or weather.

### 5.4 Growth Specialist

**Role:** Launch and marketing asset generation.

System prompt:

"You are the CampusBiz Growth Specialist. Generate practical, launch-ready marketing materials and business assets. Prefer complete artifacts over advice about creating artifacts. Use only supplied or clearly labelled assumed business information. Never claim that a page was published or a message was sent unless the corresponding action was actually executed and verified."

Responsibilities:
- Business positioning.
- Value proposition.
- Product descriptions.
- Marketing copy.
- Landing page content.
- Launch campaign.
- Social media captions.
- Promotional ideas.
- QR-code destination planning.
- Customer acquisition experiments.

Where file-generation capabilities are available, generate actual files. Otherwise, return complete content that the application can safely render or convert into files.

### 5.5 Operations Specialist

**Role:** Daily business operations.

System prompt:

"You are the CampusBiz Operations Specialist. Convert the business plan into an operational routine. Never recommend production beyond the user's stated capacity. Distinguish confirmed orders from forecast demand. Recommend preparation quantities based on actual orders, available inventory, and clearly labelled forecasts."

Responsibilities:
- Daily preparation plan.
- Production quantities.
- Inventory checklist.
- Order fulfilment.
- Packaging requirements.
- Waste reduction.
- Capacity planning.
- Daily closing routine.
- Operational risk identification.

### 5.6 Optional Funding and Compliance Specialist

Add this specialist only if the core application is complete.

Responsibilities:
- Identify categories of grants or support worth researching.
- Identify potential licensing, food-handling, or other relevant requirements.
- Produce a verification checklist.
- Record source URLs and verification dates when authoritative external sources are actually accessed.

Never invent funding programmes, eligibility, deadlines, approval status, or legal conclusions.

If information has not been verified, label it `UNVERIFIED — REQUIRES CHECKING`.

---

## 6. End-to-End User Journey

### Step 1: Business goal input

The user submits a natural-language goal.

Example:

"I want to sell homemade cookies on campus. I have RM300 starting capital, can make 40 cookies per day, and want RM800 monthly profit."

The interface should also allow the user to provide:

- Business idea.
- Product or service.
- Starting capital.
- Selling price.
- Estimated variable cost per unit.
- Monthly fixed costs.
- Target monthly profit.
- Production capacity per day.
- Operating days per month.
- Available business hours.
- Target customers.
- Launch date.

Allow users to submit a partial goal. Ask follow-up questions only when missing information prevents a meaningful result.

### Step 2: Goal interpretation

Extract the goal into structured fields.

For example:

```json
{
  "businessType": "homemade cookies",
  "startingCapital": 300,
  "currency": "MYR",
  "targetMonthlyProfit": 800,
  "dailyProductionCapacity": 40,
  "operatingDaysPerMonth": 22
}
```

This is an example of the intended data structure, not a fixed set of values.

Do not silently treat unspecified prices, costs, or operating days as confirmed facts.

### Step 3: WorkBuddy execution

Submit the goal to WorkBuddy through the verified integration.

The orchestration workflow should request:
- Financial analysis inputs and assumptions.
- Demand analysis.
- Launch strategy.
- Operations plan.
- A consolidated business recommendation.

Display actual execution status when the integration exposes it.

Possible statuses:
- `QUEUED`
- `RUNNING`
- `COMPLETED`
- `FAILED`
- `MANUAL_REQUIRED`

Only show specialist-level progress if it comes from actual platform execution events or results. Otherwise, display a truthful high-level application status.

### Step 4: Deterministic financial calculation

Pass validated inputs to the backend calculator.

The calculator produces:
- Unit contribution.
- Break-even quantity.
- Required monthly sales.
- Required daily sales.
- Estimated monthly revenue.
- Estimated variable costs.
- Estimated fixed costs.
- Estimated monthly operating profit.
- Capital requirement.
- Capacity assessment.

### Step 5: Feasibility evaluation

The application combines deterministic financial results, stated production capacity, and the demand evidence available.

Possible statuses:
- `FEASIBLE`
- `AT_RISK`
- `NOT_FEASIBLE`
- `INSUFFICIENT_DATA`

Display the reasons supporting the result.

### Step 6: Generate business assets

Generate and display:
- Business launch plan.
- Landing page.
- Order form.
- Marketing kit.
- Operations checklist.
- Daily preparation plan.

### Step 7: Manage orders

The user can place a sample order through the order form.

The backend stores the order in SQLite. The tracker reflects the stored order.

### Step 8: Review and improve

Display practical next steps based on the business plan and order records.

Examples:
- Adjust the selling price.
- Reduce unit cost.
- Increase sales conversion.
- Reduce waste.
- Review product demand.
- Adjust production quantities.

Recommendations must be based on actual inputs or labelled assumptions.

---

## 7. Deterministic Finance Engine

The finance engine is a core business rule component. Implement it in application code, not as free-form LLM arithmetic.

### 7.1 Required inputs

- Selling price per unit.
- Variable cost per unit.
- Monthly fixed operating costs.
- Target monthly operating profit.
- Starting capital.
- Operating days per month.
- Maximum units producible per day.
- Optional initial setup expenses.

All financial values should use a consistent currency and appropriate decimal arithmetic. Avoid binary floating-point errors in monetary calculations; use integer sen units or a decimal arithmetic library.

### 7.2 Unit contribution

`Unit contribution = Selling price − Variable cost per unit`

If contribution is zero or negative, the system must not calculate a misleading positive sales target.

Instead:
- Mark the current pricing model as financially invalid.
- Explain that the business does not cover variable costs.
- Recommend reviewing price, ingredients, sourcing, or production costs.

### 7.3 Break-even quantity

`Break-even units = ceil(Monthly fixed costs / Unit contribution)`

If fixed costs are zero, break-even for fixed operating expenses is zero units, although variable costs still need to be covered.

### 7.4 Required sales for target profit

`Required monthly units = ceil((Target monthly profit + Monthly fixed costs) / Unit contribution)`

This formula is valid only when unit contribution is positive and the stated costs are complete enough for the estimate.

### 7.5 Required daily sales

`Required daily units = ceil(Required monthly units / Operating days per month)`

Validate that operating days are positive.

### 7.6 Monthly financial projection

Calculate:

- `Revenue = Units sold × Selling price`
- `Variable costs = Units sold × Variable cost per unit`
- `Operating profit = Revenue − Variable costs − Fixed costs`

Clearly state whether the projection excludes taxes, owner compensation, delivery costs, wastage, transaction fees, or other expenses.

Do not label operating profit as take-home income.

### 7.7 Capacity assessment

`Monthly production capacity = Daily capacity × Operating days per month`

Compare required sales with production capacity.

If required units exceed capacity, the business is not feasible under the current production assumptions.

Do not suggest selling more units than can be produced unless the plan explicitly includes a realistic capacity change.

### 7.8 Startup capital assessment

Calculate initial funding needs from supplied setup expenses, required purchases, and other known launch costs.

Compare the funding requirement against starting capital.

If cost inputs are missing, mark the assessment as incomplete rather than assuming all required materials are already available.

### 7.9 Feasibility rules

Use the following decision framework:

**FEASIBLE**
- Unit contribution is positive.
- Required sales fit within stated production capacity.
- Known startup requirements fit within available capital.
- Available demand evidence is consistent with the sales target, or demand risk is explicitly acceptable.

**AT_RISK**
- The financial model is viable, but demand is uncertain.
- Capital is tight.
- The sales target requires strong conversion.
- Important cost assumptions remain unverified.
- Operational capacity is close to its limit.

**NOT_FEASIBLE**
- Unit contribution is zero or negative.
- Required sales exceed stated capacity.
- Known startup requirements exceed available capital and no viable funding path is established.

**INSUFFICIENT_DATA**
- Critical information is missing and a responsible assessment cannot yet be made.

These statuses must be computed by backend rules, not chosen arbitrarily by an LLM.

The WorkBuddy Finance Specialist may explain the result but must not override the calculator or feasibility engine.

---

## 8. Demand Analysis

Demand analysis must be useful without pretending that simulated information is real market research.

### Data categories

1. `USER_PROVIDED`: information supplied by the user.
2. `HISTORICAL`: actual sales records provided by the user.
3. `ESTIMATED`: forecasts derived from stated assumptions or available evidence.
4. `SIMULATED`: hypothetical scenarios created for planning.
5. `VERIFIED`: external facts actually checked against reliable sources.

### Demand scenarios

Where appropriate, generate:
- Conservative scenario.
- Expected scenario.
- Optimistic scenario.

Explain the assumptions behind each scenario.

For example, a hypothetical cookie business may use illustrative daily customer counts to show the implications of different sales levels. These counts must be labelled `SIMULATED` unless supported by real records or verified research.

Do not use a simulated scenario as proof that the business will reach its sales target.

### Optional demand simulator

A lightweight simulator may evaluate:
- Potential customers reached.
- Assumed conversion rate.
- Expected units per customer.
- Available production capacity.

For example:

`Estimated orders = People reached × Assumed conversion rate`

Clearly label the result as an estimate or simulation.

Never invent live campus events, weather data, sales histories, or competitor prices.

---

## 9. Artifact Generation

The application should produce usable business deliverables rather than merely describing them.

### 9.1 Landing page

Generate a complete landing page containing:
- Business name.
- Product description.
- Value proposition.
- Product or package options.
- Prices based on supplied information.
- Call to action.
- Contact or ordering instructions.

Use a safe rendering approach.

Do not execute arbitrary code returned by an LLM. Prefer structured content, validated templates, and controlled rendering.

The landing page may be previewed inside the application or saved as a standalone HTML file.

Do not claim it is publicly deployed unless deployment has actually succeeded.

### 9.2 Order form

Create a functional order form containing:
- Customer name.
- Contact information, if necessary.
- Product selection.
- Quantity.
- Collection or delivery option.
- Requested collection date or time.
- Optional notes.

Validate required fields and quantities.

Calculate the order subtotal in backend code.

The form must create a real SQLite record.

Do not implement online payment processing unless specifically required and safely configured.

### 9.3 Order tracker

Display orders stored in SQLite.

Suggested columns:
- Order ID.
- Customer.
- Product.
- Quantity.
- Total.
- Order date.
- Fulfilment status.

Suggested statuses:
- `PENDING`
- `CONFIRMED`
- `PREPARING`
- `READY`
- `COMPLETED`
- `CANCELLED`

Allow authorized application users to update statuses.

The tracker must read from the database, not a hard-coded demo array.

### 9.4 Marketing kit

Generate practical marketing materials such as:
- Business description.
- Three social media captions.
- One launch announcement.
- One promotional offer.
- A seven-day marketing calendar.
- Suggested target audience.
- Call-to-action text.

Save the kit as downloadable Markdown, text, or HTML files where practical.

### 9.5 QR code

Generate a QR code for an actual valid destination, such as the local application URL or a deployed landing page.

Do not generate a QR code pointing to an invented URL.

Clearly explain when a locally hosted destination will only work on the local machine or network.

### 9.6 Operations checklist

Generate a practical checklist covering:
- Preparation.
- Inventory.
- Production.
- Packaging.
- Order confirmation.
- Collection or delivery.
- End-of-day reconciliation.

Respect stated capacity and confirmed orders.

### 9.7 Artifact storage

Each artifact should have:
- Unique identifier.
- Business identifier or session identifier.
- Artifact type.
- Display title.
- Creation timestamp.
- Storage location or content reference.
- Generation status.
- Relevant provenance labels.

Validate file paths and prevent arbitrary file access.

Do not expose internal filesystem paths to the browser.

---

## 10. Database Design

Use SQLite for a simple, reliable local MVP.

Suggested tables:

### businesses

- `id`
- `name`
- `business_type`
- `description`
- `currency`
- `created_at`
- `updated_at`

### business_plans

- `id`
- `business_id`
- `goal_input`
- `assumptions_json`
- `financial_results_json`
- `feasibility_status`
- `analysis_status`
- `created_at`

### orders

- `id`
- `business_id`
- `customer_name`
- `customer_contact`
- `items_json` or normalized order-item records
- `quantity`
- `subtotal`
- `fulfilment_option`
- `requested_datetime`
- `status`
- `notes`
- `created_at`
- `updated_at`

### artifacts

- `id`
- `business_id`
- `plan_id`
- `artifact_type`
- `title`
- `content`
- `file_path`
- `generation_status`
- `provenance_json`
- `created_at`

### agent_runs

- `id`
- `plan_id`
- `provider`
- `execution_status`
- `external_session_id`
- `started_at`
- `completed_at`
- `error_summary`

Do not persist secrets, authorization headers, or unnecessary personal information.

Use database migrations or a reliable initialization mechanism. Ensure the schema can be created on a clean checkout.

If the final implementation uses a simpler schema, document the changes and preserve all required functionality.

---

## 11. Application API

Use server-side endpoints for business operations and external integration.

Suggested endpoints:

### Business analysis

`POST /api/analyze`

Accepts a business goal and available structured inputs.

Responsibilities:
- Validate input.
- Create or update the business plan.
- Submit a real WorkBuddy task using the verified integration.
- Calculate deterministic financial results.
- Validate and consolidate returned results.
- Return execution status and available results.

For long-running executions, return a job or run identifier and allow the frontend to poll the application backend.

Do not keep a browser request open indefinitely while WorkBuddy runs.

### Execution status

`GET /api/analysis/:id`

Returns the actual status and results of a business analysis.

If a webhook is supported and properly verified, it may be used instead of polling.

### Orders

`POST /api/orders`

Creates an order after server-side validation.

`GET /api/orders`

Lists stored orders.

`PATCH /api/orders/:id`

Updates permitted order fields or fulfilment status.

Validate state transitions and prevent invalid updates.

### Artifacts

`GET /api/artifacts`

Lists artifacts associated with the selected business or plan.

`GET /api/artifacts/:id`

Returns a permitted artifact.

`GET /api/artifacts/:id/download`

Downloads a generated file if one exists.

Implement only routes actually required by the frontend. Keep the interface small and coherent.

---

## 12. Frontend and User Experience

Build a polished, functional business dashboard.

### Required screens

**A. Dashboard**
- Current business or business plan.
- Latest feasibility status.
- Revenue and profit projections.
- Required daily sales.
- Recent orders.
- Recommended next actions.

**B. Business analysis**
- Business goal input.
- Structured assumptions.
- WorkBuddy execution status.
- Financial results.
- Feasibility explanation.
- Demand scenarios.
- Risks and next steps.

**C. Launch studio**
- Landing page preview.
- Marketing kit.
- Operations checklist.
- Downloadable artifacts.
- QR code when available.

**D. Order management**
- Functional order form.
- Order tracker.
- Status updates.
- Basic order summary.

### Design principles

- Clean, modern, professional dashboard.
- Responsive layout.
- Clear hierarchy and readable numbers.
- Minimal navigation.
- Useful loading, empty, success, and error states.
- No fake progress animations suggesting actual agent execution.
- No excessive decorative components.
- No dead buttons.
- No placeholder charts presented as real data.

Use a consistent design system. Prioritize functional clarity over elaborate animations.

---

## 13. Trust and Transparency Labels

Every important result must make its origin clear.

Use these exact labels where appropriate:

- `[USER_INPUT]` — Facts explicitly provided by the user.
- `[CALCULATED]` — Results produced by deterministic application code.
- `[ESTIMATED]` — Forecasts derived from assumptions or evidence.
- `[SIMULATED]` — Hypothetical data or scenario outputs.
- `[GENERATED]` — Content or files created by WorkBuddy or the application.
- `[VERIFIED]` — External information checked against a reliable source.
- `[UNVERIFIED]` — Information that still requires confirmation.

Do not apply `[VERIFIED]` to model-generated claims simply because an LLM stated them.

Do not imply that generated marketing copy is externally validated.

Maintain provenance information for significant financial inputs and recommendations.

### Example

`[CALCULATED] Required monthly sales: 250 units`

`[SIMULATED] Expected daily demand: 12–20 units, based on an illustrative conversion scenario`

`[GENERATED] Seven-day launch marketing kit`

The numbers above are illustrative examples of labels, not actual recommendations for the user's business.

---

## 14. Safety and Execution Boundaries

Require explicit confirmation before performing actions that:
- Send messages externally.
- Publish a page.
- Submit applications.
- Spend money.
- Share personal or business data with another service.
- Make an irreversible change.

For the MVP:
- Generate WhatsApp or email copy, but do not send it automatically.
- Generate landing pages, but do not publish them automatically.
- Generate funding checklists, but do not submit applications.
- Generate QR codes, but do not claim external deployment.
- Store only the information required for the business workflow.

Treat external model responses as untrusted input.

Validate all structured data before saving it or rendering it in the UI.

Prevent injection through generated HTML, SQL, file paths, and browser-rendered content.

---

## 15. P0 — Mandatory MVP Features

These features define the minimum acceptable submission.

- [ ] Greenfield application initialized and runnable.
- [ ] WorkBuddy integration verified against the available API.
- [ ] Application can submit a real business goal to WorkBuddy.
- [ ] Application can retrieve the result or truthfully display execution failure.
- [ ] Main orchestration workflow produces a structured business plan.
- [ ] Deterministic finance engine implemented in application code.
- [ ] Backend computes feasibility status from explicit rules.
- [ ] Dashboard displays financial results and supporting explanations.
- [ ] Landing page artifact generated and previewable.
- [ ] Functional order form.
- [ ] Orders persist in SQLite.
- [ ] Order tracker reads from SQLite.
- [ ] Marketing kit generated as usable content or downloadable files.
- [ ] Operations checklist respects stated production capacity.
- [ ] Loading, error, and missing-configuration states implemented.
- [ ] Environment variables and credentials handled securely.
- [ ] Setup and run instructions provided.
- [ ] Core workflow tested from a clean database.

WorkBuddy Expert Group configuration is a mandatory platform objective. If the installed platform supports it, configure the orchestrator and specialists directly. If the account or API cannot support a requested capability, document the exact limitation rather than simulating successful configuration.

---

## 16. P1 — Additional Features

Implement these only after all P0 features work.

- [ ] QR code generation.
- [ ] CSV export for orders.
- [ ] Conservative, expected, and optimistic demand scenarios.
- [ ] Sales history analysis based on actual imported data.
- [ ] Funding and compliance verification checklist.
- [ ] Daily preparation recommendations based on orders.
- [ ] Editable business assumptions with recalculation.
- [ ] Additional specialist-level execution visibility when supported by WorkBuddy.
- [ ] Improved artifact previews and downloads.

---

## 17. Out of Scope

Do not prioritize these during the one-day hackathon:

- Real payment gateway.
- Automated WhatsApp messaging.
- Full POS integration.
- Multi-tenant enterprise account management.
- Complex forecasting models requiring extensive datasets.
- Live crawling of grants and campus events.
- Automatic grant applications.
- Automatic public website deployment.
- Kubernetes or microservices.
- Production-grade distributed job orchestration.
- QQ Bot integration unless all mandatory features are already complete.

Mobile control through QQ Bot may be demonstrated as an optional extension if a working connector already exists and can be tested reliably.

Do not sacrifice the core workflow to implement it.

---

## 18. Demo Scenario

Use the following scenario for a consistent demonstration.

### Business idea

Homemade cookies sold to university students.

### Example inputs

- Starting capital: RM300.
- Target monthly operating profit: RM800.
- Selling price per cookie: RM5.
- Variable cost per cookie: RM2.
- Fixed monthly operating costs: RM100.
- Production capacity: 40 cookies per day.
- Operating days: 22 days per month.

Treat these as illustrative demo inputs, not claims about actual market conditions.

### Expected deterministic calculation

Unit contribution:

`RM5 − RM2 = RM3`

Required monthly units:

`ceil((RM800 + RM100) / RM3) = 300 cookies`

Required daily sales:

`ceil(300 / 22) = 14 cookies per day`

Monthly revenue at 300 cookies:

`300 × RM5 = RM1,500`

Monthly variable costs:

`300 × RM2 = RM600`

Monthly operating profit before excluded expenses:

`RM1,500 − RM600 − RM100 = RM800`

Monthly production capacity:

`40 × 22 = 880 cookies`

The required 300 cookies fit within the stated production capacity.

However, the system must not automatically declare the business fully feasible solely because the financial calculation works. It must also consider whether RM300 covers initial setup requirements and whether sufficient customer demand is supported by evidence.

If those facts are unknown, explain the limitation or mark the assessment `AT_RISK` or `INSUFFICIENT_DATA` as appropriate.

### Demo sequence

1. Open the CampusBiz Autopilot dashboard.
2. Submit the cookie business goal.
3. Show the actual WorkBuddy task execution or clearly labelled manual workflow.
4. Display the structured business plan.
5. Show deterministic calculations and feasibility reasoning.
6. Display the generated landing page.
7. Open the marketing kit and operations checklist.
8. Place a sample order through the order form.
9. Show the order appearing in the SQLite-backed tracker.
10. Update the order status.
11. Show how the operational plan respects production capacity.

Every displayed result must correspond to actual application logic, real WorkBuddy output, or explicitly labelled sample data.

---

## 19. Testing and Acceptance Criteria

Do not consider the application complete until the following checks pass.

### WorkBuddy integration
- Missing credentials produce a clear error.
- Invalid credentials are handled safely.
- A successful request can return a real result.
- Failed and timed-out executions are represented accurately.
- Results are validated before being used.
- No fake agent execution logs appear.

### Finance
- Positive unit contribution produces correct results.
- Zero or negative contribution produces a meaningful warning.
- Zero operating days are rejected.
- Break-even and required sales calculations are correct.
- Capacity constraints affect feasibility.
- Missing cost inputs are identified.
- Monetary rounding is consistent.

### Orders
- A valid order can be created.
- An invalid order is rejected.
- Orders persist after application restart.
- The tracker displays actual database records.
- Status updates are persisted.
- The order subtotal is calculated server-side.

### Artifacts
- Generated content can be previewed.
- Download links point to actual files or valid content endpoints.
- Invalid artifact identifiers are rejected.
- Generated content is rendered safely.
- The application never claims a missing file exists.

### Frontend and deployment
- Application starts from the documented instructions.
- Database initialization works on a clean checkout.
- Core screens work on desktop and mobile-sized viewports.
- No critical buttons are nonfunctional.
- Errors are understandable.
- No secrets are exposed in frontend bundles or logs.

Run the relevant automated tests and manually execute the full demo scenario.

Fix critical failures before spending time on optional features.

---

## 20. Implementation Workflow

Follow this order.

### Phase 1: Reconnaissance and verification
1. Inspect the repository.
2. Confirm the repository contains only the initial instruction file.
3. Inspect the available runtime and package managers.
4. Verify the available WorkBuddy integration and credentials.
5. Run a minimal integration test.
6. Choose the smallest suitable architecture.

### Phase 2: Core foundation
1. Initialize the project.
2. Create the environment configuration.
3. Configure database initialization and schema.
4. Implement input validation.
5. Implement the deterministic finance engine.
6. Add unit tests for financial calculations.

### Phase 3: WorkBuddy
1. Implement the integration adapter.
2. Submit a real business goal.
3. Retrieve the result.
4. Validate and normalize the output.
5. Persist execution status.
6. Handle errors and timeouts.
7. Implement a truthful manual fallback if necessary.

### Phase 4: Business workflow
1. Implement business goal submission.
2. Implement feasibility evaluation.
3. Implement business plan persistence.
4. Implement artifact generation and storage.
5. Implement the order form and tracker.
6. Implement operational recommendations.

### Phase 5: Frontend
1. Build the dashboard.
2. Build the business analysis page.
3. Build the launch studio.
4. Build the order management interface.
5. Add loading and error states.
6. Verify responsive behaviour.

### Phase 6: Verification
1. Run database initialization.
2. Run automated tests.
3. Run the complete demo scenario.
4. Confirm the WorkBuddy integration behaves as documented.
5. Fix the highest-impact defects.
6. Update README with setup instructions and known limitations.

Do not spend the entire hackathon on planning or agent prompt engineering. Establish a working vertical slice as early as possible.

---

## 21. Final Deliverables

The repository must contain:

- Complete application source code.
- Frontend and backend implementation.
- Database schema and initialization or migration mechanism.
- WorkBuddy integration adapter.
- Deterministic finance engine.
- Functional order management.
- Generated artifact workflow.
- Automated tests for critical logic.
- `.env.example`.
- `.gitignore`.
- README with installation and run instructions.
- WorkBuddy setup and integration instructions.
- Clear documentation of verified capabilities and known limitations.

At completion, report:

1. What was implemented.
2. Which WorkBuddy capabilities were actually verified.
3. How to configure and run the application.
4. How to execute the demo.
5. Which tests passed.
6. Which features remain incomplete.
7. Any manual configuration required.

Never report an untested feature as complete.

---

## 22. Definition of Success

CampusBiz Autopilot succeeds when a judge can enter a business goal, observe genuine WorkBuddy-powered analysis, understand the deterministic financial assessment, view useful generated business assets, place an order, and see that order persisted in the tracker.

The experience should demonstrate one coherent business lifecycle:

**UNDERSTAND → VALIDATE → ENABLE → LAUNCH → OPERATE → OPTIMIZE**

The system must be useful, transparent, and operational—not merely an attractive interface around generated text.

**Build the smallest complete WorkBuddy-powered product first. Verify every important integration. Prefer working functionality over architectural complexity.**
