import { IApiWrapper } from "../SongRequest";
import { Seconds, IPlaylistConfig } from "../../shared";
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
}

export interface IPlaylist {
    /**
     * Adds a song to the queue. Will return false if queue is full
     * @param song the song request
     */
    enqueue(song: ISongInfo): boolean;
    getCurrent(): ISongInfo | null;

    isInQueue(song: ISongInfo): boolean;
    skip(): void;
    start(): void;
    stop(): void;
    removeLastSongFromUser(username: string): ISongInfo | null;

    /**
     * Get a list of already played or started songs (includes current)
     */
    getAlreadyPlayedSongs(): IPreviousSong[];

    /**
     * Get a list of the upcoming songs
     */
    getUpcomingSongs(): ISongInfo[];
}

export class Playlist implements IPlaylist {
    private readonly list: ISongInfo[] = [];
    private readonly alreadyPlayed: IPreviousSong[] = [];
    private readonly api: IApiWrapper;
    private readonly config: IPlaylistConfig;
    private readonly logger: ILogger;

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

    public canEnqueue(user: string): boolean {
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

    private playNextSong() {
        if (this.isRunning()) {
            const nextSong = this.list.shift();
            if (nextSong) {
                this.addSongToAlreadyPlayedList(nextSong);

                this.currentSong = nextSong;
                this.logger.log(`Playlist.playNextSong: play now (${nextSong.uri})`);
                this.api.playNow(nextSong.uri);
            } else {
                this.currentSong = null;
            }
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
        if (this.list.length == 0) {
            return;
        }

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
                    this.shouldUpdateAt = new Date(remainingMs);
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