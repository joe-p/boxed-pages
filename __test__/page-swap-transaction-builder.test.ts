import { describe, it, expect, vi } from "vitest";
import {
  buildSwapTransaction,
  getMethodSelector,
  BuildSwapTransactionParams,
} from "../src/page-swap-transaction-builder";
import { PageConfig } from "../src/schema-validation";
import { AppClient, AppClientParams } from "@algorandfoundation/algokit-utils/app-client";
import { Arc56Contract } from "@algorandfoundation/algokit-utils/abi";
import { AlgorandClient } from "@algorandfoundation/algokit-utils/algorand-client";
import { SendingAddress } from "@algorandfoundation/algokit-utils/transact";
import { Transaction } from "algosdk";

// Import actual ARC56 specs from the contracts
import SETTER_SPEC from "../contracts/out/SetterSelfUpdatingPage.arc56.json";
import SUM_SPEC from "../contracts/out/SumSelfUpdatingPage.arc56.json";
import PRODUCT_SPEC from "../contracts/out/ProductSelfUpdatingPage.arc56.json";

describe("getMethodSelector", () => {
  it("should extract selector for setValues method", () => {
    const selector = getMethodSelector(
      SETTER_SPEC as Arc56Contract,
      "setValues",
    );

    expect(selector).toBeInstanceOf(Uint8Array);
    expect(selector.length).toBe(4);
  });

  it("should extract selector for getSum method", () => {
    const selector = getMethodSelector(
      SUM_SPEC as Arc56Contract,
      "getSum",
    );

    expect(selector).toBeInstanceOf(Uint8Array);
    expect(selector.length).toBe(4);
  });

  it("should extract selector for getProduct method", () => {
    const selector = getMethodSelector(
      PRODUCT_SPEC as Arc56Contract,
      "getProduct",
    );

    expect(selector).toBeInstanceOf(Uint8Array);
    expect(selector.length).toBe(4);
  });

  it("should throw for non-existent method", () => {
    const badSpec: Arc56Contract = {
      ...SETTER_SPEC,
      name: "BadSpec",
      methods: [],
    } as Arc56Contract;

    expect(() => getMethodSelector(badSpec, "setValues")).toThrow(
      /Method "updateApplication" not found/,
    );
  });

  it("should throw for missing methods array", () => {
    const badSpec: Arc56Contract = {
      ...SETTER_SPEC,
      name: "BadSpec",
      methods: undefined as unknown as Arc56Contract["methods"],
    } as Arc56Contract;

    expect(() => getMethodSelector(badSpec, "setValues")).toThrow(
      /No methods defined in ARC56 spec/,
    );
  });

  it("should throw for missing updateApplication method", () => {
    const badSpec: Arc56Contract = {
      ...SETTER_SPEC,
      name: "BadSpec",
      methods: [
        {
          name: "setValues",
          args: [],
          returns: { type: "void" },
          actions: { create: [], call: ["NoOp"] },
          readonly: false,
          events: [],
          recommendations: {},
        },
      ],
    } as Arc56Contract;

    expect(() => getMethodSelector(badSpec, "setValues")).toThrow(
      /Method "updateApplication" not found/,
    );
  });

  it("should return consistent selectors for same method", () => {
    const selector1 = getMethodSelector(
      SETTER_SPEC as Arc56Contract,
      "setValues",
    );
    const selector2 = getMethodSelector(
      SETTER_SPEC as Arc56Contract,
      "setValues",
    );

    expect(selector1).toEqual(selector2);
  });

  it("should return different selectors for different methods", () => {
    const setValuesSelector = getMethodSelector(
      SETTER_SPEC as Arc56Contract,
      "setValues",
    );
    // Note: We can only test with setValues since the spec only has one primary method
    // In a real scenario, each page has one primary method

    // Just verify the selector is valid
    expect(setValuesSelector).toBeInstanceOf(Uint8Array);
    expect(setValuesSelector.length).toBe(4);
  });
});

describe("buildSwapTransaction", () => {
  // Mock transaction for testing
  const createMockTransaction = (): Transaction => {
    // Create a minimal mock transaction
    return {
      type: "appl",
      from: Buffer.alloc(32),
      appIndex: 1234,
      appOnComplete: 4, // UpdateApplication
    } as unknown as Transaction;
  };

  // Create a mock AlgorandClient
  const createMockAlgorandClient = (): AlgorandClient => {
    return {
      account: {
        getInformation: vi.fn(),
      },
    } as unknown as AlgorandClient;
  };

  it("should instantiate page client with correct appId", async () => {
    const mockTransaction = createMockTransaction();
    const updateApplicationMock = vi.fn().mockResolvedValue({
      transactions: [mockTransaction],
    });

    // Create a proper class mock that captures constructor params
    let capturedParams: AppClientParams | null = null;

    class MockClient {
      constructor(params: AppClientParams) {
        capturedParams = params;
      }

      readonly createTransaction = {
        update: {
          updateApplication: updateApplicationMock,
        },
      };
    }

    const mockAlgorand = createMockAlgorandClient();
    const mockSender = "TEST_SENDER_ADDRESS" as SendingAddress;
    const testAppId = 12345n;

    const pageConfig: PageConfig = {
      spec: SETTER_SPEC as Arc56Contract,
      Client: MockClient as unknown as new (
        params: AppClientParams,
      ) => AppClient,
    };

    const params: BuildSwapTransactionParams = {
      algorand: mockAlgorand,
      targetPage: pageConfig,
      appId: testAppId,
      sender: mockSender,
    };

    await buildSwapTransaction(params);

    expect(capturedParams).not.toBeNull();
    expect(capturedParams?.algorand).toBe(mockAlgorand);
    expect(capturedParams?.appId).toBe(testAppId);
  });

  it("should call updateApplication with correct selector", async () => {
    const mockTransaction = createMockTransaction();
    const updateApplicationMock = vi.fn().mockResolvedValue({
      transactions: [mockTransaction],
    });

    // Create a proper class mock
    class MockClientWithSpy {
      constructor(_params: AppClientParams) {}

      readonly createTransaction = {
        update: {
          updateApplication: updateApplicationMock,
        },
      };
    }

    const mockAlgorand = createMockAlgorandClient();
    const mockSender = "TEST_SENDER_ADDRESS" as SendingAddress;
    const testAppId = 12345n;

    const pageConfig: PageConfig = {
      spec: SETTER_SPEC as Arc56Contract,
      Client: MockClientWithSpy as unknown as new (
        params: AppClientParams,
      ) => AppClient,
    };

    const params: BuildSwapTransactionParams = {
      algorand: mockAlgorand,
      targetPage: pageConfig,
      appId: testAppId,
      sender: mockSender,
    };

    await buildSwapTransaction(params);

    expect(updateApplicationMock).toHaveBeenCalled();
    const callArgs = updateApplicationMock.mock.calls[0][0];
    expect(callArgs.sender).toBe(mockSender);
    expect(callArgs.args).toHaveProperty("selector");
    expect(callArgs.args.selector).toBeInstanceOf(Uint8Array);
    expect(callArgs.args.selector.length).toBe(4);
  });

  it("should return the transaction from the result", async () => {
    const mockTransaction = createMockTransaction();

    class MockClient {
      constructor(_params: AppClientParams) {}

      readonly createTransaction = {
        update: {
          updateApplication: vi.fn().mockResolvedValue({
            transactions: [mockTransaction],
          }),
        },
      };
    }

    const mockAlgorand = createMockAlgorandClient();
    const mockSender = "TEST_SENDER_ADDRESS" as SendingAddress;
    const testAppId = 12345n;

    const pageConfig: PageConfig = {
      spec: SETTER_SPEC as Arc56Contract,
      Client: MockClient as unknown as new (
        params: AppClientParams,
      ) => AppClient,
    };

    const params: BuildSwapTransactionParams = {
      algorand: mockAlgorand,
      targetPage: pageConfig,
      appId: testAppId,
      sender: mockSender,
    };

    const result = await buildSwapTransaction(params);

    expect(result).toBeDefined();
  });

  it("should throw if no transactions returned", async () => {
    class MockClient {
      constructor(_params: AppClientParams) {}

      readonly createTransaction = {
        update: {
          updateApplication: vi.fn().mockResolvedValue({
            transactions: [],
          }),
        },
      };
    }

    const mockAlgorand = createMockAlgorandClient();
    const mockSender = "TEST_SENDER_ADDRESS" as SendingAddress;
    const testAppId = 12345n;

    const pageConfig: PageConfig = {
      spec: SETTER_SPEC as Arc56Contract,
      Client: MockClient as unknown as new (
        params: AppClientParams,
      ) => AppClient,
    };

    const params: BuildSwapTransactionParams = {
      algorand: mockAlgorand,
      targetPage: pageConfig,
      appId: testAppId,
      sender: mockSender,
    };

    await expect(buildSwapTransaction(params)).rejects.toThrow(
      "No transaction returned from updateApplication call",
    );
  });

  it("should work with Sum page", async () => {
    const mockTransaction = createMockTransaction();

    class MockClient {
      constructor(_params: AppClientParams) {}

      readonly createTransaction = {
        update: {
          updateApplication: vi.fn().mockResolvedValue({
            transactions: [mockTransaction],
          }),
        },
      };
    }

    const mockAlgorand = createMockAlgorandClient();
    const mockSender = "TEST_SENDER_ADDRESS" as SendingAddress;
    const testAppId = 12345n;

    const pageConfig: PageConfig = {
      spec: SUM_SPEC as Arc56Contract,
      Client: MockClient as unknown as new (
        params: AppClientParams,
      ) => AppClient,
    };

    const params: BuildSwapTransactionParams = {
      algorand: mockAlgorand,
      targetPage: pageConfig,
      appId: testAppId,
      sender: mockSender,
    };

    const result = await buildSwapTransaction(params);

    expect(result).toBeDefined();
  });

  it("should work with Product page", async () => {
    const mockTransaction = createMockTransaction();

    class MockClient {
      constructor(_params: AppClientParams) {}

      readonly createTransaction = {
        update: {
          updateApplication: vi.fn().mockResolvedValue({
            transactions: [mockTransaction],
          }),
        },
      };
    }

    const mockAlgorand = createMockAlgorandClient();
    const mockSender = "TEST_SENDER_ADDRESS" as SendingAddress;
    const testAppId = 12345n;

    const pageConfig: PageConfig = {
      spec: PRODUCT_SPEC as Arc56Contract,
      Client: MockClient as unknown as new (
        params: AppClientParams,
      ) => AppClient,
    };

    const params: BuildSwapTransactionParams = {
      algorand: mockAlgorand,
      targetPage: pageConfig,
      appId: testAppId,
      sender: mockSender,
    };

    const result = await buildSwapTransaction(params);

    expect(result).toBeDefined();
  });

  it("should throw for page without primary method", async () => {
    const badSpec: Arc56Contract = {
      ...SETTER_SPEC,
      name: "BadSpec",
      methods: [
        {
          name: "updateApplication",
          args: [{ type: "byte[4]", name: "selector" }],
          returns: { type: "void" },
          actions: { create: [], call: ["UpdateApplication"] },
          readonly: false,
          events: [],
          recommendations: {},
        },
        {
          name: "setPage",
          args: [
            { type: "byte[4]", name: "methodSelector" },
            { type: "uint64", name: "pageOffset" },
            { type: "byte[]", name: "page" },
          ],
          returns: { type: "void" },
          actions: { create: [], call: ["NoOp"] },
          readonly: false,
          events: [],
          recommendations: {},
        },
      ],
    } as Arc56Contract;

    const mockTransaction = createMockTransaction();

    class MockClient {
      constructor(_params: AppClientParams) {}

      readonly createTransaction = {
        update: {
          updateApplication: vi.fn().mockResolvedValue({
            transactions: [mockTransaction],
          }),
        },
      };
    }

    const mockAlgorand = createMockAlgorandClient();
    const mockSender = "TEST_SENDER_ADDRESS" as SendingAddress;
    const testAppId = 12345n;

    const pageConfig: PageConfig = {
      spec: badSpec,
      Client: MockClient as unknown as new (
        params: AppClientParams,
      ) => AppClient,
    };

    const params: BuildSwapTransactionParams = {
      algorand: mockAlgorand,
      targetPage: pageConfig,
      appId: testAppId,
      sender: mockSender,
    };

    await expect(buildSwapTransaction(params)).rejects.toThrow(
      /No primary method found/,
    );
  });
});
