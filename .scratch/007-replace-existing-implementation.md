# Generic Self-Updating Client: Replace Existing Implementation

## Parent

- PRD: `.scratch/001-generic-self-updating-client.md`
- Depends on: `.scratch/005-multi-page-client-automatic-swapping.md`, `.scratch/006-state-exposure.md`

## What to build

Replace the hardcoded `SelfUpdatingClient` with the generic implementation.

**Changes to make:**
1. Replace `src/self-updating.ts` with new generic implementation
2. Export `createSelfUpdatingClient` factory function
3. Export `PageConfig` type for consumers
4. Export `Schema` type (keep existing export for compatibility)
5. Remove hardcoded `PAGES` constant (no longer needed externally)
6. Remove `SelfUpdatingClient` class

**Test updates:**
1. Update `__test__/self-updating.test.ts` to import from new API
2. Replace class instantiation with factory function call
3. Use new page configuration format
4. Verify all test behaviors remain the same:
   - App creation
   - Page registration
   - Method calls with swapping
   - State persistence
   - Return values

**No breaking changes to test expectations:**
- Tests should still verify the same external behaviors
- State changes should work the same
- Bytecode swapping should work the same
- Return values should be identical

## Acceptance criteria

- [ ] `src/self-updating.ts` replaced with generic implementation
- [ ] `createSelfUpdatingClient` exported as main API
- [ ] `PageConfig` type exported
- [ ] `Schema` type still exported
- [ ] Hardcoded `PAGES` constant no longer exported
- [ ] `SelfUpdatingClient` class removed
- [ ] `__test__/self-updating.test.ts` updated to use new API
- [ ] All existing tests pass without modification to test expectations
- [ ] No regressions in functionality
- [ ] TypeScript compilation succeeds

## Blocked by

- `.scratch/005-multi-page-client-automatic-swapping.md` (needs full multi-page support)
- `.scratch/006-state-exposure.md` (needs state property)
