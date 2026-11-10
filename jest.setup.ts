import "@testing-library/jest-dom";

// Silence console.log in tests
global.console.log = jest.fn();

// Each API test file starts its own in-memory MongoDB; under a full parallel run that can
// take longer than Jest's 5s default for beforeAll hooks
jest.setTimeout(20_000);
