import { SongListWriter } from "../SongListWriter";
import { mock } from "jest-mock-extended";
import { IPlaylist } from "..";
import { IFileSystem } from "../../../shared";
import { MediaLibrary } from "../Playlist";

test('update', () => {
    // Prepare
    const playlist = mock<IPlaylist>();
    playlist.getUpcomingSongs.mockReturnValue([{ uri: "", source: MediaLibrary.Unknown, title: "xxx", artist: "", requestedBy: "" }]);
    playlist.getAlreadyPlayedSongs.mockReturnValue([{ playDate: new Date(), wasSkipped: true, info: { uri: "", source: MediaLibrary.Unknown, title: "aaa", artist: "", requestedBy: ""} }]); 
    //info: { uri: "", source: MediaLibrary.Unknown, title: "xxx", artist: "", requestedBy: ""} 

    const fs = mock<IFileSystem>();
    fs.exists.mockReturnValue(true);

    const sl = new SongListWriter(playlist, "file.txt", fs);

    // Act
    sl.update();

    // Assert
    expect(fs.writeAll).toBeCalledWith("file.txt", expect.stringMatching(/.*Title: xxx.*\n.*Title: aaa.*/));
});
