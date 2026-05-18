import SETTER_SPEC from "../contracts/out/SetterSelfUpdatingPage.arc56.json" with { type: "json" };
import SUM_SPEC from "../contracts/out/SumSelfUpdatingPage.arc56.json" with { type: "json" };
import PRODUCT_SPEC from "../contracts/out/ProductSelfUpdatingPage.arc56.json" with { type: "json" };

export type Schema = {
  extraProgramPages?: number;
  globalNumBytes?: number;
  globalNumUint?: number;
  localNumBytes?: number;
  localNumUint?: number;
};

export type { PageConfig, PageSet } from "./schema-validation.js";
export { createSelfUpdatingClient } from "./generic-client-factory.js";

/**
 * Page bytecode constants for backward compatibility with existing tests.
 * @internal
 */
export const PAGES = {
  setValues: Buffer.from(SETTER_SPEC.byteCode.approval, "base64"),
  getSum: Buffer.from(SUM_SPEC.byteCode.approval, "base64"),
  getProduct: Buffer.from(PRODUCT_SPEC.byteCode.approval, "base64"),
} as const;
