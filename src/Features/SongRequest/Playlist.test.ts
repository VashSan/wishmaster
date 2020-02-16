import { Playlist } from "./PlayList";

test('construction', () => {
    expect(() => { new Playlist() }).not.toThrow();
});