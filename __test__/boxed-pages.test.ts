import { beforeAll, describe, expect, it } from "vitest";
import { Orchestrator, PAGES } from "../src/orchestrator";
import { AlgorandClient, microAlgo } from "@algorandfoundation/algokit-utils";
import { SendingAddress } from "@algorandfoundation/algokit-utils/transact";

const assertions = {
  async setValues(client: Orchestrator) {
    const globalState = await client.state.global.getAll();
    expect(globalState).toEqual({ aValue: 2n, bValue: 3n });

    const { approvalProgram } =
      await client.logicAppClient.algorand.app.getById(
        client.logicAppClient.appId,
      );

    expect(Buffer.from(approvalProgram)).toEqual(PAGES.setValues);
  },
  async getSum(client: Orchestrator, returnValue: bigint | undefined) {
    expect(returnValue).toEqual(5n);

    const { approvalProgram } =
      await client.logicAppClient.algorand.app.getById(
        client.logicAppClient.appId,
      );

    expect(Buffer.from(approvalProgram)).toEqual(PAGES.getSum);
  },
  async getProduct(client: Orchestrator, returnValue: bigint | undefined) {
    expect(returnValue).toEqual(6n);

    const { approvalProgram } =
      await client.logicAppClient.algorand.app.getById(
        client.logicAppClient.appId,
      );

    expect(Buffer.from(approvalProgram)).toEqual(PAGES.getProduct);
  },
};

describe("boxed pages", () => {
  describe("static method calling", () => {
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

    it("setValues should work", async () => {
      await client.orchestratorAppClient.send.setValues({
        sender,
        extraFee: microAlgo(2000),
        args: { a: 2, b: 3 },
      });

      await assertions.setValues(client);
    });

    it("getSum should work", async () => {
      const res = await client.orchestratorAppClient.send.getSum({
        sender,
        args: {},
        extraFee: microAlgo(2000),
      });

      assertions.getSum(client, res.return);
    });

    it("getProduct should work", async () => {
      const res = await client.orchestratorAppClient.send.getProduct({
        sender,
        args: {},
        extraFee: microAlgo(2000),
      });

      assertions.getProduct(client, res.return);
    });
  });

  describe("external method calling", () => {
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

    it("setValues should work", async () => {
      await client.logicAppClient
        .newGroup()
        .addTransaction(
          (await client.updateToPageTxn(sender, "setValues")).transactions[0],
        )
        .setValues({
          sender,
          extraFee: microAlgo(2000),
          args: { a: 2, b: 3 },
        })
        .send();

      await assertions.setValues(client);
    });

    it("getSum should work", async () => {
      const res = await client.logicAppClient
        .newGroup()
        .addTransaction(
          (await client.updateToPageTxn(sender, "getSum")).transactions[0],
        )
        .getSum({
          sender,
          extraFee: microAlgo(2000),
          args: [],
        })
        .send();

      await assertions.getSum(client, res.returns[0]);
    });

    it("getProduct should work", async () => {
      const res = await client.logicAppClient
        .newGroup()
        .addTransaction(
          (await client.updateToPageTxn(sender, "getProduct")).transactions[0],
        )
        .getProduct({
          sender,
          extraFee: microAlgo(2000),
          args: [],
        })
        .send();

      await assertions.getProduct(client, res.returns[0]);
    });
  });
});
