jest.mock('nedb');

import Nedb = require("nedb");
import { Database } from "./Database";

test('create collection', () => {
    // Arrange
    let db = new Database();
    expect(db.size).toBe(0);

    // Act
    db.createCollection("users", {
        timestampData: true
    }, () => { });

    // Assert
    expect(Nedb.prototype.loadDatabase).toBeCalledTimes(1);
    expect(db.size).toBe(1);
});

test('return created collection', () => {
    // Arrange
    let db = new Database();
    expect(db.size).toBe(0);

    // Act
    db.createCollection("users", { timestampData: true }, () => { });
    db.createCollection("log", { timestampData: true }, () => { });

    // Assert
    expect(db.size).toBe(2);
    expect(db.log).toBeInstanceOf(Nedb);
    expect(db.users).toBeInstanceOf(Nedb);
});

test('use unavailable database throws', () => {
    let db = new Database();
    expect(() => db.log).toThrow();
    expect(() => db.users).toThrow();
});