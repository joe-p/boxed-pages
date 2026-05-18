# Boxed Pages

Proof of concept of using boxes to store "pages" of logic. The idea is that by updating the application on the fly you can have an uncapped amount of bytecode that accesses the same state.

> [!IMPORTANT]
> The size of each individual "page" is still capped at the consensus `MaxAppProgramLen` * `MaxExtraAppProgramPages`

## Definitions

**Page** - An approval program with logic that operates on shared state

## Method Calling

To call `foo(uint64)void`:

1. Outer txn: `UpdateApplication` to `foo(uint64)void` page
1. Outer txn: call `foo(uint64)void`

## Consequences

#### For the End User

For the end user, the only significant consequence they will feel is the extra transactions (thus extra fee). If your app uses extra transactions for op ups (or references in the case of external calling) then these apps can replace the existing "extra" apps.

#### For Developers

##### Method Calling

This does introduce some complexity with client calling. The good news is its possible to abstract this away and it's something we could potentially automatically support in AlgoKit app clients.

##### Contract Development

Developers will need to chunk their logic up in 8kb chunks. Extra care also needs to be taken to make sure the contract is never updated in a deadlocked or vulnerable state. This is also functionality that could potentially be integrated directly into Puya/AlgoKit app clients.
