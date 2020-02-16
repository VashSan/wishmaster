import { IApiWrapper } from "../SongRequest";
import { Seconds } from "../../shared";

export enum MediaLibrary {
    Spotify,
    YouTube
}

export interface ISongInfo {
    uri: string;
    source: MediaLibrary;
    title: string;
    artist: string;
    requestedBy: string;
}

export interface IPlaylist {
    /**
     * Adds a song to the queue. Will return false if queue is full
     * @param song the song request
     */
    enqueue(song: ISongInfo): boolean;
    getCurrent(): ISongInfo | null;
    skip(): void;
    start(): void;
    stop(): void;
}

export class Playlist implements IPlaylist {

    //TODO make configurable
    private readonly maxQueueLength = 20;
    private readonly maxEntriesPerUser = 5;
    private readonly refreshTimer = new Seconds(2);

    private readonly list: ISongInfo[] = [];
    private readonly api: IApiWrapper;

    private currentSong: ISongInfo | null = null;
    private timer: NodeJS.Timer | undefined = undefined;

    constructor(apiWrapper: IApiWrapper) {
        this.api = apiWrapper;
    }

    public isRunning(): boolean {
        return this.timer != undefined;
    }

    public enqueue(song: ISongInfo): boolean {
        if (this.canEnqueue(song.requestedBy)) {
            this.list.push(song);
            return true;
        }
        return false;
    }

    public canEnqueue(user: string): boolean {
        const maxLimitExceeded = this.list.length > this.maxQueueLength;
        if (maxLimitExceeded) {
            return false
        };

        const tracksFromUser = this.list.filter((s) => s.requestedBy == user);
        const tracksPerUserExceeded = tracksFromUser.length > this.maxEntriesPerUser;
        if (tracksPerUserExceeded) {
            return false;
        }

        return true;
    }

    public getCurrent(): ISongInfo | null {
        return this.currentSong;
    }

    public skip(): void {
        this.playNextSong();
    }

    public start(): void {
        if (this.isRunning()) {
            return;
        }

        this.timer = setInterval(() => {
            this.update();
        }, this.refreshTimer.inMilliseconds());
    }

    public stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
    }

    private update() {
        this.api
            .isPausedOrStopped()
            .then((isStopped: boolean) => {
                if (isStopped) {
                    this.playNextSong();
                }
            });
        // TODO we should catch but we need the logger
    }

    private playNextSong() {
        if (this.isRunning()) {
            const nextSong = this.list.shift();
            if (nextSong) {
                this.currentSong = nextSong;
                this.api.playNow(nextSong.uri);
            } else {
                this.currentSong = null;
            }
        }
    }

}