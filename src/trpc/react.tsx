"use client";

import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { httpBatchLink, httpBatchStreamLink, loggerLink, wsLink, createWSClient, splitLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { type inferRouterInputs, type inferRouterOutputs } from "@trpc/server";
import { useState } from "react";
import SuperJSON from "superjson";

import { type AppRouter } from "~/server/api/root";
import { createQueryClient } from "./query-client";

let clientQueryClientSingleton: QueryClient | undefined = undefined;
const getQueryClient = () => {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return createQueryClient();
  }
  // Browser: use singleton pattern to keep the same query client
  clientQueryClientSingleton ??= createQueryClient();

  return clientQueryClientSingleton;
};

export const api = createTRPCReact<AppRouter>();

/**
 * Inference helper for inputs.
 *
 * @example type HelloInput = RouterInputs['example']['hello']
 */
export type RouterInputs = inferRouterInputs<AppRouter>;

/**
 * Inference helper for outputs.
 *
 * @example type HelloOutput = RouterOutputs['example']['hello']
 */
export type RouterOutputs = inferRouterOutputs<AppRouter>;

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  // const [trpcClient] = useState(() => {
  //   const httpLink = httpBatchStreamLink({
  //     transformer: SuperJSON,
  //     url: getBaseUrl() + "/api/trpc",
  //     headers: () => {
  //       const headers = new Headers();
  //       headers.set("x-trpc-source", "nextjs-react");
  //       return headers;
  //     },
  //   });

  const [trpcClient] = useState(() => {
    const wsClient = typeof window !== "undefined"
      ? createWSClient({ url: "ws://localhost:3001" })
      : null;

      return api.createClient({
        links: [
          loggerLink({
            enabled: (op) =>
              process.env.NODE_ENV === "development" ||
            (op.direction === "down" && op.result instanceof Error),
        }),
        typeof window !== "undefined" && wsClient
          ? splitLink({
            condition: (op) => op.type === "subscription" || op.type === "mutation",
            true: wsLink({ 
              client: wsClient, 
              transformer: SuperJSON 
            }),
            false: httpBatchStreamLink({
              transformer: SuperJSON,
              url: getBaseUrl() + "/api/trpc",
              headers: () => {
                const headers = new Headers();
                headers.set("x-trpc-source", "nextjs-react");
                return headers;
              },
            }),
          })
          : httpBatchStreamLink({
            transformer: SuperJSON,
            url: getBaseUrl() + "/api/trpc",
            headers: () => {
              const headers = new Headers();
              headers.set("x-trpc-source", "nextjs-react");
              return headers;
            },
          }),
      ],
    });
  });

  //   let endingLink;

  //   if (typeof window === "undefined") {
  //     endingLink = httpLink;
  //   } else {
  //     const wsClient = createWSClient({
  //       url: process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001",
  //     });

  //     endingLink = splitLink({
  //       condition(op) {
  //         return op.type === "subscription";
  //       },
  //       true: wsLink({
  //         client: wsClient,
  //         transformer: SuperJSON,
  //       }),
  //       false: httpLink,
  //     });
  //   }

  //   return api.createClient({
  //     links: [
  //       loggerLink({
  //         enabled: (op) =>
  //           process.env.NODE_ENV === "development" ||
  //           (op.direction === "down" && op.result instanceof Error),
  //       }),
  //       endingLink,
  //     ],
  //   });
  // });

  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {props.children}
      </api.Provider>
    </QueryClientProvider>
  );
}

function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}
