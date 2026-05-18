import type { AlgorandClient } from "@algorandfoundation/algokit-utils/algorand-client";
import type { Address } from "@algorandfoundation/algokit-utils";
import type { SendingAddress } from "@algorandfoundation/algokit-utils/transact";
import type {
  AppClientParams,
  AppClient,
  CallParams,
} from "@algorandfoundation/algokit-utils/app-client";
import type {
  SendParams,
  SendTransactionComposerResults,
} from "@algorandfoundation/algokit-utils/transaction";
import { PageConfig, PageSet, validatePages } from "./schema-validation";
import {
  VirtualSelfUpdatingAppFactory,
  VirtualSelfUpdatingAppClient,
} from "../contracts/clients/VirtualSelfUpdatingAppClient.ts";
import { microAlgo } from "@algorandfoundation/algokit-utils";
import { getABIMethod } from "@algorandfoundation/algokit-utils/abi";
import { buildSwapTransaction } from "./page-swap-transaction-builder";

/**
 * Extracts the primary method name from a page's ARC56 spec.
 * The primary method is the first method that is not updateApplication or setPage.
 */
function getPrimaryMethodName(spec: PageConfig["spec"]): string | undefined {
  if (!spec.methods) return undefined;
  return spec.methods.find(
    (m) => m.name !== "updateApplication" && m.name !== "setPage",
  )?.name;
}

/**
 * Extracts arguments and return type from a page's ARC56 spec for a given method.
 * Returns the full method signature and return type information.
 */
function extractMethodInfo(spec: PageConfig["spec"], methodName: string) {
  const method = spec.methods?.find((m) => m.name === methodName);
  if (!method) return undefined;

  const args = method.args.map((arg) => `${arg.type}`).join(",");
  const signature = `${method.name}(${args})${method.returns.type}`;

  return {
    signature,
    args,
    returns: method.returns.type,
    method,
  };
}

/**
 * Type that extracts method signatures from a page client class.
 * Maps method names to their call parameters and return types.
 */
type ExtractPageMethods<TClient> = TClient extends AppClient
  ? TClient["send"] extends infer TSend
    ? {
        [K in keyof TSend]: TSend[K] extends (...args: infer P) => infer R
          ? (...args: P) => R
          : never;
      }
    : never
  : never;

/**
 * Type for send method parameters - combines the underlying client's params with SendParams.
 */
type SendMethodParams<TClient extends AppClient> = Parameters<
  TClient["send"][keyof TClient["send"]]
>[0] &
  SendParams;

/**
 * Type for send method return value.
 */
type SendMethodReturn<TClient extends AppClient> =
  SendTransactionComposerResults & { return: unknown };

/**
 * Build the SendMethods type for a PageSet.
 * Maps each page key to its client's send methods with proper typing.
 */
type SendMethods<TPages extends PageSet> = {
  [K in keyof TPages]: TPages[K] extends PageConfig
    ? TPages[K]["Client"] extends new (params: AppClientParams) => infer TClient
      ? TClient extends AppClient
        ? <
            TParams extends Parameters<
              TClient["send"][keyof TClient["send"]]
            >[0],
          >(
            params: TParams,
          ) => Promise<SendTransactionComposerResults & { return: unknown }>
        : never
      : never
    : never;
};

/**
 * State interface for the self-updating client.
 * Exposes global and box state from the base page.
 */
type SelfUpdatingClientState<TBasePage extends VirtualSelfUpdatingAppClient> = {
  /** Global state getters from the base page */
  global: TBasePage["state"]["global"];
  /** Box state getters from the base page */
  box: TBasePage["state"]["box"];
};

/**
 * Result type returned by createSelfUpdatingClient.
 * Contains typed send methods, state access, and app information.
 */
export interface SelfUpdatingClientResult<
  TPages extends PageSet,
  TBasePage extends VirtualSelfUpdatingAppClient,
> {
  /** Typed send methods that automatically handle page swapping */
  send: SendMethods<TPages>;
  /** The ID of the deployed app */
  appId: bigint;
  /** The address of the deployed app */
  appAddress: Address;
  /** Access to shared state (global and box) */
  state: SelfUpdatingClientState<TBasePage>;
  /** Access to the underlying base app client for state queries */
  baseClient: TBasePage;
}

/**
 * Creates a self-updating client from a page configuration.
 * For a single page, this simply creates the app and registers the page.
 *
 * @param algorand - The Algorand client instance
 * @param sender - The sender address for transactions
 * @param pages - The page configuration mapping method names to page specs and clients
 * @returns A typed self-updating client with send methods and app info
 * @throws Error if validation fails or app creation fails
 */
export async function createSelfUpdatingClient<TPages extends PageSet>(
  algorand: AlgorandClient,
  sender: SendingAddress,
  pages: TPages,
): Promise<SelfUpdatingClientResult<TPages>> {
  // Validate pages (even single page needs validation)
  const pageConfigs = Object.values(pages);
  validatePages(pageConfigs);

  // Get the first page as the base
  const firstPageKey = Object.keys(pages)[0];
  const firstPage = pages[firstPageKey];

  // Create the app using the VirtualSelfUpdatingAppFactory
  const factory = algorand.client.getTypedAppFactory(
    VirtualSelfUpdatingAppFactory,
    {},
  );

  const { appClient: baseClient } = await factory.send.create.bare({
    sender,
    note: `${Date.now()}-${Math.random()}`,
  });

  // Initialize the app by registering pages
  await initializeApp(algorand, sender, baseClient, pages);

  // Build the typed send object
  const send = buildSendMethods(algorand, sender, baseClient, pages);

  return {
    send: send as SendMethods<TPages>,
    appId: baseClient.appId,
    appAddress: baseClient.appAddress,
    state: {
      global: baseClient.state.global,
      box: baseClient.state.box,
    },
    baseClient,
  };
}

/**
 * Initializes the app by funding it and registering all pages.
 */
async function initializeApp<TPages extends PageSet>(
  algorand: AlgorandClient,
  sender: SendingAddress,
  baseClient: VirtualSelfUpdatingAppClient,
  pages: TPages,
): Promise<void> {
  const group = baseClient.newGroup();

  // Fund the app for box storage
  group.addTransaction(
    await algorand.createTransaction.payment({
      sender,
      receiver: baseClient.appAddress,
      amount: microAlgo(408100),
    }),
  );

  // Register each page
  for (const [methodName, pageConfig] of Object.entries(pages)) {
    const bytecode = Buffer.from(pageConfig.spec.byteCode.approval, "base64");

    // Get the selector using getABIMethod
    const abiMethod = getABIMethod(methodName, baseClient.appSpec);
    const selector = abiMethod.getSelector();

    group.setPage({
      sender,
      args: {
        methodSelector: selector,
        pageOffset: 0,
        page: bytecode,
      },
      extraFee: microAlgo(2000),
    });
  }

  await group.send();
}

/**
 * Builds the send methods for each page.
 * Each method automatically swaps to its page before executing.
 */
function buildSendMethods<TPages extends PageSet>(
  algorand: AlgorandClient,
  sender: SendingAddress,
  baseClient: VirtualSelfUpdatingAppClient,
  pages: TPages,
): Record<string, (params: unknown) => Promise<unknown>> {
  const sendMethods: Record<string, (params: unknown) => Promise<unknown>> = {};

  for (const [methodName, pageConfig] of Object.entries(pages)) {
    // Get the primary method name from the page spec
    const primaryMethodName = getPrimaryMethodName(pageConfig.spec);

    if (!primaryMethodName) {
      throw new Error(
        `No primary method found in page "${methodName}". Expected at least one method other than updateApplication or setPage.`,
      );
    }

    // Create the send method that swaps then executes
    sendMethods[methodName] = async (params: unknown) => {
      const typedParams = params as { sender: SendingAddress; args: unknown };
      const group = baseClient.newGroup() as Record<
        string,
        (p: unknown) => unknown
      >;

      // Build and add swap transaction to target page
      const swapTx = await buildSwapTransaction({
        algorand,
        targetPage: pageConfig,
        appId: baseClient.appId,
        sender: typedParams.sender,
        baseClient:
          baseClient as unknown as import("@algorandfoundation/algokit-utils/app-client").AppClient,
        methodName: methodName,
      });
      group.addTransaction(swapTx);

      // Add the actual method call
      group[primaryMethodName](params);

      const result = await (
        group as { send: () => Promise<SendTransactionComposerResults> }
      ).send();
      return { ...result, return: result.returns[0] };
    };
  }

  return sendMethods;
}
