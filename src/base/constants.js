/**
 * Base Constants Factory
 * Create action type constants for a module from its actions config.
 */
const createBaseConstants = (moduleName, allActions = []) => {
  const constants = {
    HANDLE_ERROR: `${moduleName}/HANDLE_ERROR`,
    SET_DATA: `${moduleName}/SET_DATA`,
  };

  allActions.forEach((actionConfig) => {
    const actionName = actionConfig.name.toUpperCase();
    constants[`${actionName}_REQUEST`] = `${moduleName}/${actionName}_REQUEST`;
    constants[`${actionName}_SUCCESS`] = `${moduleName}/${actionName}_SUCCESS`;
  });

  return constants;
};

export default createBaseConstants;
