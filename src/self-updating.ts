import { SendingAddress } from "@algorandfoundation/algokit-utils/transact";
import { ReadableAddress } from "@algorandfoundation/algokit-utils";
import {
  VirtualSelfUpdatingAppClient,
  VirtualSelfUpdatingAppFactory,
} from "../contracts/clients/VirtualSelfUpdatingAppClient.ts";
import { SetterSelfUpdatingPageClient } from "../contracts/clients/SetterSelfUpdatingPageClient.ts";
import { SumSelfUpdatingPageClient } from "../contracts/clients/SumSelfUpdatingPageClient.ts";
import { ProductSelfUpdatingPageClient } from "../contracts/clients/ProductSelfUpdatingPageClient.ts";

import { AlgorandClient, microAlgo } from "@algorandfoundation/algokit-utils";
import { getABIMethod } from "@algorandfoundation/algokit-utils/abi";

import SETTER_SPEC from "../contracts/out/SetterSelfUpdatingPage.arc56.json";
import SUM_SPEC from "../contracts/out/SumSelfUpdatingPage.arc56.json";
import PRODUCT_SPEC from "../contracts/out/ProductSelfUpdatingPage.arc56.json";

export const PAGES = {
  setValues: Buffer.from(SETTER_SPEC.byteCode.approval, "base64"),
  getSum: Buffer.from(SUM_SPEC.byteCode.approval, "base64"),
  getProduct: Buffer.from(PRODUCT_SPEC.byteCode.approval, "base64"),
} as const;

export type Schema = {
  extraProgramPages?: number;
  globalNumBytes?: number;
  globalNumUint?: number;
  localNumBytes?: number;
  localNumUint?: number;
};

export class SelfUpdatingClient {
  appClient: VirtualSelfUpdatingAppClient;

  get state() {
    return this.appClient.state;
  }

  private constructor(appClient: VirtualSelfUpdatingAppClient) {
    this.appClient = appClient;
  }

  static async create(
    algorand: AlgorandClient,
    sender: SendingAddress,
    schema?: Schema,
  ) {
    const factory = algorand.client.getTypedAppFactory(
      VirtualSelfUpdatingAppFactory,
      {},
    );

    const { appClient } = await factory.send.create.bare({ sender });

    const client = new SelfUpdatingClient(appClient);
    await client.initialize(sender, schema);

    return client;
  }

  getSelector(methodName: keyof typeof PAGES) {
    const abiMethod = getABIMethod(
      methodName,
      this.appClient.appSpec,
    );
    return abiMethod.getSelector();
  }

  getArgs(methodName: keyof typeof PAGES) {
    return {
      methodSelector: this.getSelector(methodName),
      pageOffset: 0,
      page: PAGES[methodName],
    };
  }

  async initialize(sender: SendingAddress, _schema?: Schema) {
    const group = this.appClient.newGroup();

    group.addTransaction(
      await this.appClient.algorand.createTransaction.payment({
        sender,
        receiver: this.appClient.appAddress,
        amount: microAlgo(408100),
      }),
    );

    for (const methodName of Object.keys(PAGES)) {
      group.setPage({
        sender,
        args: this.getArgs(methodName as keyof typeof PAGES),
        extraFee: microAlgo(2000),
      });
    }

    await group.send();
  }

  private async getUpdateTransaction(
    sender: NonNullable<ReadableAddress>,
    methodName: keyof typeof PAGES,
  ) {
    // Create a page-specific client to get the correct bytecode for the update
    const pageClient =
      methodName === "setValues"
        ? new SetterSelfUpdatingPageClient({
            algorand: this.appClient.algorand,
            appId: this.appClient.appId,
          })
        : methodName === "getSum"
          ? new SumSelfUpdatingPageClient({
              algorand: this.appClient.algorand,
              appId: this.appClient.appId,
            })
          : new ProductSelfUpdatingPageClient({
              algorand: this.appClient.algorand,
              appId: this.appClient.appId,
            });

    return await pageClient.createTransaction.update.updateApplication({
      sender,
      args: { selector: this.getSelector(methodName) },
    });
  }

  send = {
    setValues: async (
      params: Parameters<
        VirtualSelfUpdatingAppClient["send"]["setValues"]
      >[0],
    ) => {
      const group = this.appClient.newGroup();

      // Add update transaction using the page-specific client to get correct bytecode
      group.addTransaction(
        (await this.getUpdateTransaction(params.sender!, "setValues"))
          .transactions[0],
      );

      group.setValues(params);

      const result = await group.send();
      return { ...result, return: result.returns[0] as void };
    },

    getSum: async (
      params: Parameters<
        VirtualSelfUpdatingAppClient["send"]["getSum"]
      >[0] = { args: [] },
    ) => {
      const group = this.appClient.newGroup();

      group.addTransaction(
        (await this.getUpdateTransaction(params.sender!, "getSum")).transactions[0],
      );

      group.getSum(params);

      const result = await group.send();
      return { ...result, return: result.returns[0] as bigint };
    },

    getProduct: async (
      params: Parameters<
        VirtualSelfUpdatingAppClient["send"]["getProduct"]
      >[0] = { args: [] },
    ) => {
      const group = this.appClient.newGroup();

      group.addTransaction(
        (await this.getUpdateTransaction(params.sender!, "getProduct"))
          .transactions[0],
      );

      group.getProduct(params);

      const result = await group.send();
      return { ...result, return: result.returns[0] as bigint };
    },
  };
}
