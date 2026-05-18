import type { SendingAddress } from "@algorandfoundation/algokit-utils/transact";
import {
  OrchestratorClient,
  OrchestratorFactory,
} from "../contracts/clients/OrchestratorClient.js";
import { VirtualLogicAppClient } from "../contracts/clients/VirtualLogicAppClient.js";

import { AlgorandClient, microAlgo } from "@algorandfoundation/algokit-utils";
import { getABIMethod } from "@algorandfoundation/algokit-utils/abi";

import SETTER_SPEC from "../contracts/out/SetterPage.arc56.json" with { type: "json" };
import SUM_SPEC from "../contracts/out/SumPage.arc56.json" with { type: "json" };
import PRODUCT_SPEC from "../contracts/out/ProductPage.arc56.json" with { type: "json" };

import assert from "node:assert";

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

export class Orchestrator {
  orchestratorAppClient: OrchestratorClient;
  logicAppClient!: VirtualLogicAppClient;

  get state() {
    return this.logicAppClient.state;
  }

  private constructor(algorand: AlgorandClient, appId: bigint) {
    this.orchestratorAppClient = algorand.client.getTypedAppClientById(
      OrchestratorClient,
      {
        appId,
      },
    );
  }

  static async create(
    algorand: AlgorandClient,
    sender: SendingAddress,
    schema?: Schema,
  ) {
    const factory = algorand.client.getTypedAppFactory(OrchestratorFactory, {});

    const { appClient } = await factory.send.create.bare({ sender });

    const orchestrator = new Orchestrator(algorand, appClient.appId);
    await orchestrator.initialize(sender, schema);

    const logicAppId = await appClient.state.global.logicApp();

    assert(logicAppId, "logic app ID should be set already");

    orchestrator.logicAppClient = algorand.client.getTypedAppClientById(
      VirtualLogicAppClient,
      { appId: logicAppId },
    );

    return orchestrator;
  }

  getSelector(methodName: keyof typeof PAGES) {
    const abiMethod = getABIMethod(
      methodName,
      this.orchestratorAppClient.appSpec,
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

  async initialize(sender: SendingAddress, schema?: Schema) {
    const group = this.orchestratorAppClient.newGroup();

    group.addTransaction(
      await this.orchestratorAppClient.algorand.createTransaction.payment({
        sender,
        receiver: this.orchestratorAppClient.appAddress,
        amount: microAlgo(408100),
      }),
    );

    group.createLogicApp({
      sender,
      args: {
        extraProgramPages: schema?.extraProgramPages ?? 0,
        globalNumBytes: schema?.globalNumBytes ?? 0,
        globalNumUint: schema?.globalNumUint ?? 0,
        localNumBytes: schema?.localNumBytes ?? 0,
        localNumUint: schema?.localNumUint ?? 0,
      },
      extraFee: microAlgo(1000),
    });
    for (const methodName of Object.keys(PAGES)) {
      group.setPage({
        sender,
        args: this.getArgs(methodName as keyof typeof PAGES),
      });
    }

    await group.send();
  }

  async updateToPageTxn(
    sender: SendingAddress,
    methodName: keyof typeof PAGES,
  ) {
    return await this.orchestratorAppClient.createTransaction.updateToPage({
      sender,
      args: { selector: this.getSelector(methodName) },
    });
  }
}
