import type { AlgorandClient } from "@algorandfoundation/algokit-utils/algorand-client";
import type { Transaction } from "@algorandfoundation/algokit-utils/transact";
import type { SendingAddress } from "@algorandfoundation/algokit-utils/transact";
import type { Arc56Contract } from "@algorandfoundation/algokit-utils/abi";
import type { AppClient } from "@algorandfoundation/algokit-utils/app-client";
import type { PageConfig } from "./schema-validation.js";
import { getABIMethod } from "@algorandfoundation/algokit-utils/abi";

export function getMethodSelector(
  pageSpec: Arc56Contract,
  methodName: string,
): Uint8Array {
  return getABIMethod(methodName, pageSpec).getSelector();
}

/**
 * Parameters for building a page swap transaction.
 */
export interface BuildSwapTransactionParams {
  /** The Algorand client instance */
  algorand: AlgorandClient;
  /** The page configuration to swap to */
  targetPage: PageConfig;
  /** The application ID to update */
  appId: bigint;
  /** The sender address for the transaction */
  sender: SendingAddress;
  /** The base app client (e.g., VirtualSelfUpdatingAppClient) used to get the selector */
  baseClient: AppClient;
  /** The method name in the base app spec (e.g., "setValues", "getSum") */
  methodName: string;
}

/**
 * Generates a random note to ensure unique transaction IDs.
 */
function generateRandomNote(): Uint8Array {
  const note = `swap-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  return new TextEncoder().encode(note);
}

/**
 * Builds a transaction to swap the current page to a target page.
 *
 * This function:
 * 1. Instantiates the target page client with the current appId
 * 2. Gets the method selector from the base app's spec using the method name
 * 3. Creates an updateApplication transaction via the page client with a unique note
 * 4. Returns the transaction that can be added to a group
 *
 * @param params - The parameters for building the swap transaction
 * @returns The updateApplication transaction for the page swap
 * @throws Error if the method selector cannot be extracted or transaction creation fails
 */
export async function buildSwapTransaction(
  params: BuildSwapTransactionParams,
): Promise<Transaction> {
  const { algorand, targetPage, appId, sender, baseClient, methodName } =
    params;

  // Instantiate the target page client with the current appId
  const pageClient = new targetPage.Client({
    algorand,
    appId,
    appSpec: targetPage.spec,
  });

  // Get the method selector from the base app's spec using the method name
  // The selector is used by the base app to look up the page in box storage
  const abiMethod = getABIMethod(methodName, baseClient.appSpec);
  const selector = abiMethod.getSelector();

  // Create the update transaction via the page client with a unique note
  // The note ensures each transaction has a unique ID even if params are identical
  const transactionResult = await (
    pageClient.createTransaction.update as unknown as {
      updateApplication: (params: {
        sender: SendingAddress;
        args: { selector: Uint8Array };
        note: Uint8Array;
      }) => Promise<{ transactions: Transaction[] }>;
    }
  ).updateApplication({
    sender,
    args: { selector },
    note: generateRandomNote(),
  });

  // Return the first transaction from the result
  // The result contains an array of transactions (usually just one for update)
  const transactions = transactionResult.transactions;
  if (!transactions || transactions.length === 0) {
    throw new Error("No transaction returned from updateApplication call");
  }
  const firstTx = transactions[0];
  if (!firstTx) {
    throw new Error("First transaction is undefined");
  }
  return firstTx;
}
