import { mock } from "jest-mock-extended";
import { ILogger } from "psst-log";
import { TagReader, Emote, UserType } from "../TagReader";
import { Tags, ITags } from "../ChatClient";

test('construction', () => {
    let logger = mock<ILogger>();
    expect(() => { new TagReader(new Tags("@id=1"), logger); }).not.toThrow();
    expect(() => { new TagReader(new Tags("@id=1")); }).not.toThrow();
});

test('tag parsings', () => {
    // Arrange
    let logger = mock<ILogger>();
    let tags = mock<ITags>();

    let map = new Map<string, string>(
        [["display-name", "Vash"],
        ["color", "#000000"],
        ["emote-only", "1"],
        ["mod", "1"], 
        ["subscriber", "0"],
        ["room-id", "12345"],
        ["user-id", "666"],
        ["user-type", "mod"],
        ["emotes", "99:1-5,13-15/200:7-10"],
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
    expect(tr.color).toBe('#000000');
    expect(tr.isMod_obsolete).toBe(true);
    expect(tr.isEmoteOnly()).toBe(true);
    expect(tr.roomId).toBe(12345);
    expect(tr.userId).toBe(666);
    expect(tr.userType).toBe(UserType.Moderator);

    let emote1: Emote = {id: 99, start: 1, end: 5};
    expect(tr.emoteList.values()).toContainEqual(emote1);

    let emote2: Emote = {id: 200, start: 7, end: 10};
    expect(tr.emoteList.values()).toContainEqual(emote2);

    let emote3: Emote = {id: 99, start: 13, end: 15};
    expect(tr.emoteList.values()).toContainEqual(emote3);
});

test('isBroadcaster', () => {
    // Arrange
    let logger = mock<ILogger>();
    let tags = mock<ITags>();

    let map = new Map<string, string>(
        [["display-name", "Vash"],
        ["badges", "admin/1,broadcaster/1,turbo/1"], 
        ["subscriber", "0"],
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
    expect(tr.isBroadcaster()).toBe(true);
    expect(tr.isMod()).toBe(false);
    expect(tr.isSubscriber()).toBe(false);
});