import type { Arc56Contract } from "@algorandfoundation/algokit-utils/abi";
import type { AppClient, AppClientParams } from "@algorandfoundation/algokit-utils/app-client";

/**
 * Configuration for a single page in a self-updating app.
 * Contains the ARC56 spec and the generated client class for the page.
 */
export interface PageConfig {
  /** The ARC56 contract specification (imported JSON) */
  spec: Arc56Contract;
  /**
   * The generated AlgoKit client class for this page.
   * Must have a constructor that takes AppClientParams.
   */
  Client: new (params: AppClientParams) => AppClient;
}

/**
 * A mapping of method names to page configurations.
 * Keys become the method names on the self-updating client.
 */
export interface PageSet {
  [key: string]: PageConfig;
}

/**
 * Schema information extracted from an ARC56 contract spec.
 */
interface SchemaInfo {
  globalInts: number;
  globalBytes: number;
  localInts: number;
  localBytes: number;
  globalKeys: Record<string, { keyType: string; valueType: string }>;
}

/**
 * Extracts schema information from an ARC56 contract spec.
 */
function extractSchemaInfo(spec: Arc56Contract): SchemaInfo {
  const state = spec.state;
  if (!state) {
    throw new Error(`Missing 'state' in ARC56 spec for contract "${spec.name}"`);
  }

  const schema = state.schema;
  if (!schema) {
    throw new Error(`Missing 'state.schema' in ARC56 spec for contract "${spec.name}"`);
  }

  // Extract global schema
  const globalSchema = schema.global;
  if (!globalSchema) {
    throw new Error(`Missing 'state.schema.global' in ARC56 spec for contract "${spec.name}"`);
  }

  // Extract local schema
  const localSchema = schema.local;
  if (!localSchema) {
    throw new Error(`Missing 'state.schema.local' in ARC56 spec for contract "${spec.name}"`);
  }

  // Extract global keys
  const globalKeys: Record<string, { keyType: string; valueType: string }> = {};
  const keys = state.keys;
  if (keys?.global) {
    for (const key of Object.keys(keys.global)) {
      const value = keys.global[key];
      globalKeys[key] = {
        keyType: value.keyType,
        valueType: value.valueType,
      };
    }
  }

  return {
    globalInts: globalSchema.ints ?? 0,
    globalBytes: globalSchema.bytes ?? 0,
    localInts: localSchema.ints ?? 0,
    localBytes: localSchema.bytes ?? 0,
    globalKeys,
  };
}

/**
 * Validates that all pages in the array have compatible state schemas.
 * Throws descriptive errors if validation fails.
 *
 * @param pages - Array of page configurations to validate
 * @throws Error if schemas are incompatible
 */
export function validatePages(pages: PageConfig[]): void {
  if (pages.length === 0) {
    throw new Error("At least one page must be provided");
  }

  // Extract and validate schema info from all pages (even single page needs validation)
  const schemas: Array<{ name: string; info: SchemaInfo }> = [];
  for (const page of pages) {
    const name = page.spec.name ?? "<unnamed>";
    schemas.push({ name, info: extractSchemaInfo(page.spec) });
  }

  if (pages.length === 1) {
    // Single page is always compatible with itself
    return;
  }

  // Use first page as reference
  const reference = schemas[0];

  // Validate each page against the reference
  for (let i = 1; i < schemas.length; i++) {
    const current = schemas[i];

    // Check global schema
    if (
      current.info.globalInts !== reference.info.globalInts ||
      current.info.globalBytes !== reference.info.globalBytes
    ) {
      throw new Error(
        `Global schema mismatch between "${reference.name}" and "${current.name}": ` +
          `expected {ints: ${reference.info.globalInts}, bytes: ${reference.info.globalBytes}}, ` +
          `got {ints: ${current.info.globalInts}, bytes: ${current.info.globalBytes}}`
      );
    }

    // Check local schema
    if (
      current.info.localInts !== reference.info.localInts ||
      current.info.localBytes !== reference.info.localBytes
    ) {
      throw new Error(
        `Local schema mismatch between "${reference.name}" and "${current.name}": ` +
          `expected {ints: ${reference.info.localInts}, bytes: ${reference.info.localBytes}}, ` +
          `got {ints: ${current.info.localInts}, bytes: ${current.info.localBytes}}`
      );
    }

    // Check global state keys
    const referenceKeys = reference.info.globalKeys;
    const currentKeys = current.info.globalKeys;

    // Check that current page has all keys from reference
    for (const key of Object.keys(referenceKeys)) {
      const value = referenceKeys[key];
      const currentValue = currentKeys[key];
      if (!currentValue) {
        throw new Error(
          `Global state key mismatch: "${key}" exists in "${reference.name}" but not in "${current.name}"`
        );
      }
      if (
        currentValue.keyType !== value.keyType ||
        currentValue.valueType !== value.valueType
      ) {
        throw new Error(
          `Global state key "${key}" type mismatch between "${reference.name}" and "${current.name}": ` +
            `expected {keyType: "${value.keyType}", valueType: "${value.valueType}"}, ` +
            `got {keyType: "${currentValue.keyType}", valueType: "${currentValue.valueType}"}`
        );
      }
    }

    // Check that reference page has all keys from current (bidirectional check)
    for (const key of Object.keys(currentKeys)) {
      if (!referenceKeys[key]) {
        throw new Error(
          `Global state key mismatch: "${key}" exists in "${current.name}" but not in "${reference.name}"`
        );
      }
    }
  }
}
