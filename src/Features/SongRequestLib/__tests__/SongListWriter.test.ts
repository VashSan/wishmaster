import { SongListWriter } from "../SongListWriter";
import { mock } from "jest-mock-extended";
import { IPlaylist } from "..";
import { IFileSystem } from "../../../shared";
import { ISongInfo } from "../Playlist";

test('update', () => {
    // Prepare
    const playlist = mock<IPlaylist>();
    const song1 = mock<ISongInfo>();
    song1.title = "xxx";
    song1.artist = "yyy";
    song1.requestedBy = "alice";

    const song2 = mock<ISongInfo>();
    song2.title = "aaa";
    song2.artist = "bbb";
    song2.requestedBy = "bob";

    playlist.getUpcomingSongs.mockReturnValue([song1]);
    playlist.getAlreadyPlayedSongs.mockReturnValue([{ playDate: new Date(), wasSkipped: true, info: song2 }]); 

    const fs = mock<IFileSystem>();
    fs.exists.mockReturnValue(true);

    const sl = new SongListWriter(playlist, "file.txt", fs);

    // Act
    sl.update();

    // Assert
    expect(fs.writeAll).toBeCalledWith("file.txt", expect.stringMatching(/.*Title: xxx.*\n.*Title: aaa.*/));
});
