import { beforeAll, describe, expect, it } from "vitest";
import { SelfUpdatingClient, PAGES } from "../src/self-updating";
import { AlgorandClient } from "@algorandfoundation/algokit-utils";
import { SendingAddress } from "@algorandfoundation/algokit-utils/transact";

describe("self-updating client", () => {
  describe("core functionality", () => {
    let algorand: AlgorandClient;
    let client: SelfUpdatingClient;
    let sender: SendingAddress;

    beforeAll(async () => {
      algorand = AlgorandClient.defaultLocalNet();
      sender = await algorand.account.dispenserFromEnvironment();

      client = await SelfUpdatingClient.create(algorand, sender, {
        globalNumUint: 2,
      });
    });

    it("should deploy app and register pages", async () => {
      // Verify the app was created
      expect(client.appClient.appId).toBeGreaterThan(0n);

      // Verify each page is stored using value() method
      const setValuesSelector = client.getSelector("setValues");
      const getSumSelector = client.getSelector("getSum");
      const getProductSelector = client.getSelector("getProduct");

      const setValuesPage = await client.state.box.pages.value(setValuesSelector);
      const getSumPage = await client.state.box.pages.value(getSumSelector);
      const getProductPage = await client.state.box.pages.value(getProductSelector);

      expect(setValuesPage).toBeDefined();
      expect(getSumPage).toBeDefined();
      expect(getProductPage).toBeDefined();

      // Verify the page content matches
      expect(Buffer.from(setValuesPage!)).toEqual(PAGES.setValues);
      expect(Buffer.from(getSumPage!)).toEqual(PAGES.getSum);
      expect(Buffer.from(getProductPage!)).toEqual(PAGES.getProduct);
    });

    it("should expose underlying appClient as escape hatch", () => {
      expect(client.appClient).toBeDefined();
      expect(client.appClient.appId).toBeGreaterThan(0n);
      expect(client.appClient.appAddress).toBeDefined();
    });

    it("send.setValues should set initial values and update to setValues page", async () => {
      await client.send.setValues({
        sender,
        args: { a: 2, b: 3 },
      });

      const globalState = await client.state.global.getAll();
      expect(globalState).toEqual({ aValue: 2n, bValue: 3n });

      const { approvalProgram } =
        await client.appClient.algorand.app.getById(client.appClient.appId);

      expect(Buffer.from(approvalProgram)).toEqual(PAGES.setValues);
    });

    it("send.getSum should return sum and update to getSum page", async () => {
      // Values were already set by previous test
      const result = await client.send.getSum({ sender, args: [] });

      expect(result.return).toEqual(5n);

      const { approvalProgram } =
        await client.appClient.algorand.app.getById(client.appClient.appId);

      expect(Buffer.from(approvalProgram)).toEqual(PAGES.getSum);
    });

    it("send.getProduct should return product and update to getProduct page", async () => {
      // Values are still set from earlier tests
      const result = await client.send.getProduct({ sender, args: [] });

      expect(result.return).toEqual(6n);

      const { approvalProgram } =
        await client.appClient.algorand.app.getById(client.appClient.appId);

      expect(Buffer.from(approvalProgram)).toEqual(PAGES.getProduct);
    });
  });
});
