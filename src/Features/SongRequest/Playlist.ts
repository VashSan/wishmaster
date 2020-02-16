
export enum MediaLibrary {
    Spotify,
    YouTube
}

export interface ISongInfo {
    id: string;
    source: MediaLibrary;
    title: string;
    artist: string;
}

export interface IPlaylist {
    enqueue(song: ISongInfo): void;
    getCurrent(): ISongInfo;
    skip(): void;
    start(): void;
    stop(): void;
}

export class Playlist implements IPlaylist {

    //TODO make configurable
    private readonly maxQueueLength = 20;
    private readonly maxEntriesPerUser = 5;

    enqueue(song: ISongInfo): void {
        throw new Error("Method not implemented.");
    }
    getCurrent(): ISongInfo {
        throw new Error("Method not implemented.");
    }
    skip(): void {
        throw new Error("Method not implemented.");
    }
    start(): void {
        throw new Error("Method not implemented.");
    }
    stop(): void {
        throw new Error("Method not implemented.");
    }



}