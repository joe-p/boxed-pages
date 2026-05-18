# Generic Self-Updating Client: Multi-Page Client with Automatic Swapping

## Parent

- PRD: `.scratch/001-generic-self-updating-client.md`
- Depends on: `.scratch/003-page-swap-transaction-builder.md`, `.scratch/004-generic-client-factory-single-page.md`

## What to build

Extend the factory to support multiple pages with automatic page swapping.

**Enhanced send methods:**
```typescript
// Each send method now:
// 1. Builds swap transaction using buildSwapTransaction (Slice 2)
// 2. Adds swap transaction to composer
// 3. Adds actual method call to composer  
// 4. Sends both as atomic group
// 5. Returns the method call result

const client = await createSelfUpdatingClient(algorand, sender, {
  setValues: { spec: SETTER_SPEC, Client: SetterClient },
  getSum: { spec: SUM_SPEC, Client: SumClient },
  getProduct: { spec: PRODUCT_SPEC, Client: ProductClient }
});

// This triggers: swap to Setter page → call setValues
await client.send.setValues({ sender, args: { a: 2, b: 3 } });

// This triggers: swap to Sum page → call getSum
const result = await client.send.getSum({ sender, args: [] });
```

**Key behaviors:**
- Method name collisions detected at TypeScript level (duplicate keys in config object)
- Each method call is 2 transactions (swap + execute)
- Return types match underlying page method returns
- State persists across swaps

## Acceptance criteria

- [x] Factory supports multiple pages in configuration
- [x] Each `send` method composes swap + method call transactions
- [x] Integration test: call `setValues`, verify bytecode changes to Setter page
- [x] Integration test: call `getSum`, verify bytecode changes to Sum page
- [x] Integration test: call `getProduct`, verify bytecode changes to Product page
- [x] Integration test: state set by `setValues` persists when calling `getSum`
- [x] Integration test: `getSum` returns correct sum (proves state persisted)
- [x] TypeScript error if two pages have same method name (collision detection)
- [x] Each method returns exactly what the page client's send returns

## Implementation Summary

Updated `src/generic-client-factory.ts` to support automatic page swapping:

1. **Modified `buildSendMethods`**: Each send method now:
   - Builds swap transaction using `buildSwapTransaction` 
   - Adds swap transaction to composer
   - Adds actual method call to composer
   - Sends both as atomic group
   - Returns the method call result

2. **Added unique notes**: Added `generateRandomNote()` to `buildSwapTransaction` to ensure unique transaction IDs when running tests

3. **Created integration tests**: `__test__/multi-page-client.test.ts` with 9 tests:
   - Multi-page client creation
   - Page bytecode swapping verification for each page type
   - State persistence across page swaps
   - Return value verification
   - Transaction count verification

## Blocked by

- `.scratch/003-page-swap-transaction-builder.md` (needs buildSwapTransaction)
- `.scratch/004-generic-client-factory-single-page.md` (needs base factory)
