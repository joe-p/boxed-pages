# Generic Self-Updating Client: Page Swap Transaction Builder

## Parent

- PRD: `.scratch/001-generic-self-updating-client.md`
- Depends on: `.scratch/002-schema-validation-foundation.md`

## What to build

Create the transaction builder deep module that generates page swap transactions.

**Core function:**
```typescript
async function buildSwapTransaction(
  algorand: AlgorandClient,
  targetPage: PageConfig,
  appId: bigint,
  sender: SendingAddress
): Promise<Transaction> {
  // 1. Instantiate target page client with current appId
  // 2. Get method selector from page spec
  // 3. Call pageClient.createTransaction.update.updateApplication({ selector })
  // 4. Return the transaction from the result
}
```

**Method selector extraction:**
```typescript
function getMethodSelector(
  pageSpec: Arc56Contract,
  methodName: string
): Uint8Array {
  // Extract selector from ARC56 methods array
  // Handle ABI method signature parsing
}
```

This module encapsulates the complex logic of:
- Determining the method selector from ARC56 spec
- Creating the update transaction via the page client
- Handling transaction composition

This slice only builds the transaction - it doesn't send it. Integration with the client happens in later slices.

## Acceptance criteria

- [ ] `buildSwapTransaction()` function implemented
- [ ] `getMethodSelector()` helper implemented
- [ ] Unit tests with mocked AlgorandClient: verify correct transaction structure
- [ ] Unit tests: verify method selector extraction for setValues, getSum, getProduct
- [ ] Unit tests: verify page client is instantiated with correct appId
- [ ] Error handling for missing methods in spec
- [ ] Types exported for use by client factory slice

## Blocked by

- `.scratch/002-schema-validation-foundation.md` (needs PageConfig types)
