import { beforeAll, describe, expect, it } from "vitest";
import { createSelfUpdatingClient, PAGES } from "../src/self-updating";
import { AlgorandClient } from "@algorandfoundation/algokit-utils";
import { SendingAddress } from "@algorandfoundation/algokit-utils/transact";
import baseSpec from "../contracts/out/SelfUpdatingBase.arc56.json";
import { SetterSelfUpdatingPageClient } from "../contracts/clients/SetterSelfUpdatingPageClient.js";
import { SumSelfUpdatingPageClient } from "../contracts/clients/SumSelfUpdatingPageClient.js";
import { ProductSelfUpdatingPageClient } from "../contracts/clients/ProductSelfUpdatingPageClient.js";
import SETTER_SPEC from "../contracts/out/SetterSelfUpdatingPage.arc56.json";
import SUM_SPEC from "../contracts/out/SumSelfUpdatingPage.arc56.json";
import PRODUCT_SPEC from "../contracts/out/ProductSelfUpdatingPage.arc56.json";
import { getABIMethod } from "@algorandfoundation/algokit-utils/abi";

describe("self-updating client", () => {
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

  it("should match the base page size snapshot", async () => {
    const bytes = Buffer.from(baseSpec.byteCode.approval, "base64");
    expect(bytes.length).toMatchSnapshot();
  });

  it("should deploy app and register pages", async () => {
    // Verify the app was created
    expect(client.appId).toBeGreaterThan(0n);

    // Verify each page is stored using value() method
    const setValuesSelector = getABIMethod("setValues", client.baseClient.appSpec).getSelector();
    const getSumSelector = getABIMethod("getSum", client.baseClient.appSpec).getSelector();
    const getProductSelector = getABIMethod("getProduct", client.baseClient.appSpec).getSelector();

    const setValuesPage = await client.state.box.pages.value(setValuesSelector);
    const getSumPage = await client.state.box.pages.value(getSumSelector);
    const getProductPage =
      await client.state.box.pages.value(getProductSelector);

    expect(setValuesPage).toBeDefined();
    expect(getSumPage).toBeDefined();
    expect(getProductPage).toBeDefined();

    // Verify the page content matches
    expect(Buffer.from(setValuesPage!)).toEqual(PAGES.setValues);
    expect(Buffer.from(getSumPage!)).toEqual(PAGES.getSum);
    expect(Buffer.from(getProductPage!)).toEqual(PAGES.getProduct);
  });

  it("should expose underlying baseClient as escape hatch", () => {
    expect(client.baseClient).toBeDefined();
    expect(client.baseClient.appId).toBeGreaterThan(0n);
    expect(client.baseClient.appAddress).toBeDefined();
  });

  it("send.setValues should set initial values and update to setValues page", async () => {
    await client.send.setValues({
      sender,
      args: { a: 2, b: 3 },
    });

    const globalState = await client.state.global.getAll();
    expect(globalState).toEqual({ aValue: 2n, bValue: 3n });

    const { approvalProgram } = await client.baseClient.algorand.app.getById(
      client.appId,
    );

    expect(Buffer.from(approvalProgram)).toEqual(PAGES.setValues);
  });

  it("send.getSum should return sum and update to getSum page", async () => {
    // Values were already set by previous test
    const result = await client.send.getSum({ sender, args: [] });

    expect(result.return).toEqual(5n);

    const { approvalProgram } = await client.baseClient.algorand.app.getById(
      client.appId,
    );

    expect(Buffer.from(approvalProgram)).toEqual(PAGES.getSum);
  });

  it("send.getProduct should return product and update to getProduct page", async () => {
    // Values are still set from earlier tests
    const result = await client.send.getProduct({ sender, args: [] });

    expect(result.return).toEqual(6n);

    const { approvalProgram } = await client.baseClient.algorand.app.getById(
      client.appId,
    );

    expect(Buffer.from(approvalProgram)).toEqual(PAGES.getProduct);
  });
});
