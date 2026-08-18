import { useSelector as useReduxSelector } from "react-redux";
import { useMemo } from "react";

/**
 * Base UseSelector Hook Factory
 * Returns a hook that reads the whole module slice in one subscription.
 *
 * @example
 * const { loading, list } = transactionStore.useSelector()
 */
export const createUseSelector = (moduleName, initialState) => {
  // kebab-case module name -> camelCase state key
  const stateKey = moduleName.replace(/-([a-z])/g, (_, letter) =>
    letter.toUpperCase(),
  );

  return function useModuleSelector() {
    const state = useReduxSelector(
      (rootState) => rootState[stateKey] || initialState,
    );

    // One selector for the whole slice keeps the hook count stable
    return useMemo(() => ({ ...initialState, ...state }), [state]);
  };
};

export default createUseSelector;
