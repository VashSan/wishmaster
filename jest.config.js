module.exports = {
    "roots": [
        "<rootDir>/src"
    ],
    "testMatch": [
        // all our tests are in typescript, therefor no JS extension here
        "**/__tests__/**/*.+(ts|tsx)",
        "**/?(*.)+(spec|test).+(ts|tsx)"
    ],
    "transform": {
        "^.+\\.(ts|tsx)$": "ts-jest"
    },
}