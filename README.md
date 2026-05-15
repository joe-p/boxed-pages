# Boxed Pages

Proof of concept of using boxes to store "pages" of logic. The idea is that by updating the application on the fly you can have an uncapped amount of bytecode that accesses the same state.

> [!IMPORTANT]
> The size of each individual "page" is still capped at the consensus `MaxAppProgramLen` * `MaxExtraAppProgramPages`

## Definitions

**Page** - An approval program with logic that operates on shared state
**Orchestrator** - The application that stores the pages in boxes
**Logic App** - The application that contains the shared state. This is the application that gets updated to the various pages

## Method Calling

There are three ways to do method calling. The contract in this repo supports all three, but if one were to actually use this pattern you'd probably just want to pick one.

### Static Calling

To call `foo(uint64)void`:

1. Outer txn: call `foo(uint64)void` on *orchestrator*
   1a. Inner txn: `UpdateApplication` to the *logic app* to `foo(uint64)void` page
   2a. Inner txn: call `foo(uint64)void` on *logic app*

### Dynamic Calling

To call `foo(uint64)void`:

1. Outer txn: call `callMethod(byte[4],byte[])void` on *orchestrator*. First arg is `foo(uint64)void` selector, second argument is ABI arguments.
   1a. Inner txn: `UpdateApplication` to the *logic app* to `foo(uint64)void` page
   2a. Inner txn: call `foo(uint64)void` on *logic app*

### External Calling

To call `foo(uint64)void`:

1. Outer txn: call `updateToPage(byte[4])void` on *orchestrator*. The argument is the `foo(uint64)void` selector.
   1a. Inner txn: `UpdateApplication` to the *logic app* to `foo(uint64)void` page
1. Outer txn: call `foo(uint64)void` on *logic app*

> [!TIP]
> The two outer calls should be in the same group to avoid program race conditions

### Capability Summary

| Capability                                      | Static Calling | Dynamic Calling | External Calling |
| ----------------------------------------------- | -------------- | --------------- | ---------------- |
| Total number of transactions (including inners) | 3              | 3               | 3                |
| Number of outer transactions                    | 1              | 1               | 2                |
| Can use generated app client                    | ✅             | ❌              | ❌               |
| Contract internals are ABI type safe            | ✅             | ❌              | ❌               |
| Unlimited pages of logic                        | ❌             | ✅              | ✅               |
| Can add methods without updating orchestrator   | ❌             | ✅              | ✅               |
| Can use ABI transaction arguments               | ❌             | ❌              | ✅               |
