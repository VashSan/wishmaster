import { ILogger } from "psst-log";
import { mock } from "jest-mock-extended";
import { Configuration, Context } from ".";
import { Database } from "./Database";
import { ObsController } from "./ObsController";

function getContext(){
    let context = mock<Configuration>();
    let logger = mock<ILogger>();
    let db = mock<Database>();
    let obs = mock<ObsController>();

    return new Context(context, logger, db, obs);
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