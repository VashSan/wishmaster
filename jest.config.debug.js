module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  "testMatch": [
    // all our tests are in typescript, therefor no JS extension here
    "**/__tests__/**/*.+(ts|tsx)",
    "**/?(*.)+(spec|test).+(ts|tsx)"
  ],
  // this harms debugging: "collectCoverage": true
};