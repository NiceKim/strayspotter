module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/integration/**/*.test.js'],
  globalSetup: './tests/integration/setup.js',
  globalTeardown: './tests/integration/teardown.js',
};
