import StateMachine from 'javascript-state-machine';
import wrap from 'lodash.wrap';
import get from 'lodash.get';
import set from 'lodash.set';

class PluginError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MongooseStateMachineError';
  }
}

const reservedPaths = new Set([
  'state',
  'is',
  'cannot',
  'transitions',
  'allTransitions',
  'allStates'
]);

export default (schema, options = {}) => {
  const { stateMachine, fieldName = 'status' } = options;
  const pathSchemaType = schema.path(fieldName);
  const pathType = schema.pathType(fieldName);
  if (!pathSchemaType || pathType !== 'real') {
    throw new PluginError(`Failed to find schema real path '${fieldName}'`);
  }

  let isTransition = false;
  pathSchemaType.set(function (val) {
    const doc = this;
    return isTransition ? val : doc[fieldName];
  });

  const transitionNames = new Set(stateMachine.transitions.map(t => t.name));
  schema.eachPath((path) => {
    if (reservedPaths.has(path)) {
      throw new PluginError(`Invalid schema path: '${path}' is reserved`);
    }
    if (transitionNames.has(path)) {
      throw new PluginError(`Invalid schema path: '${path}' is a transition name`);
    }
  });

  const onEnterState = get(stateMachine, 'methods.onEnterState');
  const wrappedOnEnterState = wrap(onEnterState, (fn, lifecycle, ...args) => {
    const doc = lifecycle.fsm;
    const newState = lifecycle.to;
    if (doc[fieldName] !== newState) {
      isTransition = true;
      doc[fieldName] = newState;
      isTransition = false;
    }
    if (fn) {
      fn.bind(doc)(lifecycle, ...args);
    }
  });
  set(stateMachine, 'methods.onEnterState', wrappedOnEnterState);

  schema.method('$onInstantiated', function () {
    const doc = this;
    if (!doc.isNew) {
      return;
    }
    StateMachine.apply(doc, stateMachine);
  });
  schema.queue('$onInstantiated', []);

  schema.post('init', function () {
    const doc = this;
    const init = doc[fieldName] ? doc[fieldName] : undefined;
    StateMachine.apply(doc, { ...stateMachine, init });
  });
};
