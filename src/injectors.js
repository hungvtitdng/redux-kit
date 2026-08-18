import { useContext, useLayoutEffect } from "react"
import { ReactReduxContext } from "react-redux"
import { buildRootReducer } from "./rootReducer.js"
import { DAEMON, ONCE_TILL_UNMOUNT, RESTART_ON_REMOUNT } from "./constants.js"

const allowedModes = [RESTART_ON_REMOUNT, DAEMON, ONCE_TILL_UNMOUNT]

const isFunction = (value) => typeof value === "function"
const isObject = (value) => typeof value === "object" && value !== null

function checkStore(store) {
  const valid = isObject(store)
    && isFunction(store.dispatch)
    && isFunction(store.subscribe)
    && isFunction(store.getState)
    && isFunction(store.replaceReducer)
    && isFunction(store.runSaga)
    && isObject(store.staticReducers)
    && isObject(store.injectedReducers)
    && isObject(store.injectedSagas)

  if (!valid) {
    throw new Error("@hungvt/redux-kit: expected a store created by configureStore()")
  }
}

const checkKey = (key) => {
  if (typeof key !== "string" || key.length === 0) {
    throw new Error("@hungvt/redux-kit: injector expected `key` to be a non-empty string")
  }
}

export function injectReducer(store, key, reducer) {
  checkKey(key)
  if (!isFunction(reducer)) {
    throw new Error(`@hungvt/redux-kit: injectReducer("${key}") expected a reducer function`)
  }

  // Same key + same reducer: nothing to do (also makes hot reload a no-op)
  if (store.injectedReducers[key] === reducer) return

  store.injectedReducers[key] = reducer
  store.replaceReducer(buildRootReducer(store.staticReducers, store.injectedReducers))
}

export function injectSaga(store, key, { saga, mode = DAEMON } = {}, args) {
  checkKey(key)
  if (!isFunction(saga)) {
    throw new Error(`@hungvt/redux-kit: injectSaga("${key}") expected a saga function`)
  }
  if (!allowedModes.includes(mode)) {
    throw new Error(`@hungvt/redux-kit: injectSaga("${key}") got an unknown mode "${mode}"`)
  }

  let hasSaga = Object.prototype.hasOwnProperty.call(store.injectedSagas, key)

  if (process.env.NODE_ENV !== "production") {
    const old = store.injectedSagas[key]
    // Enable hot reloading of daemon and once-till-unmount sagas
    if (hasSaga && old.saga !== saga) {
      old.task.cancel()
      hasSaga = false
    }
  }

  if (!hasSaga || (mode !== DAEMON && mode !== ONCE_TILL_UNMOUNT)) {
    store.injectedSagas[key] = { saga, mode, task: store.runSaga(saga, args) }
  }
}

export function ejectSaga(store, key) {
  checkKey(key)

  const descriptor = store.injectedSagas[key]
  if (!descriptor || descriptor === "done") return

  if (descriptor.mode !== DAEMON) {
    descriptor.task.cancel()
    // Clean up in production; in development the descriptor is kept for hot reloading
    if (process.env.NODE_ENV === "production") {
      store.injectedSagas[key] = "done"
    }
  }
}

/** Injectors bound to a store — mirrors the previous getInjectors(store) API */
export default function getInjectors(store) {
  checkStore(store)

  return {
    injectReducer: (key, reducer) => injectReducer(store, key, reducer),
    injectSaga: (key, descriptor, args) => injectSaga(store, key, descriptor, args),
    ejectSaga: (key) => ejectSaga(store, key),
  }
}

export const useInjectReducer = ({ key, reducer }) => {
  const context = useContext(ReactReduxContext)

  // useLayoutEffect: inject before child useEffect fires a request
  useLayoutEffect(() => {
    if (!context?.store) return
    injectReducer(context.store, key, reducer)
  }, [key, reducer, context?.store])
}

export const useInjectSaga = ({ key, saga, mode }) => {
  const context = useContext(ReactReduxContext)

  useLayoutEffect(() => {
    if (!context?.store) return undefined
    injectSaga(context.store, key, { saga, mode })

    return () => ejectSaga(context.store, key)
  }, [key, saga, mode, context?.store])
}
