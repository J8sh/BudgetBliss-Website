import type { Config } from "jest";

const config: Config = {
  projects: [
    {
      displayName: "node",
      testEnvironment: "node",
      preset: "ts-jest",
      testMatch: [
        "<rootDir>/src/__tests__/lib/**/*.test.ts",
        "<rootDir>/src/__tests__/models/**/*.test.ts",
        "<rootDir>/src/__tests__/api/**/*.test.ts",
      ],
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
      },
      transform: {
        "^.+\\.tsx?$": [
          "ts-jest",
          {
            tsconfig: {
              module: "commonjs",
              moduleResolution: "node",
              jsx: "react-jsx",
            },
          },
        ],
      },
      setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    },
    {
      displayName: "dom",
      testEnvironment: "jsdom",
      preset: "ts-jest",
      testMatch: ["<rootDir>/src/__tests__/components/**/*.test.tsx"],
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
      },
      transform: {
        "^.+\\.tsx?$": [
          "ts-jest",
          {
            tsconfig: {
              module: "commonjs",
              moduleResolution: "node",
              jsx: "react-jsx",
            },
          },
        ],
      },
      setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    },
  ],
  modulePathIgnorePatterns: ["<rootDir>/.next/"],
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "src/lib/**/*.ts",
    "src/app/api/**/*.ts",
    "src/components/**/*.tsx",
    "!src/**/*.d.ts",
    "!src/**/__tests__/**",
  ],
};

export default config;
