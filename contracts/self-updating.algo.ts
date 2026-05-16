import {
  BoxMap,
  bytes,
  Contract,
  assert,
  Global,
  GlobalState,
  uint64,
  Txn,
} from "@algorandfoundation/algorand-typescript";
import { classes } from "polytype";

export class SelfUpdatingBase extends Contract {
  /**
   * Pages of logic that all share the same state in this app
   *
   * Maps method selectors to AVM bytecode
   */
  pages = BoxMap<bytes<4>, bytes>({ keyPrefix: "" });

  aValue = GlobalState<uint64>();
  bValue = GlobalState<uint64>();

  updateApplication(selector: bytes<4>) {
    const page = this.pages(selector).value;

    assert(Txn.approvalProgram === page);
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
}

export class SetterSelfUpdatingPage extends SelfUpdatingBase {
  setValues(a: uint64, b: uint64) {
    assert(!this.aValue.hasValue && !this.bValue.hasValue);
    this.aValue.value = a;
    this.bValue.value = b;
  }
}

export class SumSelfUpdatingPage extends SelfUpdatingBase {
  getSum(): uint64 {
    return this.aValue.value + this.bValue.value;
  }
}

export class ProductSelfUpdatingPage extends SelfUpdatingBase {
  getProduct(): uint64 {
    return this.aValue.value * this.bValue.value;
  }
}

export class VirtualSelfUpdatingApp extends classes(
  SetterSelfUpdatingPage,
  SumSelfUpdatingPage,
  ProductSelfUpdatingPage,
) {}
