# Generic Self-Updating Client: State Exposure

## Parent

- PRD: `.scratch/001-generic-self-updating-client.md`
- Depends on: `.scratch/004-generic-client-factory-single-page.md`

## What to build

Expose the shared `state` property on the client.

**State interface:**
```typescript
interface SelfUpdatingClientState<TBasePage> {
  global: TBasePage['state']['global'];
  box: TBasePage['state']['box'];
}

// Returned client now includes:
{
  send: SendMethods<TPages>;
  state: SelfUpdatingClientState<FirstPage>;
  appId: bigint;
  appAddress: Address;
}
```

**Usage:**
```typescript
const client = await createSelfUpdatingClient(...);

// Read global state (shared across all pages)
const globalState = await client.state.global.getAll();
const aValue = await client.state.global.aValue();

// Read box state
const pages = await client.state.box.pages.getMap();
```

Since all pages share the same state schema (validated in Slice 1), using the first page's state types is correct.

## Acceptance criteria

- [ ] `state` property exposed on returned client
- [ ] `state.global` has all getter methods from base page
- [ ] `state.box` has all getter methods from base page
- [ ] Integration test: set values via `send.setValues`, read via `state.global`
- [ ] Integration test: verify `state.global.aValue()` returns correct value
- [ ] Integration test: call different page method, verify state still accessible
- [ ] Integration test: box storage accessible via `state.box.pages.value(selector)`

## Blocked by

- `.scratch/004-generic-client-factory-single-page.md` (needs base client structure)
