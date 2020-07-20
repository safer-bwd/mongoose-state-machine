import mongoose from 'mongoose';
import stateMachinePlugin from '../src';

const onEnterState = jest.fn();
const stateMachine = {
  init: 'solid',
  transitions: [
    { name: 'melt', from: 'solid', to: 'liquid' },
    { name: 'freeze', from: 'liquid', to: 'solid' },
    { name: 'vaporize', from: 'liquid', to: 'gas' },
    { name: 'condense', from: 'gas', to: 'liquid' }
  ],
  methods: { onEnterState }
};

let Matter;

beforeAll(async () => {
  await mongoose.connect(process.env.DB_MONGO_URI, {
    auth: (process.env.DB_MONGO_USER) ? {
      user: process.env.DB_MONGO_USER,
      password: process.env.DB_MONGO_PASSWORD
    } : null,
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true
  });

  const schema = new mongoose.Schema({ matterState: String });
  schema.plugin(stateMachinePlugin, { fieldName: 'matterState', stateMachine });
  delete mongoose.models.Matter;
  Matter = mongoose.model('Matter', schema);
});

afterAll(async () => {
  await mongoose.disconnect();
});

afterEach(async () => {
  onEnterState.mockReset();
  await mongoose.connection.dropDatabase();
});

it('should apply after instantiated', async () => {
  const matter = new Matter();
  expect(matter.matterState).toBe('solid');
  expect(matter.toObject()).toHaveProperty('matterState', 'solid');
  expect(matter.is('solid')).toBeTruthy();
  expect(matter.can('melt')).toBeTruthy();
  expect(matter.cannot('freeze')).toBeTruthy();

  matter.melt();
  expect(matter.matterState).toBe('liquid');
  expect(matter.toObject()).toHaveProperty('matterState', 'liquid');

  matter.matterState = 'gas'; // no effect
  expect(matter.matterState).toBe('liquid');

  expect(onEnterState).toHaveBeenCalledTimes(2);
  const { calls } = onEnterState.mock;
  expect(calls.map(([{ transition }]) => transition)).toEqual(['init', 'melt']);
  expect(calls.map(([{ to }]) => to)).toEqual(['solid', 'liquid']);

  expect(() => matter.condense()).toThrow();
});

it('should apply after retrieved from DB #1(findOne)', async () => {
  const matter = new Matter();
  matter.melt();
  await matter.save();

  onEnterState.mockClear();

  const found = await Matter.findOne();
  expect(found.matterState).toBe('liquid');
  expect(found.toObject()).toHaveProperty('matterState', 'liquid');

  found.vaporize();
  expect(found.matterState).toBe('gas');
  expect(found.toObject()).toHaveProperty('matterState', 'gas');

  found.matterState = 'liquid'; // no effect
  expect(found.matterState).toBe('gas');

  expect(onEnterState).toHaveBeenCalledTimes(1);
  const { calls } = onEnterState.mock;
  expect(calls.map(([{ transition }]) => transition)).toEqual(['vaporize']);
  expect(calls.map(([{ to }]) => to)).toEqual(['gas']);

  expect(() => found.vaporize()).toThrow();
});

it('should apply after retrieved from DB #2(find)', async () => {
  const matter = new Matter();
  matter.melt();
  matter.vaporize();
  await matter.save();

  onEnterState.mockClear();

  const foundColl = await Matter.find();
  const found = foundColl[0];
  expect(found.matterState).toBe('gas');
  expect(found.toObject()).toHaveProperty('matterState', 'gas');

  found.condense();
  expect(found.matterState).toBe('liquid');
  expect(found.toObject()).toHaveProperty('matterState', 'liquid');

  found.matterState = 'solid'; // no effect
  expect(found.matterState).toBe('liquid');

  expect(onEnterState).toHaveBeenCalledTimes(1);
  const { calls } = onEnterState.mock;
  expect(calls.map(([{ transition }]) => transition)).toEqual(['condense']);
  expect(calls.map(([{ to }]) => to)).toEqual(['liquid']);

  expect(() => found.condense()).toThrow();
});

it('should throw error if invalid schema paths', async () => {
  const schema = new mongoose.Schema({ state: String });
  const addPlugin = () => schema.plugin(stateMachinePlugin, {
    fieldName: 'state',
    stateMachine
  });
  expect(() => addPlugin()).toThrow('Invalid schema path: \'state\' is reserved');

  const schema1 = new mongoose.Schema({
    status: String,
    melt: Number
  });
  const addPlugin1 = () => schema1.plugin(stateMachinePlugin, { stateMachine });
  expect(() => addPlugin1()).toThrow('Invalid schema path: \'melt\' is a transition name');

  const schema2 = new mongoose.Schema({});
  const addPlugin2 = () => schema2.plugin(stateMachinePlugin, {
    fieldName: 'status',
    stateMachine
  });
  expect(() => addPlugin2()).toThrow('Failed to find schema real path \'status\'');
});

/**
 * Bugs
 */

// https://github.com/safer-bwd/mongoose-state-machine/issues/4
it('should work find and findOne by state field', async () => {
  const matter = new Matter();
  await matter.save();

  const foundColl = await Matter.find({ matterState: matter.matterState });
  expect(foundColl).toHaveLength(1);
  const found = foundColl[0];
  expect(found.toObject()()).toBe(matter.toObject());

  const found1 = await Matter.findOne({ matterState: matter.matterState });
  expect(found1.toObject()()).toBe(matter.toObject());
});
