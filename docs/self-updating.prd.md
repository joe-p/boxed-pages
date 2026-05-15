## Problem Statement

The boxed-pages project currently has an `Orchestrator` client that manages an orchestrator app + logic app pattern. However, the project also includes a self-updating contract (`VirtualSelfUpdatingApp`) where a single app stores its own pages in boxes and updates itself before calling methods. This pattern requires users to manually build transaction groups—first calling `updateApplication` to switch to the correct page, then calling the actual method. This is error-prone and verbose compared to the convenience provided by the `Orchestrator` client.

Users need a high-level client (`SelfUpdatingClient`) that abstracts away the update-and-call pattern, providing a clean `send.*` interface similar to standard AlgoKit app clients.

## Solution

Create a `SelfUpdatingClient` class that:

- Wraps the generated `VirtualSelfUpdatingAppClient`
- Handles initialization (deploy + `setPage` calls for all pages)
- Exposes a `send` interface with methods (`setValues`, `getSum`, `getProduct`) that automatically build transaction groups containing the update call followed by the method call
- Mirrors the `Orchestrator` class patterns for consistency

## User Stories

1. As a developer using the self-updating contract, I want a client that automatically handles the update-then-call pattern, so that I don't need to manually build transaction groups.
1. As a developer, I want to create and initialize a self-updating app with a single static method call, so that I don't need to manually call `setPage` for each page.
1. As a developer, I want to call business methods (`setValues`, `getSum`, `getProduct`) without knowing about page selectors, so that my code remains clean and focused on business logic.
1. As a developer, I want the client to mirror the `Orchestrator` pattern, so that I can easily switch between orchestrator and self-updating patterns without learning new APIs.
1. As a developer, I want to access the underlying `VirtualSelfUpdatingAppClient` for advanced use cases, so that I have an escape hatch when needed.
1. As a developer, I want the client to handle extra fees automatically, so that transactions don't fail due to insufficient fees.

## Implementation Decisions

**Deep Module: SelfUpdatingClient**

The `SelfUpdatingClient` is a deep module that encapsulates:

- Page bytecode management (importing from ARC-56 specs)
- Method selector extraction using `getABIMethod`
- Transaction group construction (update + call)
- State access delegation to the underlying client

**Interface Design:**

```typescript
class SelfUpdatingClient {
  appClient: VirtualSelfUpdatingAppClient;
  
  static async create(algorand, sender, schema?): Promise<SelfUpdatingClient>;
  
  getSelector(methodName: keyof typeof PAGES): Uint8Array;
  getArgs(methodName: keyof typeof PAGES): SetPageArgs;
  
  send: {
    setValues(params): Promise<CallResult>;
    getSum(params): Promise<CallResult>;
    getProduct(params): Promise<CallResult>;
  };
  
  get state(): { global: { getAll(): Promise<State> } };
}
```

**Key Patterns to Mirror from Orchestrator:**

- `getSelector(methodName)` - extracts ABI method selector
- `getArgs(methodName)` - constructs `setPage` arguments
- `initialize(sender, schema)` - handles payment, creation, and page registration
- Static `create()` factory method

**Transaction Group Pattern:**
Each convenience method (`send.setValues`, `send.getSum`, `send.getProduct`) builds a group:

1. `updateApplication(selector)` - switches app to the correct page bytecode
1. Actual method call (`setValues`, `getSum`, or `getProduct`)

The group must use `OnApplicationComplete.UpdateApplication` for the first call, then `NoOp` for the second.

**Page Bytecode Source:**
Import from `contracts/out/*SelfUpdatingPage.arc56.json` files and extract `byteCode.approval`. Create a `PAGES` constant mapping simple method names to buffers.

**Initialization Flow:**

1. Create app via `VirtualSelfUpdatingAppFactory.send.create.bare()`
1. Add payment transaction to fund the app
1. Call `setPage` for each page (`setValues`, `getSum`, `getProduct`) to populate the `pages` box map

**Extra Fee Handling:**
Each `send.*` method must include an `extraFee` parameter (like `microAlgo(2000)`) to cover the additional update transaction cost.

## Testing Decisions

**Good Test Criteria:**
Tests should verify external behavior (transaction group structure, state changes, return values) not internal implementation details.

**Test Modules:**

1. **SelfUpdatingClient creation** - verify app is deployed and pages are set correctly
1. **Send methods** - verify each method (`setValues`, `getSum`, `getProduct`) correctly:
   - Returns expected values
   - Updates global state appropriately
   - Changes approval program to correct page
1. **State access** - verify `state.global.getAll()` returns expected values

**Prior Art:**

- `__test__/boxed-pages.test.ts` contains similar tests for `Orchestrator` class
- Pattern: Use `beforeAll` to create client, then test individual methods

## Out of Scope

- Dynamic or static calling patterns (only external calling is implemented)
- `newGroup()` builder pattern for manual group construction (only `send.*` convenience methods)
- Update to page functionality beyond initial `setValues`, `getSum`, `getProduct`
- Reconnection to existing self-updating apps (only `create()` is supported initially)

## Further Notes

The `VirtualSelfUpdatingAppClient` is auto-generated from the ARC-56 spec. Any changes to the contract will require regenerating clients via `npm run build:clients`.

The `SelfUpdatingBase` in the contract has a `setPage` method that is only callable by the creator. The `initialize` method should use the `sender` as the creator for all `setPage` calls.

______________________________________________________________________

**Ready for implementation. Shall I proceed with writing the code?**
