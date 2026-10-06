import { ReplitConnectors } from "@replit/connectors-sdk";

export type SlackProxyOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

export type SlackProxy = (
  path: string,
  options?: SlackProxyOptions,
) => Promise<Response>;

type SlackConnector = {
  proxy: (
    service: string,
    path: string,
    options?: SlackProxyOptions,
  ) => Promise<Response>;
};

/**
 * Replit sets at least one of these. When any is present, splash Slack alerts
 * keep using the Replit connector, including when SLACK_BOT_TOKEN is also set.
 */
export function isReplitRuntime(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(
    env.REPL_ID ||
      env.REPL_IDENTITY ||
      env.WEB_REPL_RENEWAL ||
      env.REPLIT_DEPLOYMENT,
  );
}

/**
 * Default Slack transport for splash reserve alerts.
 * On Replit this is the connector. Off Replit it uses SLACK_BOT_TOKEN and
 * never constructs the connector (that path spawns the Replit CLI).
 */
export async function defaultSlackProxy(
  path: string,
  options?: SlackProxyOptions,
  connectorFactory: () => SlackConnector = () => new ReplitConnectors(),
): Promise<Response> {
  if (isReplitRuntime()) {
    return connectorFactory().proxy("slack", path, options);
  }

  const token = process.env.SLACK_BOT_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "Slack alerts are not configured off Replit. Set SLACK_BOT_TOKEN to deliver them.",
    );
  }

  const slackPath = path.startsWith("/") ? path : `/${path}`;
  return fetch(`https://slack.com/api${slackPath}`, {
    method: options?.method ?? "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...options?.headers,
      Authorization: `Bearer ${token}`,
    },
    body: options?.body,
  });
}
