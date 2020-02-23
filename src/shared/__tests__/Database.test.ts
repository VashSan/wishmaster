import { Database, UserCollection, LogCollection } from "../Database";

import { MockProxy, mock } from "jest-mock-extended";
import { IConfiguration } from "../Configuration";
import { ILogger } from "psst-log";
import { Seconds } from "../Helper";

jest.mock('nedb');
import Nedb = require("nedb");
import { mocked } from "ts-jest/utils";
import { IMessage } from "../ChatClient";
import TagReader from "../TagReader";

let config: MockProxy<IConfiguration> & IConfiguration;
let logger: MockProxy<ILogger> & ILogger;

describe('Database', () => {
    beforeEach(() => {
        require("nedb");

        config = mock<IConfiguration>();
        logger = mock<ILogger>();
    });

    test('create collection', () => {
        // Arrange
        let db = new Database(config, logger);
        expect(db.getSize()).toBe(0);

        // Act
        db.createCollection(UserCollection, "users");

        // Assert
        expect(Nedb.prototype.loadDatabase).toBeCalledTimes(1);
        expect(db.getSize()).toBe(1);
    });

    test('return created collection', () => {
        // Arrange
        let db = new Database(config, logger);
        expect(db.getSize()).toBe(0);

        // Act
        db.createCollection(UserCollection, "users");
        db.createCollection(LogCollection, "log");

        // Assert
        expect(db.getSize()).toBe(2);

        expect(() => db.get("log")).not.toThrow();
        expect(() => db.get("users")).not.toThrow();
    });

    test('use unavailable database throws', () => {
        let db = new Database(config, logger);
        expect(() => db.get("log")).toThrow();
        expect(() => db.get("users")).toThrow();
    });

    test('loading fails', async () => {
        // Arrange
        let db = new Database(config, logger);

        // Act
        db.createCollection(UserCollection, "users");

        // Assert
        await expect(db.waitAllLoaded(new Seconds(0.1))).rejects.toBeTruthy();
    });

    test('all loaded', async () => {
        // Arrange
        Nedb.prototype.loadDatabase = (cb) => {
            if (cb) {
                let nullParam: any = null
                cb(nullParam); // fake successfull loading
            }
        };
        let db = new Database(config, logger);

        // Act
        db.createCollection(UserCollection, "users");

        // Assert
        await expect(db.waitAllLoaded(new Seconds(0.1))).resolves.toBe(undefined);
    });
});

describe('UserCollection', () => {
    test('newMessage', () => {
        const logger = mock<ILogger>();
        const ndb = mock<Nedb>();

        let docWithNoFollowDate: any = {
            totalBits: 1,
            emoteOnlyCount: 1,
            messageCount: 1
        };

        ndb.findOne.mockImplementation((query, callback) => {
            callback(null, docWithNoFollowDate);
        });
        let uc = new UserCollection("test", ndb, logger);
        const msg: IMessage = {
            channel: "#chan",
            from: "bob",
            text: "Hi",
            tags: mock<TagReader>()
        };

        const act = () => { uc.newMessage(msg); };

        expect(() => act()).not.toThrow();
        expect(ndb.update).toBeCalledTimes(1);
        expect(logger.error).toBeCalledTimes(0);
    });
});