# Generic Self-Updating Client

**Status:** ready-for-agent  
**Created:** 2026-05-18  
**Labels:** enhancement, ready-for-agent

---

## Problem Statement

The current `SelfUpdatingClient` implementation is hardcoded to work with exactly three specific pages (`SetterSelfUpdatingPage`, `SumSelfUpdatingPage`, `ProductSelfUpdatingPage`). This makes it impossible to reuse the self-updating pattern with different page combinations without modifying the source code. Developers need a generic, configurable client that can work with any set of self-updating pages while maintaining full TypeScript type safety.

## Solution

Create a generic self-updating client factory that accepts a configuration object mapping method names to page specifications. The factory will:

1. Create the base self-updating app using the first page's bytecode
2. Register all pages with the app
3. Return a type-safe client where `send` methods automatically handle page swapping
4. Expose shared state access
5. Validate that all pages have compatible state schemas at runtime

The API will feel like using a regular app client — the page swapping happens transparently.

## User Stories

1. As a developer, I want to create a self-updating client with a simple configuration object, so that I can define my pages declaratively without modifying library code.

2. As a developer, I want TypeScript to infer the exact argument and return types for each page method, so that I get compile-time type checking and autocompletion.

3. As a developer, I want the client to automatically handle page bytecode swapping when I call different methods, so that I don't need to manage the update transactions manually.

4. As a developer, I want access to the shared global and box state, so that I can read values that persist across page swaps.

5. As a developer, I want the client to throw an error if two pages have the same method name, so that I catch naming conflicts at build time.

6. As a developer, I want the client to validate that all pages have compatible state schemas, so that I don't encounter runtime state corruption errors.

7. As a developer, I want the returned values from send methods to match exactly what the underlying page methods return, so that I don't need to unwrap or transform results.

8. As a developer, I want the API to follow the same patterns as AlgoKit app clients (params/send/state structure), so that it feels familiar and consistent.

9. As a developer, I want to pass just the ARC56 spec and Client class for each page, so that the client has all the information it needs without redundant configuration.

10. As a developer, I want clear error messages when page configuration is invalid, so that I can quickly diagnose configuration issues.

## Implementation Decisions

### Factory Function Pattern

The client will be created via a factory function rather than a class constructor. This allows TypeScript to properly infer the return type from the configuration object:

```typescript
const client = await createSelfUpdatingClient(algorand, sender, {
  setValues: { spec: SETTER_SPEC, Client: SetterSelfUpdatingPageClient },
  getSum: { spec: SUM_SPEC, Client: SumSelfUpdatingPageClient },
});
```

The configuration object keys become the method names on `client.send`.

### Page Configuration Structure

Each page in the configuration requires:
- `spec`: The ARC56 contract specification (imported JSON)
- `Client`: The generated AlgoKit client class for that page

The ARC56 spec provides the bytecode and method metadata. The Client class provides the `createTransaction.update.updateApplication` method needed to generate swap transactions.

### Base App Creation

The first page in the configuration serves as the base app:
- Its bytecode is used for initial app creation
- Its state schema defines the shared state
- All subsequent pages must have compatible schemas

This decision was made because all pages in a self-updating app share the same underlying state. Using any page as the base works as long as schemas match.

### Method Name Collision Detection

If two pages define the same method name, TypeScript will produce a compilation error. This is enforced by the mapped type definition:

```typescript
type SendMethods<TPages> = {
  [K in keyof TPages]: /* method signature */
}
```

Duplicate keys in the configuration object are a TypeScript error.

### Runtime Schema Validation

During client creation, the implementation will validate:
- All pages have identical `state.schema.global` (ints/bytes counts)
- All pages have identical `state.schema.local` 
- All pages define the same global state keys with compatible types

If validation fails, an error is thrown with details about the mismatch.

### Return Value Handling

Send methods return exactly what the underlying page client's `send` method returns. No wrapping or transformation. This preserves the full AlgoKit return type including:
- `return`: The ABI return value
- `transaction`: The transaction record
- `confirmation`: The transaction confirmation
- `returns`: Array of return values (for composed calls)

### State Access

The `state` property exposes the shared state using the first page's client types:
- `state.global`: Global state getters
- `state.box`: Box storage getters

Since all pages share state, using the first page's types is valid given the schema validation.

### Deep Module: Page Swap Transaction Builder

A deep module will be extracted for building the page swap transaction:

**Interface:**
```typescript
interface PageSwapTransactionBuilder {
  buildSwapTransaction(
    fromClient: AlgorandClient,
    targetPage: PageConfig,
    currentSelector: Uint8Array
  ): Promise<Transaction>
}
```

This encapsulates the complex logic of:
- Determining the method selector
- Creating the update transaction via the page client
- Handling transaction composition

This module can be tested independently with mock clients.

### Deep Module: Schema Validator

A schema validation module will validate page compatibility:

**Interface:**
```typescript
interface SchemaValidator {
  validatePages(pages: PageConfig[]): void;
}
```

Throws descriptive errors for:
- Global schema mismatches
- Local schema mismatches
- Key definition mismatches

## Testing Decisions

### What Makes a Good Test

Tests should verify external behavior, not implementation details:
- **Good:** Test that calling `send.setValues` updates state and changes bytecode
- **Bad:** Test that internal `getUpdateTransaction` is called with specific arguments
- **Good:** Test that method return values match expected types
- **Bad:** Test that specific transaction composer methods are invoked

### Modules to Test

**Priority 1: Integration Tests (similar to `self-updating.test.ts`)**
- Test the full client creation and method call flow
- Verify page swapping actually occurs
- Verify state persists across swaps
- Verify return values are correct

**Priority 2: Schema Validator (unit tests)**
- Test validation passes for compatible pages
- Test validation fails for incompatible global schemas
- Test validation fails for mismatched state keys
- Test error messages are descriptive

**Priority 3: Page Swap Transaction Builder (unit tests)**
- Test correct transaction is built for each page type
- Test method selector extraction
- Test transaction composition

### Prior Art

Existing tests in `__test__/self-updating.test.ts` provide the pattern:
- Uses `beforeAll` to create client
- Tests state changes after method calls
- Verifies bytecode changes after swaps
- Tests return values

These tests should be adapted to use the generic client instead of the hardcoded one.

## Out of Scope

1. **Orchestrator pattern support** — This PRD is specifically for self-updating apps (single app updates own bytecode). The orchestrator pattern (separate orchestrator + logic apps) is a different use case and should be handled separately.

2. **Dynamic page configuration** — Pages must be known at compile time for TypeScript to infer types correctly. Runtime page loading is not supported.

3. **Partial page compatibility** — We assume all pages have identical state schemas. Partial compatibility (e.g., shared subset of state) is not in scope.

4. **Migration from existing client** — This is a breaking change. The old `SelfUpdatingClient` class will be replaced, not deprecated gradually.

5. **ARC32 spec support** — Only ARC56 specs are supported, as they provide the full bytecode and structured method metadata needed.

## Further Notes

### Domain Terms

- **Self-Updating App**: An Algorand application that can mutate its own approval program bytecode during execution
- **Page**: A fragment of contract logic (complete bytecode) that can be loaded into a Self-Updating App
- **Page Set**: A collection of Pages that share state and can be swapped in/out at runtime
- **Page Swap**: The act of updating the app's approval program to a different Page's bytecode

### TypeScript Complexity

The implementation will require advanced TypeScript mapped types to:
- Extract method signatures from page client classes
- Build the union of all page methods on the `send` object
- Preserve return type information through the abstraction

Consider using type utilities from `@algorandfoundation/algokit-utils` where possible.

### Performance Considerations

Each method call involves:
1. One transaction to update app bytecode (swap)
2. One transaction to execute the method

This is inherent to the self-updating pattern and cannot be optimized away. Tests should reflect this 2-transaction overhead.

---

## Implementation Tasks

Based on the above decisions, the implementation should:

1. Create `createSelfUpdatingClient` factory function
2. Implement schema validation module
3. Implement page swap transaction builder module
4. Wire up `send` methods with proper typing
5. Expose `state` from base client
6. Replace existing `src/self-updating.ts` implementation
7. Update `__test__/self-updating.test.ts` to use new API
8. Verify all tests pass
