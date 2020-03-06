import { IApiWrapper } from "../SongRequest";
import { Seconds, IPlaylistConfig, ArrayManip } from "../../shared";
import { ILogger, LogManager } from "psst-log";

export enum MediaLibrary {
    Unknown,
    Spotify,
    YouTube
}

export interface IPreviousSong {
    playDate: Date;
    wasSkipped: boolean;
    info: ISongInfo;
}

export interface ISongInfo {
    uri: string;
    source: MediaLibrary;
    title: string;
    artist: string;
    requestedBy: string;
    imageUrl: string;
}

export interface IPlaylist {
    /**
     * Adds a song to the queue.
     * @param song the song to be added.
     * @returns  Will return false if queue is full, otherwise true.
     */
    enqueue(song: ISongInfo): boolean;

    /**
     * @returns A new list of previously played or started songs (including current).
     */
    getAlreadyPlayedSongs(): IPreviousSong[];

    /**
     * @returns The current song or null if none is being played.
     */
    getCurrent(): ISongInfo | null;

    /**
     * @returns A new list of upcoming songs.
     */
    getUpcomingSongs(): ISongInfo[];

    /**
     * Removes a song for a distinct user.
     * @param username The user requesting the removal.
     * @returns the song if it could be removed, otherwise null.
     */
    removeLastSongFromUser(username: string): ISongInfo | null;

    /**
     * @param song Check whether this song is in the queue
     * @returns True if the song is in the future playlist, otherwise false.
     */
    isInQueue(song: ISongInfo): boolean;

    /**
     * @param callback This callback is invoked, once a new song is triggered by the playlist or with null if the playlist ended.
     */
    onNext(callback: (song: ISongInfo | null) => void): void;

    /**
     * Shuffles all songs in the current playlist.
     */
    shuffle(): void;

    skip(): void;
    start(): void;
    stop(): void;
}

export class Playlist implements IPlaylist {
    private readonly maxWaitTimeUntilUpdate = new Seconds(10);
    private readonly list: ISongInfo[] = [];
    private readonly alreadyPlayed: IPreviousSong[] = [];
    private readonly api: IApiWrapper;
    private readonly config: IPlaylistConfig;
    private readonly logger: ILogger;
    private readonly onNextCallbacks: ((song: ISongInfo | null) => void)[] = [];

    private currentSong: ISongInfo | null = null;
    private timer: NodeJS.Timer | undefined = undefined;
    private shouldUpdateAt: Date = new Date();

    constructor(apiWrapper: IApiWrapper, config?: IPlaylistConfig, logger?: ILogger) {
        this.api = apiWrapper;
        this.logger = logger ? logger : LogManager.getLogger();
        this.config = config ? config : {
            updateIntervalInSeconds: 2,
            maxQueueLength: 20,
            maxEntriesPerUser: 4
        };
    }

    public isRunning(): boolean {
        return this.timer != undefined;
    }

    public enqueue(song: ISongInfo): boolean {
        if (this.canEnqueue(song.requestedBy)) {
            this.list.push(song);
            this.resetNextUpdate();
            return true;
        }
        return false;
    }

    private canEnqueue(user: string): boolean {
        if (this.timer == undefined) {
            return false;
        }

        const maxLimitExceeded = this.list.length > this.config.maxQueueLength;
        if (maxLimitExceeded) {
            return false
        };

        const tracksFromUser = this.list.filter((s) => s.requestedBy == user);
        const tracksPerUserExceeded = tracksFromUser.length > this.config.maxEntriesPerUser;
        if (tracksPerUserExceeded) {
            return false;
        }

        return true;
    }

    public getCurrent(): ISongInfo | null {
        return this.currentSong;
    }

    public isInQueue(song: ISongInfo): boolean {
        for (let item of this.list) {
            if (item.uri == song.uri) {
                return true;
            }
        }

        if (this.currentSong?.uri == song.uri) {
            return true;
        }

        return false;
    }

    public shuffle(): void {
        ArrayManip.Shuffle(this.list);
    }

    public skip(): void {
        this.alreadyPlayedSkipLastSong();
        this.playNextSong();
        this.resetNextUpdate();
    }

    private alreadyPlayedSkipLastSong() {
        const lastIndex = this.alreadyPlayed.length - 1;
        if (lastIndex >= 0) {
            this.alreadyPlayed[lastIndex].wasSkipped = true;
        }
    }

    private resetNextUpdate() {
        setTimeout(() => {
            this.shouldUpdateAt = new Date(0);
        }, new Seconds(1).inMilliseconds());
    }

    public start(): void {
        if (this.isRunning()) {
            return;
        }

        const update = new Seconds(this.config.updateIntervalInSeconds);
        this.timer = setInterval(() => {
            this.update();
        }, update.inMilliseconds());
    }

    public stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
    }

    public removeLastSongFromUser(username: string): ISongInfo | null {
        let removedSong: ISongInfo | null = null;
        for (let index = this.list.length - 1; index >= 0; index--) {
            const item = this.list[index];
            if (item.requestedBy.toLowerCase() == username.toLowerCase()) {
                const removedOnes = this.list.splice(index, 1);
                removedSong = removedOnes[0];
                break;
            }
        }
        return removedSong;
    }

    public onNext(callback: (song: ISongInfo | null) => void): void {
        this.onNextCallbacks.push(callback);
    }

    private invokeOnNext(song: ISongInfo | null) {
        this.onNextCallbacks.forEach((cb) => {
            try {
                cb(song);
            }
            catch (err) {
                this.logger.error("onNext callback failed: " + err);
            }
        });
    }

    private playNextSong() {
        if (this.isRunning()) {
            let nextSong = this.list.shift();
            if (nextSong) {
                this.addSongToAlreadyPlayedList(nextSong);

                this.currentSong = nextSong;
                this.logger.log(`Playlist.playNextSong: play now (${nextSong.uri})`);
                this.api.playNow(nextSong.uri);
            } else {
                this.currentSong = null;
            }
            this.invokeOnNext(nextSong || null);
        }
    }

    private addSongToAlreadyPlayedList(song: ISongInfo) {
        const previousSong: IPreviousSong = {
            info: song,
            playDate: new Date(),
            wasSkipped: false
        };
        this.alreadyPlayed.push(previousSong);
    }

    private update() {
        const tolerance = 100;

        if (Date.now() < this.shouldUpdateAt.getTime()) {
            return;
        }

        this.api
            .getRemainingTrackTime()
            .then((remaining: Seconds) => {
                const remainingMs = remaining.inMilliseconds();
                if (remainingMs < tolerance) {
                    this.playNextSong();
                } else {
                    const max = this.maxWaitTimeUntilUpdate.inMilliseconds();
                    const nextUpdate = remainingMs < max ? remainingMs : max;
                    const updateAt = Date.now() + nextUpdate;
                    this.shouldUpdateAt.setTime(updateAt);
                }
            })
            .catch((err) => {
                this.logger.warn("Playlist.update: Could not fetch remaining track time.", JSON.stringify(err));
            });
    }

    public getAlreadyPlayedSongs(): IPreviousSong[] {
        return [...this.alreadyPlayed];
    }

    public getUpcomingSongs(): ISongInfo[] {
        return [...this.list];
    }
}