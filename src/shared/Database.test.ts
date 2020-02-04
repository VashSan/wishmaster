import { Database } from "./Database";

import Nedb = require("nedb");
jest.mock('nedb');


test('create collection', () => {
    // Arrange
    let db = new Database();
    expect(db.getSize()).toBe(0);

    // Act
    db.createCollection("users", {
        timestampData: true
    }, () => { });

    // Assert
    expect(Nedb.prototype.loadDatabase).toBeCalledTimes(1);
    expect(db.getSize()).toBe(1);
});

test('return created collection', () => {
    // Arrange
    let db = new Database();
    expect(db.getSize()).toBe(0);

    // Act
    db.createCollection("users", { timestampData: true }, () => { });
    db.createCollection("log", { timestampData: true }, () => { });

    // Assert
    expect(db.getSize()).toBe(2);

    expect(() => db.get("log")).not.toThrow();
    expect(() => db.get("users")).not.toThrow();
});

test('use unavailable database throws', () => {
    let db = new Database();
    expect(() => db.get("log")).toThrow();
    expect(() => db.get("users")).toThrow();
});