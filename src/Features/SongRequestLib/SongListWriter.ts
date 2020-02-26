import { IPlaylist } from "./Playlist";
import { IFileSystem, FileSystem } from "../../shared";

export interface ISongListWriter {
    update(): void;
}

export class SongListWriter implements ISongListWriter {
    private readonly playlist: IPlaylist;
    private readonly target: string;
    private readonly fs: IFileSystem;

    constructor(playlist: IPlaylist, target: string, fileSystem?: IFileSystem) {
        this.playlist = playlist;
        this.target = target;
        this.fs = fileSystem ? fileSystem : new FileSystem();
    }

    public update(): void {
        if (this.fs.exists(this.target)) {
            const songList = this.assembleSongList();
            this.fs.writeAll(this.target, songList);
        }
    }
    
    private assembleSongList(): string {
        let result: string[] = [];
        const pastSongs = this.playlist.getAlreadyPlayedSongs();
        let index = pastSongs.length;

        pastSongs.forEach(song => {
            index -= 1;
            let i = index.toString().padStart(3);
            if (index == 0) {
                i = "".padStart(3, ">");
            }

            const title = song.info.title.padEnd(30);
            const artist = song.info.artist.padEnd(30);
            const skipped = song.wasSkipped ? " but was skipped" : "";
            const requester = song.info.requestedBy;
            const playedAt = song.playDate.toISOString();
            
            const newItem = `[${i}] [Title: ${title}] [Artist: ${artist}] was played at ${playedAt}. It was requested by ${requester}${skipped}`;
            result.push(newItem);
        });

        const upcomingSongs = this.playlist.getUpcomingSongs();
        upcomingSongs.forEach(song => {
            index -= 1;
            const i = index.toString().padStart(3);
            const title = song.title.padEnd(30);
            const artist = song.artist.padEnd(30);
            const requester = song.requestedBy;
            
            const newItem = `[${i}] [Title: ${title}] [Artist: ${artist}] was requested by ${requester}`;
            result.push(newItem);
        });

        return result.reverse().join(`\n`);
    }
}

export default SongListWriter;