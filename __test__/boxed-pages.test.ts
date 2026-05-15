import { beforeAll, describe, expect, it } from "vitest";
import { Orchestrator, PAGES } from "../src";
import { AlgorandClient, microAlgo } from "@algorandfoundation/algokit-utils";
import { SendingAddress } from "@algorandfoundation/algokit-utils/transact";

describe("Boxed pages", () => {
  describe("Static method calling", () => {
    let algorand: AlgorandClient;
    let client: Orchestrator;
    let sender: SendingAddress;

    beforeAll(async () => {
      algorand = AlgorandClient.defaultLocalNet();
      sender = await algorand.account.dispenserFromEnvironment();

      client = await Orchestrator.create(algorand, sender, {
        globalNumUint: 2,
      });
    });

    it("setValues should be callable", async () => {
      await client.staticSend.setValues({
        sender,
        extraFee: microAlgo(2000),
        args: { a: 2, b: 3 },
      });

      const globalState = await client.state.global.getAll();
      expect(globalState).toEqual({ aValue: 2n, bValue: 3n });

      const approvalProgram = (
        await algorand.app.getById(client.logicAppClient.appId)
      ).approvalProgram;

      expect(Buffer.from(approvalProgram)).toEqual(PAGES.setValues);
    });

    it("getSum should be callable", async () => {
      const res = await client.staticSend.getSum({
        sender,
        args: {},
        extraFee: microAlgo(2000),
      });

      expect(res.return).toEqual(5n);

      const approvalProgram = (
        await algorand.app.getById(client.logicAppClient.appId)
      ).approvalProgram;

      expect(Buffer.from(approvalProgram)).toEqual(PAGES.getSum);
    });

    it("getProduct should be callable", async () => {
      const res = await client.staticSend.getProduct({
        sender,
        args: {},
        extraFee: microAlgo(2000),
      });

      expect(res.return).toEqual(6n);

      const approvalProgram = (
        await algorand.app.getById(client.logicAppClient.appId)
      ).approvalProgram;

      expect(Buffer.from(approvalProgram)).toEqual(PAGES.getProduct);
    });
  });
});
