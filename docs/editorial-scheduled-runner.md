# Editorial scheduled runner

Run `pnpm --filter @workspace/scripts run editorial-runner` from a Replit
Scheduled Deployment. Schedule the command at the desired review cadence with
the same database configuration as the API deployment.

The runner is idempotent (`editorial_generation_jobs.idempotency_key`), refreshes
only the allowlisted public source records in its source file, and creates only
private `draft` articles. It never approves, schedules, or publishes an
article. Publishing remains an authenticated sales-manager action in the API.

Source excerpts, model prompts, commercial records, staff access data, and
unpublished context must not be sent to logs or to the model. The model-input
boundary is `artifacts/api-server/src/lib/editorialDrafting.ts`.