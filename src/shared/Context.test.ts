import { ILogger } from "psst-log";
import { mock } from "jest-mock-extended";
import { Configuration, Context } from ".";
import { Database } from "./Database";
import { ObsController } from "./ObsController";
import * as os from 'os';

function getContext() {
    let config = mock<Configuration>();
    config.getRootPath.mockReturnValue(os.homedir());
    let logger = mock<ILogger>();
    let db = mock<Database>();
    let obs = mock<ObsController>();

    return new Context(config, logger, db, obs);
}

test('construction', () => {
    expect(getContext).not.toThrowError();
});

test('isDeveloper', () => {
    let original = process.env.NODE_ENV;

    try {
        // Arrange
        let context = getContext();

        // Act & Assert
        process.env.NODE_ENV = "dev";
        let isDev = context.isDeveloper();
        expect(isDev).toBe(true);

        process.env.NODE_ENV = "prod";
        isDev = context.isDeveloper();
        expect(isDev).toBe(false);
    } finally {
        process.env.NODE_ENV = original
    }
});

test('add throws when invalid name is provided', () => {
    let config = mock<Configuration>();
    let context = getContext();
    config.getServiceName.mockReturnValue("");

    expect(() => context.add(config)).toThrowError();
});

test('add throws when duplicate name is provided', () => {
    let config = mock<Configuration>();
    let context = getContext();
    config.getServiceName.mockReturnValue("Configuration");

    context.add(config)
    expect(() => context.add(config)).toThrowError();
});

test('add service', () => {
    let config = mock<Configuration>();
    let context = getContext();

    config.getServiceName.mockReturnValue("Configuration");

    expect(() => context.add(config)).not.toThrow();
});

test('get service returns added instance', () => {
    let config = mock<Configuration>();
    let context = getContext();

    config.getServiceName.mockReturnValue("Configuration");
    context.add(config);

    expect(context.get("Configuration")).toBe(config);
});

test('get service throws when adding unknown instance', () => {
    let config = mock<Configuration>();
    let context = getContext();

    config.getServiceName.mockReturnValue("Configuration");
    context.add(config);

    expect(() => context.get("x")).toThrowError();
});