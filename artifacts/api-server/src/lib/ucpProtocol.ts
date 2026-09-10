export const UCP_VERSION = "2026-04-08";
export const UCP_SHOPPING_SERVICE = "dev.ucp.shopping";
export const UCP_CHECKOUT_CAPABILITY = "dev.ucp.shopping.checkout";

export const UCP_OVERVIEW_SPEC_URL =
  "https://ucp.dev/2026-04-08/specification/overview";
export const UCP_CHECKOUT_SPEC_URL =
  "https://ucp.dev/2026-04-08/specification/checkout";
export const UCP_SHOPPING_REST_SCHEMA_URL =
  "https://ucp.dev/2026-04-08/services/shopping/rest.openapi.json";
export const UCP_CHECKOUT_SCHEMA_URL =
  "https://ucp.dev/2026-04-08/schemas/shopping/checkout.json";

export const UCP_AGENT_PROFILE_PATH = "/.well-known/ucp";

export function isUcpRequestId(value: string | undefined): boolean {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}