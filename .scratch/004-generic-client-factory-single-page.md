# Generic Self-Updating Client: Generic Client Factory (Single Page)

## Parent

- PRD: `.scratch/001-generic-self-updating-client.md`
- Depends on: `.scratch/002-schema-validation-foundation.md`

## What to build

Create the factory function that works with a single page. No swapping logic yet - just proves the type system works end-to-end.

**Factory function:**
```typescript
async function createSelfUpdatingClient<TPages extends PageSet>(
  algorand: AlgorandClient,
  sender: SendingAddress,
  pages: TPages
): Promise<{
  send: SendMethods<TPages>;
  appId: bigint;
  appAddress: Address;
}> {
  // 1. Validate pages (call validatePages from Slice 1)
  // 2. Create app using first page's bytecode
  // 3. Initialize with setPage for the single page
  // 4. Build typed send object
  // 5. Return client with send methods and app info
}
```

**Type definition:**
```typescript
type SendMethods<TPages> = {
  [K in keyof TPages]: TPages[K] extends PageConfig 
    ? (params: CallParams<ExtractArgs<TPages[K]>> & SendParams) => Promise<ExtractReturn<TPages[K]>>
    : never;
};
```

This slice proves the generic type system works. The send methods should be fully typed based on the page's ABI methods. Since there's only one page, no swapping is needed.

## Acceptance criteria

- [ ] `createSelfUpdatingClient()` factory function implemented
- [ ] `SendMethods` type extracts method signatures from page specs
- [ ] Integration test: create client with single page (Setter)
- [ ] Integration test: call `send.setValues()` with typed args
- [ ] Integration test: verify state is updated correctly
- [ ] Integration test: verify return value matches page client return type
- [ ] TypeScript compiles without errors
- [ ] `appId` and `appAddress` are accessible on returned client

## Blocked by

- `.scratch/002-schema-validation-foundation.md` (needs PageConfig types and validatePages)
