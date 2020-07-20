import mongoose from 'mongoose';
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

  field.set(function (val) {
    if (!(this instanceof mongoose.Document)) {
      return val;
    }

    const doc = this;
    return doc._state_frozen ? get(doc, field.path) : val;
  });

  const onEnterState = get(stateMachine, 'methods.onEnterState');
  set(stateMachine, 'methods.onEnterState', (lifecycle, ...args) => {
    const { fsm: doc, to } = lifecycle;

    const from = get(doc, fieldName);
    if (from !== to) {
      doc._state_frozen = false;
      set(doc, field.path, to);
      doc._state_frozen = true;
    }

    return onEnterState
      ? onEnterState.bind(doc)(lifecycle, ...args)
      : undefined;
  });

  schema.method('$onInstantiated', function () {
    if (!(this instanceof mongoose.Document)) {
      return;
    }

    const doc = this;
    if (!doc.isNew) {
      return;
    }

    StateMachine.apply(doc, stateMachine);
    doc._state_frozen = true;
  });

  schema.queue('$onInstantiated', []);

  schema.post('init', function () {
    if (!(this instanceof mongoose.Document)) {
      return;
    }

    const doc = this;
    const state = get(doc, field.path);

    StateMachine.apply(doc, {
      ...stateMachine,
      init: undefined
    });

    doc._fsm.state = state;
    doc._state_frozen = true;
  });
};
