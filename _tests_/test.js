const mongoose = require('mongoose');

beforeAll(async () => {
  await mongoose.connect(process.env.DB_MONGO_URI, {
    auth: (process.env.DB_MONGO_USER) ? {
      user: process.env.DB_MONGO_USER,
      password: process.env.DB_MONGO_PASSWORD
    } : null,
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false
  });
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

it('test', async () => {
});
