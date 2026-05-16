# Boxed Pages

Proof of concept of using boxes to store "pages" of logic. The idea is that by updating the application on the fly you can have an uncapped amount of bytecode that accesses the same state.

> [!IMPORTANT]
> The size of each individual "page" is still capped at the consensus `MaxAppProgramLen` * `MaxExtraAppProgramPages`

## Definitions

**Page** - An approval program with logic that operates on shared state

**Orchestrator-Based**: A pattern that uses two apps. The **orchestrator**, which is a single app that stores pages of logic and issues updates to the **logic app**, which has the app state.

**Self-Updating**: A pattern with a single app that updates itself before method calls. Holds both the pages in boxes and the business logic state.

## Method Calling

There are three ways to do method calling. The contract in this repo supports all three, but if one were to actually use this pattern you'd probably just want to pick one.

### Transaction Groups

#### Static Orchestrator

To call `foo(uint64)void`:

1. Outer txn: call `foo(uint64)void` on *orchestrator*
   1a. Inner txn: `UpdateApplication` to the *logic app* to `foo(uint64)void` page
   2a. Inner txn: call `foo(uint64)void` on *logic app*

#### Dynamic Orchestrator

To call `foo(uint64)void`:

1. Outer txn: call `callMethod(byte[4],byte[])void` on *orchestrator*. First arg is `foo(uint64)void` selector, second argument is ABI arguments.
   1a. Inner txn: `UpdateApplication` to the *logic app* to `foo(uint64)void` page
   2a. Inner txn: call `foo(uint64)void` on *logic app*

#### External Orchestrator

To call `foo(uint64)void`:

1. Outer txn: call `updateToPage(byte[4])void` on *orchestrator*. The argument is the `foo(uint64)void` selector.
   1a. Inner txn: `UpdateApplication` to the *logic app* to `foo(uint64)void` page
1. Outer txn: call `foo(uint64)void` on *logic app*

> [!TIP]
> The two outer calls should be in the same group to avoid program race conditions

#### Self Updating

To call `foo(uint64)void`:

1. Outer txn: `UpdateApplication` to `foo(uint64)void` page
1. Outer txn: call `foo(uint64)void`

### Capability Summary

| Capability                                      | Static Orchestrator | Dynamic Orchestrator | External Orchestrator | Self Updating |
| ----------------------------------------------- | ------------------- | -------------------- | --------------------- | ------------- |
| Total number of transactions (including inners) | 3                   | 3                    | 3                     | 2             |
| Number of outer transactions                    | 1                   | 1                    | 2                     | 2             |
| Can use generated app client                    | ✅                  | ❌                   | ❌                    | ❌            |
| Contract internals are ABI type safe            | ✅                  | ❌                   | ❌                    | ✅            |
| Unlimited pages of logic                        | ❌                  | ✅                   | ✅                    | ✅            |
| Can add methods without updating orchestrator   | ❌                  | ✅                   | ✅                    | ✅            |
| Can use ABI transaction arguments               | ❌                  | ❌                   | ✅                    | ✅            |

## Consequences

#### For the End User

For the end user, the only significant consequence they will feel is the extra transactions (thus extra fee). If your app uses extra transactions for op ups (or references in the case of external calling) then these apps can replace the existing "extra" apps.

#### For Developers

##### Method Calling

Dynamic and external calling introduce some extra complexity in terms of contract calling. The good news is its possible to abstract this away and its something we could potentially automatically support in AlgoKit app clients.

##### Contract Development

Developers will need to chunk their logic up in 8kb chunks. Extra care also needs to be taken to make sure the contract is never updated in a deadlocked or vulnerable state. This is also functionality that could potentially be integrated directly into Puya/AlgoKit app clients.

## Recommendations

For most apps that are larger than today's program limit, the self updating pattern is likely the most useful. This is especially true if your app already requires extra transactions for references and/or op-ups. The other strong contender is the static orchestrator due to the client-side and transaction group simplicity, but this pattern falls apart when you need to have transaction arguments.
