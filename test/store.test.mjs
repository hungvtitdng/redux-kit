import test from "node:test"
import assert from "node:assert/strict"
import { createKit, createBaseStore, configureStore, injectReducer, injectSaga } from "../src/index.js"

const tick = () => new Promise((resolve) => setImmediate(resolve))

const fakeHttp = (overrides = {}) => {
  const calls = []
  return {
    calls,
    get: (url, config) => (calls.push(["get", url, config]), Promise.resolve({ data: [{ id: 1 }] })),
    post: (url, body) => (calls.push(["post", url, body]), Promise.resolve({ data: { id: 2 } })),
    patch: (url, body) => (calls.push(["patch", url, body]), Promise.resolve({ data: { id: 2 } })),
    delete: (url) => (calls.push(["delete", url]), Promise.resolve({ data: true })),
    ...overrides,
  }
}

const mount = (store, moduleStore) => {
  injectReducer(store, moduleStore.name, moduleStore.reducer)
  injectSaga(store, moduleStore.name, { saga: moduleStore.saga })
}

test("CRUD action: endpoint -> api -> saga -> reducer", async () => {
  const http = fakeHttp()
  const { createBaseStore } = createKit({ http })

  const store = configureStore()
  const transaction = createBaseStore({ name: "transaction", endpoint: "warehouse/transactions" })
  mount(store, transaction)

  store.dispatch(transaction.actions.getListAction({ params: { page: 1 } }))
  assert.equal(store.getState().transaction.loading, true)

  await tick()
  assert.deepEqual(http.calls[0], ["get", "/warehouse/transactions", { params: { page: 1 } }])

  const state = store.getState().transaction
  assert.equal(state.loading, false)
  assert.deepEqual(state.list, { data: [{ id: 1 }] })
  assert.equal(state.getListSuccess, true)
})

test("operation: own loading flag, selector and after hook", async () => {
  const afterCalls = []
  const { createBaseStore } = createKit({ http: fakeHttp() })

  const store = configureStore()
  const inventory = createBaseStore({
    name: "inventory",
    endpoint: "inventories",
    customApiMethods: { export: (params) => Promise.resolve({ url: "/tmp.xlsx", params }) },
    operations: [{
      name: "export",
      apiName: "export",
      payload: ["params"],
      loadingType: "exporting",
      saga: { after: function* after(data) { afterCalls.push(data) } },
    }],
  })
  mount(store, inventory)

  store.dispatch(inventory.actions.exportAction({ params: { ids: [1] } }))
  assert.equal(store.getState().inventory.exporting, true)

  await tick()
  assert.equal(store.getState().inventory.exporting, false)
  assert.equal(store.getState().inventory.exportSuccess, true)
  assert.deepEqual(store.getState().inventory.export, { url: "/tmp.xlsx", params: { ids: [1] } })
  assert.equal(afterCalls.length, 1)
})

test("operation hooks accept plain functions, and error hook runs on failure", async () => {
  const seen = []
  const { createBaseStore } = createKit({ http: fakeHttp() })

  const store = configureStore()
  const auth = createBaseStore({
    name: "auth",
    api: { verify: () => Promise.reject(new Error("401")), logout: () => Promise.resolve({}) },
    baseActions: [],
    operations: [
      { name: "verify", selector: null, saga: { error: () => seen.push("logged-out") } },
      { name: "logout", selector: null, saga: { after: () => seen.push("bye") } },
    ],
  })
  mount(store, auth)

  store.dispatch(auth.actions.logoutAction())
  await tick()
  store.dispatch(auth.actions.verifyAction())
  await tick()

  assert.deepEqual(seen, ["bye", "logged-out"])
})

test("a failed operation clears its own loading flag, not just `loading`", async () => {
  const { createBaseStore } = createKit({ http: fakeHttp() })

  const store = configureStore()
  const inventory = createBaseStore({
    name: "inventory2",
    endpoint: "inventories",
    customApiMethods: { export: () => Promise.reject(new Error("nope")) },
    operations: [{ name: "export", apiName: "export", payload: ["params"], loadingType: "exporting" }],
  })
  mount(store, inventory)

  store.dispatch(inventory.actions.exportAction({ params: {} }))
  await tick()

  assert.equal(store.getState().inventory2.exporting, false)
  assert.equal(store.getState().inventory2.exportSuccess, false)
})

test("API failure lands in error and clears loading", async () => {
  const boom = new Error("500")
  const { createBaseStore } = createKit({ http: fakeHttp({ get: () => Promise.reject(boom) }) })

  const store = configureStore()
  const account = createBaseStore({ name: "account", endpoint: "accounts" })
  mount(store, account)

  store.dispatch(account.actions.getListAction({ params: {} }))
  await tick()

  const state = store.getState().account
  assert.equal(state.error, boom)
  assert.equal(state.loading, false)
  assert.equal(state.getListSuccess, false)
})

test("api object without CRUD: no base actions generated", async () => {
  const optionApi = { accounts: (params) => Promise.resolve({ data: ["a"], params }) }
  const { createBaseStore } = createKit({ http: fakeHttp() })

  const store = configureStore()
  const options = createBaseStore({
    name: "options",
    api: optionApi,
    baseActions: [],
    operations: [{ name: "getAccounts", apiName: "accounts", payload: ["params"], selector: "accounts", successSelector: "getAccountsSuccess" }],
  })
  mount(store, options)

  assert.equal(options.actions.getListAction, undefined)
  store.dispatch(options.actions.getAccountsAction({ params: { q: 1 } }))
  await tick()

  assert.deepEqual(store.getState().options.accounts, { data: ["a"], params: { q: 1 } })
  assert.equal(store.getState().options.getAccountsSuccess, true)
})

test("static reducers survive module injection, no module-level state between stores", () => {
  const { createBaseStore } = createKit({ http: fakeHttp() })

  const storeA = configureStore({ staticReducers: { app: (state = { booted: "a" }) => state } })
  const storeB = configureStore({ staticReducers: { app: (state = { booted: "b" }) => state } })

  mount(storeA, createBaseStore({ name: "contact", endpoint: "contacts" }))
  mount(storeB, createBaseStore({ name: "contact", endpoint: "contacts" }))

  assert.deepEqual(storeA.getState().app, { booted: "a" })
  assert.deepEqual(storeB.getState().app, { booted: "b" })
  assert.equal(storeA.getState().contact.loading, false)
})

test("endpoint without an http client fails loudly", () => {
  assert.throws(
    () => createBaseStore({ name: "orphan", endpoint: "orphans" }),
    /needs an http client/,
  )
})

test("selector: null keeps no response in state", async () => {
  const { createBaseStore } = createKit({ http: fakeHttp() })

  const store = configureStore()
  const contact = createBaseStore({
    name: "contact2",
    endpoint: "contacts",
    operations: [{ name: "ping", apiName: "list", payload: ["params"], selector: null }],
  })
  mount(store, contact)

  store.dispatch(contact.actions.createAction({ formData: { a: 1 } }))
  store.dispatch(contact.actions.pingAction({ params: {} }))
  await new Promise((resolve) => setImmediate(resolve))

  const state = store.getState().contact2
  // base create/delete declare selector: null, so the response is not kept
  assert.ok(!("create" in state), "state should not hold a `create` key")
  assert.ok(!("delete" in state), "state should not hold a `delete` key")
  assert.ok(!("ping" in state), "state should not hold a `ping` key")
  // the success flags still work
  assert.equal(state.createSuccess, true)
  assert.equal(state.pingSuccess, true)
  assert.equal(state.actionSuccess, true)
})
