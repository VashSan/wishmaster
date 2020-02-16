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
    enqueue(song: ISongInfo): void;
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

    public enqueue(song: ISongInfo): void {
        // TODO only enqueue if less than max queue length or entries per user
        this.list.push(song);
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