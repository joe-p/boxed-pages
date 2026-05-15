import {
  BoxMap,
  bytes,
  Contract,
  assert,
  Global,
  Application,
  GlobalState,
  itxn,
  uint64,
  Txn,
  TransactionType,
} from "@algorandfoundation/algorand-typescript";
import { compileArc4 } from "@algorandfoundation/algorand-typescript/arc4";
import { ITxnCreate } from "@algorandfoundation/algorand-typescript/op";

function assertCaller() {
  assert(Global.callerApplicationAddress === Global.creatorAddress);
}

export class PageBase extends Contract {
  aValue = GlobalState<uint64>();
  bValue = GlobalState<uint64>();

  updateApplication() {
    assertCaller();
  }
}

export class SetterPage extends PageBase {
  setValues(a: uint64, b: uint64) {
    assert(!this.aValue.hasValue && !this.bValue.hasValue);
    this.aValue.value = a;
    this.aValue.value = b;
  }
}

export class SumPage extends PageBase {
  getSum(): uint64 {
    return this.aValue.value + this.bValue.value;
  }
}

export class ProductPage extends PageBase {
  getProduct(): uint64 {
    return this.aValue.value * this.bValue.value;
  }
}

export class Orchestrator extends Contract {
  /**
   * Pages of logic that all share the same state
   *
   * Maps method selectors to AVM bytecode
   *
   * They MUST allow the orchestrator to update them. We could add this check
   * on-chain, but for now since we only allow the creator to define pages
   * we can presumably trust them
   */
  pages = BoxMap<bytes<4>, bytes>({ keyPrefix: "" });
  logicApp = GlobalState<Application>({ key: "a" });

  private _updateToPage() {
    this._dynamicUpdateToPage(Txn.applicationArgs(0).toFixed({ length: 4 }));
  }

  private _dynamicUpdateToPage(selector: bytes<4>) {
    const page = this.pages(selector).value;

    const base = compileArc4(PageBase);

    base.call.updateApplication({
      appId: this.logicApp.value,
      approvalProgram: page,
      clearStateProgram: base.clearStateProgram,
    });
  }

  createLogicApp(
    extraProgramPages: uint64,
    globalNumUint: uint64,
    globalNumBytes: uint64,
    localNumBytes: uint64,
    localNumUint: uint64,
  ) {
    assert(!this.logicApp.hasValue);
    const base = compileArc4(PageBase);

    const res = itxn
      .applicationCall({
        approvalProgram: base.approvalProgram,
        clearStateProgram: base.clearStateProgram,
        extraProgramPages,
        globalNumUint,
        globalNumBytes,
        localNumBytes,
        localNumUint,
      })
      .submit();

    this.logicApp.value = res.createdApp;
  }

  setPage(methodSelector: bytes<4>, pageOffset: uint64, page: bytes) {
    assert(Txn.sender === Global.creatorAddress);

    const pageBox = this.pages(methodSelector);
    const requiredSize: uint64 = page.length + pageOffset;

    if (!pageBox.exists) {
      pageBox.create({ size: requiredSize });
    } else if (pageBox.length < requiredSize) {
      pageBox.resize(requiredSize);
    }

    pageBox.replace(pageOffset, page);
  }

  // There are two ways to do routing. The first of which is static routing which
  // just forwards the method selectors from the orchestrator to the logic app
  //
  // The second of which is dynamic which has the caller to the orchestrator specify
  // the method selector
  //
  // Static Routing
  //
  // Pros:
  //  * Can use the auto-generated client for the orchestrator for all app interactions
  //  * Contract is ABI type safe
  // Cons:
  //  * Additional methods require updates to the orchestrator
  //  * The orchestrator itself will eventually run into the max program size
  //
  // Dynamic Routing
  //
  // Pros:
  //  * Can have an unlimited number of possible pages
  //  * Orchestrator never has to update
  // Cons:
  //  * Not ABI safe in the contract
  //  * Must have special client-side logic for properly calling the app

  // Static Routing

  setValues(a: uint64, b: uint64): void {
    this._updateToPage();
    const page = compileArc4(SetterPage);
    page.call.setValues({ appId: this.logicApp.value, args: [a, b] });
  }

  getSum(): uint64 {
    this._updateToPage();
    const page = compileArc4(SumPage);
    return page.call.getSum({ appId: this.logicApp.value }).returnValue;
  }

  getProduct(): uint64 {
    this._updateToPage();
    const page = compileArc4(ProductPage);
    return page.call.getProduct({ appId: this.logicApp.value }).returnValue;
  }

  // Dynamic Routing

  callMethod(methodSelector: bytes<4>, args: bytes[]) {
    this._dynamicUpdateToPage(methodSelector);

    ITxnCreate.begin();
    ITxnCreate.setTypeEnum(TransactionType.ApplicationCall);
    ITxnCreate.setApplicationArgs(methodSelector);

    for (const arg of args) {
      ITxnCreate.setApplicationArgs(arg);
    }

    ITxnCreate.submit();
  }
}
