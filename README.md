# @hungvt/redux-kit

The request stack of a React app as one installable package: HTTP client, CRUD
API factory, redux + saga store factory, and the request hook. Declare a module
in ~5 lines and you get action types, action creators, reducer, saga, initial
state, a `useSelector()` and a `useRequest()` hook.

Design rules:

- **No module-level state.** No singleton, no registry, no cached index. The HTTP
  client lives in a `createKit()` closure; the reducer registries live on the
  store object. Two kits or two stores in one bundle never see each other.
- **Nothing app-specific inside.** Every app concern (baseURL, token, locale,
  notifications, sign-out, static reducers, middleware) is a parameter you pass
  in. The package imports nothing from your app.

Raw ESM, no build step. Peer deps (your app must already have them):
`axios`, `redux`, `react-redux`, `redux-saga`, `immer`, `react`.

## Install

```bash
yarn add @hungvt/redux-kit
```

Same shape as any other dependency — a name and a semver range:

```json
"dependencies": {
  "@hungvt/redux-kit": "^0.1.0"
}
```

```js
import { createKit, configureStore } from "@hungvt/redux-kit"
```

Published public on npmjs, so consumers need nothing else: no `.npmrc`, no token,
no SSH key — it installs in CI and in a Docker build like `dayjs` does. `^0.1.0`
picks up every later 0.1.x automatically; `yarn upgrade @hungvt/redux-kit`
moves within the range.

The name is scoped because the bare `redux-kit` is taken on npm
(`redux-kit@0.0.9`). npm only accepts a publish to `@hungvt` if that scope is your
npm username, or an org you belong to — orgs are free for public packages, create
one at npmjs.com/org/create if the username differs. The GitHub repo
(`hungvtitdng/redux-kit`) is unrelated to the npm scope.

**Peer deps are never installed for you** — the app must already have `axios`,
`redux`, `react-redux`, `redux-saga`, `immer`, `react`.

<details>
<summary>Installing straight from git instead (no publish)</summary>

```bash
yarn add "github:hungvtitdng/redux-kit#v0.1.0"          # exact tag
yarn add "github:hungvtitdng/redux-kit#semver:^0.1.0"   # newest matching tag
```

Works with zero registry setup, and `#semver:` even resolves ranges against tags,
but `yarn.lock` pins a commit hash and a private repo needs SSH keys everywhere
(`--mount=type=ssh` in Docker). Prefer the registry once the package is published.
</details>

## Publishing a version

There is nothing to compile. The package ships ESM source and Vite, webpack 5,
Rollup and bun consume it directly — no build step, no `dist/`, no bundler
dependency. `files` keeps the tarball to `src/` + README (18 files, ~15 kB).

First time:

```bash
npm login          # once per machine; the npm account must own the @hungvt scope
npm publish        # publishConfig.access is already "public"; prepublishOnly runs the tests
```

Every release after that:

```bash
# 1. bump "version" in package.json — patch = fix, minor = new option, major = breaking
git commit -am "release: v0.1.1"
git tag v0.1.1 && git push origin main --tags
npm publish
```

Keep the git tag and the published version identical — the tag is what lets
someone read the exact source of a release. A published version is immutable:
never republish a number, bump instead. `npm unpublish` only works within 72
hours and breaks anyone who already installed it.

Dry runs before the real thing:

```bash
yarn test                # 13 checks
npm pack --dry-run       # exactly what would be uploaded
```

<details>
<summary>If a consumer's toolchain cannot eat ESM source</summary>

Webpack 4, CRA 4, `require()` from CommonJS or Jest without ESM support will
choke on raw ESM. Only then add a build — one dev dependency, no config file:

```json
"scripts": { "prepublishOnly": "yarn test && esbuild src/index.js --bundle --format=cjs --packages=external --outfile=dist/index.cjs" },
"main": "./dist/index.cjs",
"exports": { ".": { "import": "./src/index.js", "require": "./dist/index.cjs" } },
"files": ["src", "dist", "README.md"]
```

Do not add this pre-emptively.
</details>

## Folder layout to create in your app

Scaffold the folders and the empty files first:

```bash
mkdir -p src/store/modules src/requests src/api
touch src/store/kit.js src/store/index.js src/store/modules/transaction.js src/requests/transaction.js
```

```
src/
├── store/
│   ├── kit.js               1. the kit, configured once — the only file importing the package
│   ├── index.js             2. the redux store
│   └── modules/
│       └── transaction.js   4. what the module is: endpoint + operations
├── api/
│   └── transaction.js       3. optional — only when plain CRUD is not enough
├── requests/
│   └── transaction.js       5. the hook components call
└── main.jsx                 wire <Provider store={store}>
```

Why `store/modules` and `requests` are separate folders: a module file declares
*what exists* (endpoint, operations, state shape) and imports nothing from React;
a request file is the *React entry point* — calling its hook is what injects the
reducer and saga. Keeping them apart is what lets a module stay unloaded until a
component actually asks for it.

Naming rules that the generated names depend on:

| thing | rule | example |
|---|---|---|
| `name` in `createBaseStore` | camelCase, unique across the app | `transaction`, `subAccount` |
| state key | *is* `name` — nothing to configure | `state.transaction` |
| injection key in `createUseRequest` | must be the same `name` | `createUseRequest("transaction", …)` |
| file names | match `name` so a grep finds all three files | `store/modules/transaction.js`, `requests/transaction.js`, `api/transaction.js` |
| hook name | `use<Name>Request` | `useTransactionRequest` |

Paths below use relative imports. If your app has a path alias (`@app/...`,
`~/...`), use it instead.

## 1. `src/store/kit.js` — configure once

```js
import { createKit } from "@hungvt/redux-kit"

export const { http, createBaseStore, createUseRequest, createBaseApi } = createKit({
  baseURL: API_URL,
  headers: { Accept: "application/json" },
  getToken: () => getAccessToken(),           // your token storage
  getLocale: () => currentLocale(),           // your i18n; sets the Localization header
  notifySuccess: (message) => notify(message),
  notifyError: (message) => notifyError(message),
  onUnauthorized: () => signOut(),            // called on HTTP 401
  silentSuccessPaths: ["/login", "/logout"],  // never toast a success message
  silentSuccessSubPaths: ["/reset-password/"],
  silentNotFoundSubPaths: ["/invites/verify/"],
})
```

Every option is optional. Responses are unwrapped to `response.data`; errors are
notified and rejected with the server payload. Already have an axios instance?
`createKit({ http: myAxios })` and none of the HTTP options apply.

## 2. `src/store/index.js` — the store

```js
import { configureStore } from "@hungvt/redux-kit"

export const store = configureStore({
  // reducers your app owns: router, persisted slices, hand-written ones
  staticReducers: { settings: settingsReducer },
  middleware: [],          // extra middleware, after saga middleware
})
```

Module reducers and sagas are **not** listed here — they are injected on mount by
`useRequest()` (step 5). In `main.jsx`, wrap the app as usual:

```jsx
<Provider store={store}><App /></Provider>
```

<details>
<summary>With connected-react-router and redux-persist</summary>

```js
import { routerMiddleware, connectRouter } from "connected-react-router"
import { persistStore } from "redux-persist"

export const store = configureStore({
  staticReducers: { router: connectRouter(history) },
  middleware: [routerMiddleware(history)],
})
export const persistor = persistStore(store)
```
</details>

## 3. `src/api/transaction.js` — only if you need it

Skip this file when the module is plain CRUD over one path: step 4 builds the API
for you from `endpoint`. Write it when you need extra calls or non-REST paths:

```js
import { http } from "../store/kit"

export default {
  export: (params) => http.get("/warehouse-transactions/export", { params }),
  summary: (params) => http.get("/warehouse-transactions/summary", { params }),
}
```

## 4. `src/store/modules/transaction.js` — declare the module

```js
import { createBaseStore } from "../kit"
import transactionApi from "../../api/transaction"

export const transactionStore = createBaseStore({
  name: "transaction",                  // also the state key: state.transaction
  endpoint: "warehouse-transactions",   // gives the 5 CRUD methods
  customApiMethods: transactionApi,     // optional extra methods (step 3)
  operations: [
    { name: "export", apiName: "export", payload: ["params"], loadingType: "exporting" },
  ],
})
```

`endpoint` alone generates 5 CRUD actions:

| action | API method | HTTP |
|---|---|---|
| `getList` | `list(params)` | `GET /warehouse-transactions` |
| `getDetail` | `detail(id, params)` | `GET /warehouse-transactions/:id` |
| `create` | `store(formData)` | `POST /warehouse-transactions` |
| `update` | `update(id, formData)` | `PATCH /warehouse-transactions/:id` |
| `delete` | `destroy(id)` | `DELETE /warehouse-transactions/:id` |

**Operations** are everything else — each adds one action + saga + state slot:

| field | meaning |
|---|---|
| `name` | action name, e.g. `export` → `exportAction`, `exportTransactionRequest` |
| `apiName` | API method to call (default: `name`) |
| `payload` | argument order for that method, e.g. `["id", "params"]`; omit for none |
| `selector` | state key for the response (default: `name`; `null` to store nothing) |
| `successSelector` | flag key (default: `<selector>Success`) |
| `loadingType` | flag raised while in flight (default: `loading`) |
| `saga.before` / `after` / `error` | hooks; generator or plain function |
| `reducer` | `(draft, action)` immer patch, runs after success |

No CRUD at all — a module of pure custom calls:

```js
export const optionsStore = createBaseStore({
  name: "options",
  api: optionApi,        // a ready-made API object; wins over `endpoint`
  baseActions: [],       // no CRUD actions
  operations: [
    { name: "getAccounts", apiName: "accounts", payload: ["params"], selector: "accounts" },
  ],
})
```

## 5. `src/requests/transaction.js` — the hook

```js
import { createUseRequest } from "../store/kit"
import { transactionStore } from "../store/modules/transaction"

export const useTransactionRequest = createUseRequest("transaction", transactionStore)
```

Optional third argument adds or overrides methods; each receives
`(...yourArgs, actions, dispatch)`:

```js
export const useTransactionRequest = createUseRequest("transaction", transactionStore, {
  reloadTransactionRequest: (filters, actions) => actions.getListAction({ params: filters }),
})
```

## 6. In a component

```jsx
import { transactionStore } from "../store/modules/transaction"
import { useTransactionRequest } from "../requests/transaction"

const TransactionList = () => {
  const { getListTransactionRequest, exportTransactionRequest } = useTransactionRequest()
  const { loading, list, exporting, error } = transactionStore.useSelector()

  useEffect(() => { getListTransactionRequest({ page: 1 }) }, [])

  return <Table loading={loading} dataSource={list?.data} />
}
```

Calling `useTransactionRequest()` is what injects the module's reducer and saga
(on mount, ejected on unmount) — a module costs nothing until a component uses it.

### Names generated for `name: "transaction"`

| you call | you read |
|---|---|
| `getListTransactionRequest(params)` | `loading`, `list`, `getListSuccess` |
| `getDetailTransactionRequest(id, params)` | `loading`, `detail`, `getDetailSuccess` |
| `createTransactionRequest(data)` | `submitting`, `createSuccess`, `actionSuccess` |
| `updateTransactionRequest(id, data)` | `submitting`, `detail`, `updateSuccess`, `actionSuccess` |
| `deleteTransactionRequest(id)` | `loading`, `deleteSuccess`, `actionSuccess` |
| `setDataTransactionRequest({ any: "value" })` | whatever you set |
| `exportTransactionRequest(params)` (operation) | `exporting`, `export`, `exportSuccess` |

`error` holds the rejected payload; any failure clears `loading`, `submitting`,
every custom loading flag, and every success flag.

## 7. Adding more modules

Per module: one file in `store/modules/`, one in `requests/`, and `api/` only if
CRUD is not enough. Nothing else — no reducer registry to update, no root saga to
edit, no `combineReducers` to touch.

```
src/
├── store/modules/
│   ├── transaction.js
│   ├── account.js
│   └── index.js        ← barrel, re-exports every module
└── requests/
    ├── transaction.js
    ├── account.js
    └── index.js        ← barrel, re-exports every hook
```

```js
// src/store/modules/index.js
export { transactionStore } from "./transaction"
export { accountStore } from "./account"
```

```js
// src/requests/index.js
export { useTransactionRequest } from "./transaction"
export { useAccountRequest } from "./account"
```

Components then import from one place:

```js
import { transactionStore, accountStore } from "../store/modules"
import { useTransactionRequest, useAccountRequest } from "../requests"
```

Small, closely-related modules can share one file — declare several stores in
`store/modules/warehouse.js` and their hooks in `requests/warehouse.js`. For a
larger app, group by domain, one folder per area, same barrel pattern:

```
src/
├── api/
│   ├── warehouse/{transaction,inventory}.js
│   └── billing/{invoice,quote}.js
├── store/modules/
│   ├── warehouse/{transaction,inventory,index}.js
│   ├── billing/{invoice,quote,index}.js
│   └── index.js                              ← re-exports both domains
└── requests/
    ├── warehouse/{transaction,inventory,index}.js
    ├── billing/{invoice,quote,index}.js
    └── index.js
```

`name` stays globally unique regardless of folders — it is the redux state key,
which is flat. Prefix when two domains own the same noun: `warehouseTransaction`
vs `billingTransaction`.

A module whose hook no component calls is dead weight in the bundle but costs
nothing at runtime: no reducer, no saga, no state key until first mount.

## API reference

| Export | Purpose |
|---|---|
| `createKit(options)` | `{ http, createBaseApi, createBaseStore, createUseRequest }` bound to one HTTP client |
| `createHttpClient(options)` | axios instance with auth/notify/error interceptors |
| `createErrorHandler(options)` | just the response-error interceptor |
| `createBaseApi(http, endpoint, customMethods)` | CRUD API object |
| `createBaseStore(config)` | constants + actions + reducer + saga + initialState + useSelector |
| `createUseRequest(name, store, customMethods)` | request-methods hook; injects reducer/saga |
| `configureStore(options)` | store + saga middleware + injection registries |
| `buildRootReducer(staticReducers, injectedReducers)` | root reducer |
| `useInjectReducer` / `useInjectSaga` / `getInjectors` / `injectReducer` / `injectSaga` / `ejectSaga` | manual injection |
| `DAEMON` / `RESTART_ON_REMOUNT` / `ONCE_TILL_UNMOUNT` | saga modes |

## Migrating from an in-app copy of this pattern

| before | after |
|---|---|
| `tasks: [...]` | `operations: [...]` |
| `task.endpoint: "verify"` | `operation.apiName: "verify"` (it was always a method name, never a path) |
| `api: "option"` (glob lookup by filename) | `api: optionApi` (plain import) |
| `import { createBaseStore } from "<app>/store/base"` | `import { createBaseStore } from "<app>/store/kit"` |
| `import httpRequest from "<app>/services/httpRequest"` | `import { http } from "<app>/store/kit"` |

Behaviour differences, all deliberate:

- The `import.meta.glob("../../api/**")` auto-lookup is gone. APIs are imported
  explicitly — no magic, no duplicate-filename trap, no bundler dependency.
- `persistStore`, `connectRouter`, `routerMiddleware` and every hand-written
  reducer are the app's job (`staticReducers`). The package depends on neither
  `redux-persist` nor `connected-react-router`.
- The `injectReducer`/`injectSaga` **HOCs** were dropped; only the hooks remain.
  That also removes JSX, hence no build step.
- `lodash` and `invariant` replaced by plain checks; messages changed, behaviour
  did not.
- `import.meta.env.VITE_NODE_ENV` → `process.env.NODE_ENV`, so the package also
  runs under plain Node (see `test/`).
- **Bugfix:** an error clears custom loading flags too (`exporting`,
  `detailLoading`, ...). Before, a failed operation left its spinner on forever.
- **Bugfix:** `operations[].saga.error` is actually called now, and hooks may be
  plain functions — `yield* plainFn()` used to throw and get swallowed.
- **Bugfix:** `selector: null` really keeps the response out of state. The old
  `selector || name` fallback meant `null` was ignored, so `create`/`delete`
  responses landed in `state.create` / `state.delete` regardless.

## Developing this package

```bash
yarn install
yarn test
```

13 checks, no framework, no jsdom: request/response interceptors, the 401/404/422
error matrix, CRUD end-to-end (dispatch → api → saga → reducer), operations with
their own loading flag and hooks, error paths, and two stores staying independent.

Cutting a release is described under [Publishing a version](#publishing-a-version).
