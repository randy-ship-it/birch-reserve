import { defineConfig, InputTransformerFn } from "orval";
import path from "path";

const root = path.resolve(__dirname, "..", "..");
const apiClientReactSrc = path.resolve(root, "lib", "api-client-react", "src");
const apiZodSrc = path.resolve(root, "lib", "api-zod", "src");
const PINNED_UCP_VERSION = "2026-04-08";
const publicRootPaths = new Set([
  "/.well-known/ucp",
  "/ucp/v1/checkout-sessions",
  "/ucp/v1/checkout-sessions/{id}",
  "/ucp/v1/checkout-sessions/{id}/complete",
  "/ucp/v1/checkout-sessions/{id}/cancel",
  "/ucp/v1/checkout-sessions/{id}/identity-rotations",
  "/llms.txt",
  "/v1/catalog.json",
  "/v1/availability.json",
  "/v1/quote",
  "/v1/checkout",
  "/v1/orders/{id}",
  "/v1/orders/{id}/confirm",
  "/v1/orders/{id}/io.json",
  "/v1/placements",
  "/openapi.yaml",
  "/buycalc",
]);

// Our exports make assumptions about the title of the API being "Api" (i.e. generated output is `api.ts`).
const titleTransformer: InputTransformerFn = (config) => {
  if (
    (config as typeof config & { "x-ucp-version"?: unknown })[
      "x-ucp-version"
    ] !== PINNED_UCP_VERSION
  ) {
    throw new Error(
      `OpenAPI x-ucp-version must match the codegen pin ${PINNED_UCP_VERSION}.`,
    );
  }
  config.info ??= {};
  config.info.title = "Api";
  config.paths = Object.fromEntries(
    Object.entries(config.paths ?? {}).map(([route, operations]) => [
      publicRootPaths.has(route) ? route : `/api${route}`,
      operations,
    ]),
  );

  return config;
};

export default defineConfig({
  "api-client-react": {
    input: {
      target: "./openapi.yaml",
      override: {
        transformer: titleTransformer,
      },
    },
    output: {
      workspace: apiClientReactSrc,
      target: "generated",
      client: "react-query",
      mode: "split",
      clean: true,
      prettier: true,
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
        },
        mutator: {
          path: path.resolve(apiClientReactSrc, "custom-fetch.ts"),
          name: "customFetch",
        },
      },
    },
  },
  zod: {
    input: {
      target: "./openapi.yaml",
      override: {
        transformer: titleTransformer,
      },
    },
    output: {
      workspace: apiZodSrc,
      client: "zod",
      target: "generated",
      schemas: { path: "generated/types", type: "typescript" },
      mode: "split",
      clean: true,
      prettier: true,
      override: {
        zod: {
          coerce: {
            query: ['boolean', 'number', 'string'],
            param: ['boolean', 'number', 'string'],
            body: ['bigint', 'date'],
            response: ['bigint', 'date'],
          },
        },
        useDates: true,
        useBigInt: true,
      },
    },
  },
});
