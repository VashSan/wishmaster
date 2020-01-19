import { TagReader } from "./TagReader";
import { Tags, ITags } from "../ChatClient";
import { mock } from "jest-mock-extended";
import { ILogger } from "psst-log";

test('construction', () => {
    let logger = mock<ILogger>();
    expect(() => { new TagReader(new Tags("@id=1"), logger); }).not.toThrow();
    expect(() => { new TagReader(new Tags("@id=1")); }).not.toThrow();
});

test('tag parings', () => {
    // Arrange
    let logger = mock<ILogger>();
    let tags = mock<ITags>();

    let map = new Map<string, string>(
        [["display-name", "Vash"],
        ["mod", "1"], ["subscriber", "0"],
        ["bits", "10"]]);
    tags.getAvailableTags.mockImplementation((): IterableIterator<string> => {
        return map.keys();
    });
    tags.get.mockImplementation((key: string) => {
        return map.get(key) || "";
    });

    // Act
    let tr = new TagReader(tags, logger);

    // Assert
    expect(tr.displayName).toBe('Vash');
    expect(tr.isMod).toBe(true);
});