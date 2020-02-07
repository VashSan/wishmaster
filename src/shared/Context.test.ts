import { ILogger } from "psst-log";
import { mock } from "jest-mock-extended";
import { Configuration, Context } from ".";
import { Database } from "./Database";
import { IObsController } from "./ObsController";
import * as os from 'os';
import { IEmail } from "./Email";

function getContext() {
    let config = mock<Configuration>();
    config.getRootPath.mockReturnValue(os.homedir());
    let logger = mock<ILogger>();
    let db = mock<Database>();
    let obs = mock<IObsController>();
    let email = mock<IEmail>();

    return new Context(config, logger, db, obs, email);
}

test('construction', () => {
    expect(getContext).not.toThrowError();
});

test('get context methods', () => {
    let context = getContext();
    expect(context.getConfiguration()).toBeTruthy();
    expect(context.getDatabase()).toBeTruthy();
    expect(context.getMediaPlayer()).toBeTruthy();
    expect(context.getObs()).toBeTruthy();
    expect(context.getEmail()).toBeTruthy();
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
