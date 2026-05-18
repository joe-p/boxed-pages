import { describe, it, expect } from "vitest";
import { validatePages, PageConfig } from "../src/schema-validation";
import { AppClient, AppClientParams } from "@algorandfoundation/algokit-utils/app-client";
import { Arc56Contract } from "@algorandfoundation/algokit-utils/abi";

// Import actual ARC56 specs from the contracts
import SETTER_SPEC from "../contracts/out/SetterSelfUpdatingPage.arc56.json";
import SUM_SPEC from "../contracts/out/SumSelfUpdatingPage.arc56.json";
import PRODUCT_SPEC from "../contracts/out/ProductSelfUpdatingPage.arc56.json";

// Mock client class for tests
class MockAppClient {
  constructor(_params: AppClientParams) {}
}

describe("validatePages", () => {
  describe("happy path", () => {
    it("should pass for single page", () => {
      const pages: PageConfig[] = [
        { spec: SETTER_SPEC as Arc56Contract, Client: MockAppClient as unknown as new (params: AppClientParams) => AppClient },
      ];

      expect(() => validatePages(pages)).not.toThrow();
    });

    it("should pass for three compatible pages (Setter, Sum, Product)", () => {
      const pages: PageConfig[] = [
        { spec: SETTER_SPEC as Arc56Contract, Client: MockAppClient as unknown as new (params: AppClientParams) => AppClient },
        { spec: SUM_SPEC as Arc56Contract, Client: MockAppClient as unknown as new (params: AppClientParams) => AppClient },
        { spec: PRODUCT_SPEC as Arc56Contract, Client: MockAppClient as unknown as new (params: AppClientParams) => AppClient },
      ];

      expect(() => validatePages(pages)).not.toThrow();
    });

    it("should pass for pages in different order", () => {
      const pages: PageConfig[] = [
        { spec: PRODUCT_SPEC as Arc56Contract, Client: MockAppClient as unknown as new (params: AppClientParams) => AppClient },
        { spec: SETTER_SPEC as Arc56Contract, Client: MockAppClient as unknown as new (params: AppClientParams) => AppClient },
        { spec: SUM_SPEC as Arc56Contract, Client: MockAppClient as unknown as new (params: AppClientParams) => AppClient },
      ];

      expect(() => validatePages(pages)).not.toThrow();
    });
  });

  describe("error cases", () => {
    it("should throw for empty array", () => {
      expect(() => validatePages([])).toThrow("At least one page must be provided");
    });

    it("should throw for incompatible global schema (different int counts)", () => {
      const incompatibleSpec: Arc56Contract = {
        ...SETTER_SPEC,
        name: "IncompatiblePage",
        state: {
          ...SETTER_SPEC.state,
          schema: {
            ...SETTER_SPEC.state.schema,
            global: {
              ints: 5, // Different from Setter's 2
              bytes: 0,
            },
          },
        },
      } as Arc56Contract;

      const pages: PageConfig[] = [
        { spec: SETTER_SPEC as Arc56Contract, Client: MockAppClient as unknown as new (params: AppClientParams) => AppClient },
        { spec: incompatibleSpec, Client: MockAppClient as unknown as new (params: AppClientParams) => AppClient },
      ];

      expect(() => validatePages(pages)).toThrow(/Global schema mismatch/);
      expect(() => validatePages(pages)).toThrow(/ints: 2/);
      expect(() => validatePages(pages)).toThrow(/ints: 5/);
    });

    it("should throw for incompatible global schema (different byte counts)", () => {
      const incompatibleSpec: Arc56Contract = {
        ...SETTER_SPEC,
        name: "IncompatiblePage",
        state: {
          ...SETTER_SPEC.state,
          schema: {
            ...SETTER_SPEC.state.schema,
            global: {
              ints: 2,
              bytes: 5, // Different from Setter's 0
            },
          },
        },
      } as Arc56Contract;

      const pages: PageConfig[] = [
        { spec: SETTER_SPEC as Arc56Contract, Client: MockAppClient as unknown as new (params: AppClientParams) => AppClient },
        { spec: incompatibleSpec, Client: MockAppClient as unknown as new (params: AppClientParams) => AppClient },
      ];

      expect(() => validatePages(pages)).toThrow(/Global schema mismatch/);
      expect(() => validatePages(pages)).toThrow(/bytes: 0/);
      expect(() => validatePages(pages)).toThrow(/bytes: 5/);
    });

    it("should throw for incompatible local schema (different int counts)", () => {
      const incompatibleSpec: Arc56Contract = {
        ...SETTER_SPEC,
        name: "IncompatiblePage",
        state: {
          ...SETTER_SPEC.state,
          schema: {
            global: {
              ints: 2,
              bytes: 0,
            },
            local: {
              ints: 5, // Different from Setter's 0
              bytes: 0,
            },
          },
        },
      } as Arc56Contract;

      const pages: PageConfig[] = [
        { spec: SETTER_SPEC as Arc56Contract, Client: MockAppClient as unknown as new (params: AppClientParams) => AppClient },
        { spec: incompatibleSpec, Client: MockAppClient as unknown as new (params: AppClientParams) => AppClient },
      ];

      expect(() => validatePages(pages)).toThrow(/Local schema mismatch/);
      expect(() => validatePages(pages)).toThrow(/ints: 0/);
      expect(() => validatePages(pages)).toThrow(/ints: 5/);
    });

    it("should throw for incompatible local schema (different byte counts)", () => {
      const incompatibleSpec: Arc56Contract = {
        ...SETTER_SPEC,
        name: "IncompatiblePage",
        state: {
          ...SETTER_SPEC.state,
          schema: {
            global: {
              ints: 2,
              bytes: 0,
            },
            local: {
              ints: 0,
              bytes: 3, // Different from Setter's 0
            },
          },
        },
      } as Arc56Contract;

      const pages: PageConfig[] = [
        { spec: SETTER_SPEC as Arc56Contract, Client: MockAppClient as unknown as new (params: AppClientParams) => AppClient },
        { spec: incompatibleSpec, Client: MockAppClient as unknown as new (params: AppClientParams) => AppClient },
      ];

      expect(() => validatePages(pages)).toThrow(/Local schema mismatch/);
      expect(() => validatePages(pages)).toThrow(/bytes: 0/);
      expect(() => validatePages(pages)).toThrow(/bytes: 3/);
    });

    it("should throw for mismatched global state keys (missing key)", () => {
      const incompatibleSpec: Arc56Contract = {
        ...SETTER_SPEC,
        name: "IncompatiblePage",
        state: {
          ...SETTER_SPEC.state,
          keys: {
            global: {
              // Missing bValue
              aValue: SETTER_SPEC.state.keys.global.aValue,
            },
            local: {},
            box: SETTER_SPEC.state.keys.box,
          },
        },
      } as Arc56Contract;

      const pages: PageConfig[] = [
        { spec: SETTER_SPEC as Arc56Contract, Client: MockAppClient as unknown as new (params: AppClientParams) => AppClient },
        { spec: incompatibleSpec, Client: MockAppClient as unknown as new (params: AppClientParams) => AppClient },
      ];

      expect(() => validatePages(pages)).toThrow(/Global state key mismatch/);
      expect(() => validatePages(pages)).toThrow(/bValue/);
    });

    it("should throw for mismatched global state keys (extra key)", () => {
      const incompatibleSpec: Arc56Contract = {
        ...SETTER_SPEC,
        name: "IncompatiblePage",
        state: {
          ...SETTER_SPEC.state,
          keys: {
            global: {
              aValue: SETTER_SPEC.state.keys.global.aValue,
              bValue: SETTER_SPEC.state.keys.global.bValue,
              cValue: {
                keyType: "AVMString",
                valueType: "AVMUint64",
                key: "Y1ZhbHVl",
              }, // Extra key not in Setter
            },
            local: {},
            box: SETTER_SPEC.state.keys.box,
          },
        },
      } as Arc56Contract;

      const pages: PageConfig[] = [
        { spec: SETTER_SPEC as Arc56Contract, Client: MockAppClient as unknown as new (params: AppClientParams) => AppClient },
        { spec: incompatibleSpec, Client: MockAppClient as unknown as new (params: AppClientParams) => AppClient },
      ];

      expect(() => validatePages(pages)).toThrow(/Global state key mismatch/);
      expect(() => validatePages(pages)).toThrow(/cValue/);
    });

    it("should throw for mismatched key type", () => {
      const incompatibleSpec: Arc56Contract = {
        ...SETTER_SPEC,
        name: "IncompatiblePage",
        state: {
          ...SETTER_SPEC.state,
          keys: {
            global: {
              aValue: {
                ...SETTER_SPEC.state.keys.global.aValue,
                valueType: "AVMBytes", // Different type
              },
              bValue: SETTER_SPEC.state.keys.global.bValue,
            },
            local: {},
            box: SETTER_SPEC.state.keys.box,
          },
        },
      } as Arc56Contract;

      const pages: PageConfig[] = [
        { spec: SETTER_SPEC as Arc56Contract, Client: MockAppClient as unknown as new (params: AppClientParams) => AppClient },
        { spec: incompatibleSpec, Client: MockAppClient as unknown as new (params: AppClientParams) => AppClient },
      ];

      expect(() => validatePages(pages)).toThrow(/Global state key "aValue" type mismatch/);
      expect(() => validatePages(pages)).toThrow(/valueType: "AVMUint64"/);
      expect(() => validatePages(pages)).toThrow(/valueType: "AVMBytes"/);
    });

    it("should include page names in error messages", () => {
      const incompatibleSpec: Arc56Contract = {
        ...SETTER_SPEC,
        name: "DifferentName",
        state: {
          ...SETTER_SPEC.state,
          schema: {
            ...SETTER_SPEC.state.schema,
            global: {
              ints: 99,
              bytes: 0,
            },
          },
        },
      } as Arc56Contract;

      const pages: PageConfig[] = [
        { spec: SETTER_SPEC as Arc56Contract, Client: MockAppClient as unknown as new (params: AppClientParams) => AppClient },
        { spec: incompatibleSpec, Client: MockAppClient as unknown as new (params: AppClientParams) => AppClient },
      ];

      expect(() => validatePages(pages)).toThrow("SetterSelfUpdatingPage");
      expect(() => validatePages(pages)).toThrow("DifferentName");
    });
  });

  describe("error messages", () => {
    it("should throw for missing state property", () => {
      const badSpec = {
        name: "BadSpec",
        // Missing state property
      } as Arc56Contract;

      const pages: PageConfig[] = [
        { spec: badSpec, Client: MockAppClient as unknown as new (params: AppClientParams) => AppClient },
      ];

      expect(() => validatePages(pages)).toThrow(/Missing 'state' in ARC56 spec/);
      expect(() => validatePages(pages)).toThrow(/BadSpec/);
    });

    it("should throw for missing schema property", () => {
      const badSpec = {
        name: "BadSpec",
        state: {
          // Missing schema
        },
      } as Arc56Contract;

      const pages: PageConfig[] = [
        { spec: badSpec as Arc56Contract, Client: MockAppClient as unknown as new (params: AppClientParams) => AppClient },
      ];

      expect(() => validatePages(pages)).toThrow(/Missing 'state.schema' in ARC56 spec/);
    });

    it("should throw for missing global schema", () => {
      const badSpec = {
        name: "BadSpec",
        state: {
          schema: {
            local: { ints: 0, bytes: 0 },
            // Missing global
          },
        },
      } as Arc56Contract;

      const pages: PageConfig[] = [
        { spec: badSpec as Arc56Contract, Client: MockAppClient as unknown as new (params: AppClientParams) => AppClient },
      ];

      expect(() => validatePages(pages)).toThrow(/Missing 'state.schema.global' in ARC56 spec/);
    });

    it("should throw for missing local schema", () => {
      const badSpec = {
        name: "BadSpec",
        state: {
          schema: {
            global: { ints: 2, bytes: 0 },
            // Missing local
          },
        },
      } as Arc56Contract;

      const pages: PageConfig[] = [
        { spec: badSpec as Arc56Contract, Client: MockAppClient as unknown as new (params: AppClientParams) => AppClient },
      ];

      expect(() => validatePages(pages)).toThrow(/Missing 'state.schema.local' in ARC56 spec/);
    });
  });
});
