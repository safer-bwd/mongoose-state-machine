import StateMachine from 'javascript-state-machine';
import get from 'lodash.get';
import set from 'lodash.set';
import MongooseStateMachineError from './error';

const reservedPaths = new Set([
  'state',
  'is',
  'cannot',
  'transitions',
  'allTransitions',
  'allStates'
]);

const getPathSchema = (schema, name) => {
  const pathType = schema.pathType(name);
  return pathType === 'real' ? schema.path(name) : undefined;
};

const findReservedPath = (schema) => {
  const pathNames = Object.keys(schema.paths);
  return pathNames.find(name => reservedPaths.has(name));
};

const findTransitionPath = (schema, stateMachine) => {
  const pathNames = Object.keys(schema.paths);
  const transitionNames = new Set(stateMachine.transitions.map(t => t.name));
  return pathNames.find(name => transitionNames.has(name));
};

export default (schema, options = {}) => {
  const { stateMachine, fieldName = 'status' } = options;

  const field = getPathSchema(schema, fieldName);
  if (!field) {
    throw new MongooseStateMachineError(`Failed to find schema real path '${fieldName}'`);
  }

  const reservedPath = findReservedPath(schema);
  if (reservedPath) {
    throw new MongooseStateMachineError(`Invalid schema path: '${reservedPath}' is reserved`);
  }

  const transitionPath = findTransitionPath(schema, stateMachine);
  if (transitionPath) {
    throw new MongooseStateMachineError(`Invalid schema path: '${transitionPath}' is a transition name`);
  }

  field.frozen = false;
  field.freeze = () => { field.frozen = true; };
  field.unfreeze = () => { field.frozen = false; };
  field.set(function (val) {
    return field.frozen ? get(this, field.path) : val;
  });

  const onEnterState = get(stateMachine, 'methods.onEnterState');
  set(stateMachine, 'methods.onEnterState', (lifecycle, ...args) => {
    const { fsm: doc, to } = lifecycle;

    const from = get(doc, fieldName);
    if (from !== to) {
      field.unfreeze();
      set(doc, field.path, to);
      field.freeze();
    }

    return onEnterState
      ? onEnterState.bind(doc)(lifecycle, ...args)
      : undefined;
  });

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
