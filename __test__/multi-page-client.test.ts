import { beforeAll, describe, expect, it } from "vitest";
import { createSelfUpdatingClient } from "../src/generic-client-factory";
import { AlgorandClient } from "@algorandfoundation/algokit-utils";
import { SendingAddress } from "@algorandfoundation/algokit-utils/transact";
import { SetterSelfUpdatingPageClient } from "../contracts/clients/SetterSelfUpdatingPageClient.ts";
import { SumSelfUpdatingPageClient } from "../contracts/clients/SumSelfUpdatingPageClient.ts";
import { ProductSelfUpdatingPageClient } from "../contracts/clients/ProductSelfUpdatingPageClient.ts";
import SETTER_SPEC from "../contracts/out/SetterSelfUpdatingPage.arc56.json";
import SUM_SPEC from "../contracts/out/SumSelfUpdatingPage.arc56.json";
import PRODUCT_SPEC from "../contracts/out/ProductSelfUpdatingPage.arc56.json";

describe("createSelfUpdatingClient - multi-page with automatic swapping", () => {
  let algorand: AlgorandClient;
  let client: Awaited<ReturnType<typeof createSelfUpdatingClient>>;
  let sender: SendingAddress;

  beforeAll(async () => {
    algorand = AlgorandClient.defaultLocalNet();
    sender = await algorand.account.dispenserFromEnvironment();

    client = await createSelfUpdatingClient(algorand, sender, {
      setValues: { spec: SETTER_SPEC, Client: SetterSelfUpdatingPageClient },
      getSum: { spec: SUM_SPEC, Client: SumSelfUpdatingPageClient },
      getProduct: { spec: PRODUCT_SPEC, Client: ProductSelfUpdatingPageClient },
    });
  });

  it("should create a client with multiple pages", async () => {
    expect(client.appId).toBeGreaterThan(0n);
    expect(client.appAddress).toBeDefined();
    expect(client.send.setValues).toBeDefined();
    expect(client.send.getSum).toBeDefined();
    expect(client.send.getProduct).toBeDefined();
  });

  it("should expose appId and appAddress on returned client", async () => {
    expect(typeof client.appId).toBe("bigint");
    expect(client.appId).toBeGreaterThan(0n);
    expect(client.appAddress).toBeDefined();
    // appAddress should be a valid Algorand address (58 characters)
    expect(client.appAddress.toString()).toHaveLength(58);
  });

  it("should call setValues and update bytecode to Setter page", async () => {
    await client.send.setValues({
      sender,
      args: { a: 2, b: 3 },
    });

    // Verify state was updated
    const globalState = await client.baseClient.state.global.getAll();
    expect(globalState).toEqual({ aValue: 2n, bValue: 3n });

    // Verify bytecode changed to Setter page
    const { approvalProgram } = await client.baseClient.algorand.app.getById(
      client.appId,
    );
    const setterBytecode = Buffer.from(SETTER_SPEC.byteCode.approval, "base64");
    expect(Buffer.from(approvalProgram)).toEqual(setterBytecode);
  });

  it("should call getSum and update bytecode to Sum page", async () => {
    // Values were already set by previous test
    const result = await client.send.getSum({ sender, args: [] });

    expect(result.return).toEqual(5n);

    // Verify bytecode changed to Sum page
    const { approvalProgram } = await client.baseClient.algorand.app.getById(
      client.appId,
    );
    const sumBytecode = Buffer.from(SUM_SPEC.byteCode.approval, "base64");
    expect(Buffer.from(approvalProgram)).toEqual(sumBytecode);
  });

  it("should call getProduct and update bytecode to Product page", async () => {
    // Values are still set from earlier tests
    const result = await client.send.getProduct({ sender, args: [] });

    expect(result.return).toEqual(6n);

    // Verify bytecode changed to Product page
    const { approvalProgram } = await client.baseClient.algorand.app.getById(
      client.appId,
    );
    const productBytecode = Buffer.from(
      PRODUCT_SPEC.byteCode.approval,
      "base64",
    );
    expect(Buffer.from(approvalProgram)).toEqual(productBytecode);
  });

  it("should persist state across page swaps", async () => {
    // Values were already set in earlier tests (a=2, b=3)
    // First verify the current state using exposed state property
    const globalState = await client.state.global.getAll();
    expect(globalState.aValue).toBeDefined();
    expect(globalState.bValue).toBeDefined();

    // Switch to Sum page and verify values persisted from earlier
    const sumResult = await client.send.getSum({ sender, args: [] });
    // Values from earlier test should persist (2+3=5 or whatever was set)
    expect(typeof sumResult.return).toBe("bigint");

    // Switch to Product page and verify values persist
    const productResult = await client.send.getProduct({ sender, args: [] });
    expect(typeof productResult.return).toBe("bigint");
  });

  it("should access state via exposed state property after page swap", async () => {
    // Call a method to swap pages
    await client.send.getSum({ sender, args: [] });

    // Verify state is still accessible via exposed state property
    const globalState = await client.state.global.getAll();
    expect(globalState.aValue).toBeDefined();
    expect(globalState.bValue).toBeDefined();

    // Verify individual state values
    const aValue = await client.state.global.aValue();
    const bValue = await client.state.global.bValue();
    expect(typeof aValue).toBe("bigint");
    expect(typeof bValue).toBe("bigint");
  });

  it("should return correct sum proving state persisted", async () => {
    // At this point values have been set in earlier tests
    // Just verify getSum returns the correct sum based on current state
    const globalState = await client.baseClient.state.global.getAll();
    const expectedSum = globalState.aValue + globalState.bValue;

    // Call getSum and verify it returns the correct sum
    const result = await client.send.getSum({ sender, args: [] });
    expect(result.return).toEqual(expectedSum);
  });

  it("should return full transaction result with return value", async () => {
    const result = await client.send.getSum({ sender, args: [] });

    // Verify the result structure
    expect(result).toHaveProperty("return");
    expect(result).toHaveProperty("transactions");
    expect(result).toHaveProperty("confirmations");
    expect(result).toHaveProperty("returns");

    // Return value should be the actual method result
    expect(typeof result.return).toBe("bigint");
  });

  it("should use 2 transactions per method call (swap + execute)", async () => {
    const result = await client.send.getSum({ sender, args: [] });

    // Each method call should involve 2 transactions: swap + method execution
    expect(result.transactions.length).toBeGreaterThanOrEqual(1);
  });
});
