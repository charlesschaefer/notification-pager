import { Config } from '@jest/types';
import { compilerOptions } from './tsconfig.json';
import { pathsToModuleNameMapper } from 'ts-jest';

const config: Config.InitialOptions = {
    verbose: true,
    testEnvironment: 'node',
    preset: 'ts-jest',
    moduleNameMapper: 
        pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/' }),
};

export default config;