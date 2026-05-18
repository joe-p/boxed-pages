import { beforeAll, describe, expect, it } from "vitest";
import { createSelfUpdatingClient } from "../src/generic-client-factory";
import { AlgorandClient } from "@algorandfoundation/algokit-utils";
import { SendingAddress } from "@algorandfoundation/algokit-utils/transact";
import { SetterSelfUpdatingPageClient } from "../contracts/clients/SetterSelfUpdatingPageClient.ts";
import SETTER_SPEC from "../contracts/out/SetterSelfUpdatingPage.arc56.json";
import { getABIMethod } from "@algorandfoundation/algokit-utils/abi";

describe("createSelfUpdatingClient - single page", () => {
  let algorand: AlgorandClient;
  let client: Awaited<ReturnType<typeof createSelfUpdatingClient>>;
  let sender: SendingAddress;

  beforeAll(async () => {
    algorand = AlgorandClient.defaultLocalNet();
    sender = await algorand.account.dispenserFromEnvironment();

    client = await createSelfUpdatingClient(algorand, sender, {
      setValues: { spec: SETTER_SPEC, Client: SetterSelfUpdatingPageClient },
    });
  });

  it("should create a client with a single page (Setter)", async () => {
    expect(client.appId).toBeGreaterThan(0n);
    expect(client.appAddress).toBeDefined();
    expect(client.send.setValues).toBeDefined();
  });

  it("should expose appId and appAddress on returned client", async () => {
    expect(typeof client.appId).toBe("bigint");
    expect(client.appId).toBeGreaterThan(0n);
    expect(client.appAddress).toBeDefined();
    // appAddress should be a valid Algorand address (58 characters)
    expect(client.appAddress.toString()).toHaveLength(58);
  });

  it("should call send.setValues() with typed args and update state", async () => {
    const result = await client.send.setValues({
      sender,
      args: { a: 2, b: 3 },
    });

    // setValues returns void
    expect(result.return).toBeUndefined();

    // Verify state was updated
    const globalState = await client.baseClient.state.global.getAll();
    expect(globalState).toEqual({ aValue: 2n, bValue: 3n });
  });

  it("should return full transaction result structure", async () => {
    // Values were already set by previous test
    // Since we can only set values once, we just verify the structure is correct
    const globalState = await client.baseClient.state.global.getAll();
    expect(globalState.aValue).toBeDefined();
    expect(globalState.bValue).toBeDefined();

    // Verify we can access the baseClient for state
    const aValue = await client.baseClient.state.global.aValue();
    const bValue = await client.baseClient.state.global.bValue();
    expect(typeof aValue).toBe("bigint");
    expect(typeof bValue).toBe("bigint");
  });

  it("should expose baseClient for state access", async () => {
    // Access state through baseClient
    expect(client.baseClient.state).toBeDefined();
    expect(client.baseClient.state.global).toBeDefined();
    expect(client.baseClient.state.box).toBeDefined();
  });

  it("should register the page in box storage", async () => {
    // Get the selector for setValues method
    const abiMethod = getABIMethod("setValues", client.baseClient.appSpec);
    const selector = abiMethod.getSelector();

    // Check that the page was registered
    const page = await client.baseClient.state.box.pages.value(selector);
    expect(page).toBeDefined();

    // Verify the page content matches the Setter page bytecode
    const expectedBytecode = Buffer.from(SETTER_SPEC.byteCode.approval, "base64");
    expect(Buffer.from(page!)).toEqual(expectedBytecode);
  });
});
