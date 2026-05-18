# Generic Self-Updating Client: Schema Validation Foundation

## Parent

- PRD: `.scratch/001-generic-self-updating-client.md`

## What to build

Create the schema validation deep module with full type definitions. This slice establishes the foundation for page configuration and validates page compatibility.

**Types to define:**
```typescript
interface PageConfig {
  spec: Arc56Contract;
  Client: new (params: AppClientParams) => AppClient;
}

interface PageSet {
  [key: string]: PageConfig;
}
```

**Validation function:**
```typescript
function validatePages(pages: PageConfig[]): void {
  // Verify all pages have identical state.schema.global (ints/bytes counts)
  // Verify all pages have identical state.schema.local
  // Verify all pages define the same global state keys with compatible types
  // Throw descriptive error on mismatch
}
```

**Error cases to handle:**
- Global schema mismatch (different int/byte counts)
- Local schema mismatch
- Missing or incompatible state keys
- Missing ARC56 metadata

This slice focuses only on validation logic and types. No transaction building or client creation yet.

## Acceptance criteria

- [ ] `PageConfig` and related types defined with proper TypeScript interfaces
- [ ] `validatePages()` function implemented with full schema comparison
- [ ] Unit tests: validation passes for three compatible pages (Setter, Sum, Product)
- [ ] Unit tests: validation fails for incompatible global schemas (different uint counts)
- [ ] Unit tests: validation fails for mismatched state keys
- [ ] Error messages include which pages conflict and what the mismatch is
- [ ] Types are exported and usable by other slices

## Blocked by

None - can start immediately
