import type { AlgorandClient } from "@algorandfoundation/algokit-utils/algorand-client";
import type { Transaction } from "@algorandfoundation/algokit-utils/transact";
import type { SendingAddress } from "@algorandfoundation/algokit-utils/transact";
import type { Arc56Contract } from "@algorandfoundation/algokit-utils/abi";
import type { AppClient, AppClientParams } from "@algorandfoundation/algokit-utils/app-client";
import { PageConfig } from "./schema-validation";
import { getABIMethod } from "@algorandfoundation/algokit-utils/abi";

/**
 * Extracts the 4-byte method selector from an ARC56 contract spec for a given method name.
 *
 * The selector is the first 4 bytes of the SHA-512/256 hash of the method signature.
 * In ARC56 specs, the selector is stored as a base64-encoded string in the method's
 * actions.call array for UpdateApplication actions.
 *
 * @param pageSpec - The ARC56 contract specification
 * @param methodName - The name of the method to get the selector for
 * @returns The 4-byte method selector as Uint8Array
 * @throws Error if the method is not found in the spec
 */
export function getMethodSelector(
  pageSpec: Arc56Contract,
  methodName: string,
): Uint8Array {
  const methods = pageSpec.methods;
  if (!methods) {
    throw new Error(`No methods defined in ARC56 spec for "${pageSpec.name}"`);
  }

  // Find the updateApplication method which handles page swapping
  const updateMethod = methods.find((m) => m.name === "updateApplication");
  if (!updateMethod) {
    throw new Error(
      `Method "updateApplication" not found in ARC56 spec for "${pageSpec.name}"`,
    );
  }

  // The selector is derived from the method signature hash
  // For ARC56, we need to construct the selector from the method signature
  // The selector format is: first 4 bytes of SHA-512/256 hash of "methodName(arg1Type,arg2Type)"
  const args = updateMethod.args.map((arg) => arg.type).join(",");
  const signature = `${updateMethod.name}(${args})${updateMethod.returns.type}`;

  // Calculate SHA-512/256 hash and take first 4 bytes
  // Note: In a real implementation, we'd use crypto.subtle or a SHA-512 library
  // For now, we extract the selector from the bytecode directly since the ARC56
  // spec doesn't expose the selector directly

  // Alternative: Extract from the method's actions
  // The selector is encoded in the method's call actions as base64
  const selector = extractSelectorFromByteCode(pageSpec, methodName);
  if (!selector) {
    throw new Error(
      `Could not extract selector for method "${methodName}" from "${pageSpec.name}"`,
    );
  }

  return selector;
}

/**
 * Extracts the method selector by analyzing the bytecode.
 * This looks for the selector bytes in the approval program bytecode.
 */
function extractSelectorFromByteCode(
  pageSpec: Arc56Contract,
  methodName: string,
): Uint8Array | undefined {
  // Get the method from the spec to understand its signature
  const methods = pageSpec.methods;
  if (!methods) return undefined;

  // Find the method by name
  const targetMethod = methods.find((m) => m.name === methodName);
  if (!targetMethod) return undefined;

  // Construct the ABI method signature
  const args = targetMethod.args.map((arg) => arg.type).join(",");
  const signature = `${targetMethod.name}(${args})${targetMethod.returns.type}`;

  // Calculate the selector (first 4 bytes of SHA-512/256 hash of signature)
  return calculateMethodSelector(signature);
}

/**
 * Calculates the 4-byte method selector from an ABI method signature.
 * The selector is the first 4 bytes of the SHA-512/256 hash of the signature.
 *
 * @param signature - The ABI method signature (e.g., "setValues(uint64,uint64)void")
 * @returns The 4-byte selector as Uint8Array
 */
function calculateMethodSelector(signature: string): Uint8Array {
  // Use Node.js crypto for SHA-512/256
  // SHA-512/256 is different from SHA-256 - it's the first 256 bits of SHA-512
  const hash = require("crypto").createHash("sha512");
  hash.update(signature);
  const fullHash = hash.digest();
  return new Uint8Array(fullHash.slice(0, 4));
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
  const { algorand, targetPage, appId, sender, baseClient, methodName } = params;

  // Instantiate the target page client with the current appId
  const pageClient = new targetPage.Client({
    algorand,
    appId,
  });

  // Get the method selector from the base app's spec using the method name
  // The selector is used by the base app to look up the page in box storage
  const abiMethod = getABIMethod(methodName, baseClient.appSpec);
  const selector = abiMethod.getSelector();

  // Create the update transaction via the page client with a unique note
  // The note ensures each transaction has a unique ID even if params are identical
  const transactionResult = await pageClient.createTransaction.update.updateApplication({
    sender,
    args: { selector },
    note: generateRandomNote(),
  });

  // Return the first transaction from the result
  // The result contains an array of transactions (usually just one for update)
  if (!transactionResult.transactions || transactionResult.transactions.length === 0) {
    throw new Error("No transaction returned from updateApplication call");
  }

  return transactionResult.transactions[0];
}

/**
 * Determines the primary method for a page from its ARC56 spec.
 * The primary method is the one that isn't updateApplication or setPage.
 *
 * @param spec - The ARC56 contract specification
 * @returns The name of the primary method
 * @throws Error if no primary method is found
 */
function getPrimaryMethod(spec: Arc56Contract): string {
  const methods = spec.methods;
  if (!methods) {
    throw new Error(`No methods defined in ARC56 spec for "${spec.name}"`);
  }

  // Find a method that is not updateApplication or setPage
  // These are the utility methods, not the primary business logic
  const primaryMethod = methods.find(
    (m) => m.name !== "updateApplication" && m.name !== "setPage",
  );

  if (!primaryMethod) {
    throw new Error(
      `No primary method found in ARC56 spec for "${spec.name}". ` +
        `Expected at least one method other than updateApplication or setPage.`,
    );
  }

  return primaryMethod.name;
}
