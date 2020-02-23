import SpotifyWebApi = require("spotify-web-api-node");
import { ILogger, LogManager } from "psst-log";
import { IApiWrapper, ICanReply } from "../SongRequest";
import { IPlaylist, ISongInfo, MediaLibrary } from "./Playlist";
import { IMessage, Seconds } from "../../shared";

export class SongInfo implements ISongInfo {
    constructor(track: SpotifyApi.TrackObjectFull, requestBy: string, logger?: ILogger) {
        try {
            this.uri = track.uri;
            this.source = MediaLibrary.Spotify;
            this.title = track.name;
            this.artist = track.artists[0].name;
            this.requestedBy = requestBy;
        } catch (err) {
            const log = logger ? logger : LogManager.getLogger();
            log.error(err);
        }
    }

    uri: string = "";
    source: MediaLibrary = MediaLibrary.Unknown;
    title: string = "";
    artist: string = "";
    requestedBy: string = "";
}

export class SpotifyApiWrapper implements IApiWrapper {

    private readonly api: SpotifyWebApi;
    private readonly logger: ILogger;
    private readonly chat: ICanReply;
    private playlist: IPlaylist | undefined;

    constructor(chat: ICanReply, api?: SpotifyWebApi, logger?: ILogger) {
        this.chat = chat;
        this.api = api ? api : new SpotifyWebApi();
        this.logger = logger ? logger : LogManager.getLogger();
    }

    public usePlaylist(playlist: IPlaylist) {
        this.playlist = playlist;
    }

    public updateApiToken(token: string): void {
        this.api.setAccessToken(token);
    }

    public requestSong(request: string, msg: IMessage) {
        if (!this.playlist) {
            this.logger.error("requestSong: No playlist initialized.");
            return;
        }

        const spotifyRegex = /spotify:track:([A-Za-z0-9]+)|https:\/\/open\.spotify\.com\/track\/([A-Za-z0-9]+)/;
        const result = spotifyRegex.exec(request);
        if (result != null && result.length > 1) {
            let songId = result[1] ? result[1] : result[2];
            this.requestSongById(songId, msg);
        } else {
            this.requestSongByName(request, msg);
        }
    }

    private requestSongByName(request: string, msg: IMessage) {
        this.api.searchTracks(request)
            .then((result) => {
                const track = result?.body.tracks?.items[0];
                if (track != undefined) {
                    const song = new SongInfo(track, msg.from);
                    return this.playOrEnqueueTrack(song);
                }
            })
            .catch((err) => this.handleRequestError(msg, err));
    }

    private requestSongById(songId: string, msg: IMessage) {
        this.api.getTrack(songId)
            .then((track) => {
                if (track && track.body) {
                    const song = new SongInfo(track.body, msg.from);
                    return this.playOrEnqueueTrack(song);
                }
            })
            .catch((err) => this.handleRequestError(msg, err));
    }

    private playOrEnqueueTrack(song: ISongInfo): Promise<void> | PromiseLike<void> | undefined {
        if (this.playlist) {
            if (this.playlist.isInQueue(song)){
                this.chat.reply(`Sorry @${song.requestedBy}, the song is already in the queue.`);
                return Promise.resolve();
            }

            if (this.playlist.enqueue(song)) {
                this.chat.reply(`SingsNote @${song.requestedBy} added '${song.title}' (from ${song.artist}) to the playlist SingsNote`);
            } else {
                this.chat.reply(`Sorry @${song.requestedBy}, you can not add more songs to the playlist.`);
            }
            return Promise.resolve();
        } else {
            // API has an own response type I cannot use, so translate with this thingy
            return this.api
                .play({ uris: [song.uri] })
                .then(() => Promise.resolve())
                .catch((err) => Promise.reject(err));
        }
    }

    private handleRequestError(msg: IMessage, err: any) {
        this.logger.warn("[!sr] Could not retrieve song.", JSON.stringify(err), JSON.stringify(msg));
        this.chat.reply(`Sorry @${msg.from} - your song was not found!`);
    }

    public requestCurrentSongInfo(msg: IMessage) {
        this.api.getMyCurrentPlaybackState().then((state) => {
            if (state.body.is_playing) {
                return this.api.getMyCurrentPlayingTrack();
            }
        }).then((result) => {
            if (result) {
                const trackNameOpt = result.body.item?.name.toString();
                const trackName = trackNameOpt || "";
                const artistOpt = result.body.item?.artists[0].name.toString();
                const artist = artistOpt || "";

                if (trackName != "") {
                    this.chat.reply(`Current song: '${trackName}' from ${artist}`);
                }
            }
        }).catch((err) => {
            // What could possibly go wrong?
            this.logger.error("[!song] Could not retrieve song info.", JSON.stringify(err), JSON.stringify(msg));
        });
    }

    public async isPausedOrStopped(): Promise<boolean> {
        const state = await this.api.getMyCurrentPlaybackState();

        if (state.body.is_playing == undefined) {
            return Promise.reject("Unknown playback state");
        }
        else {
            return Promise.resolve(!state.body.is_playing);
        }
    }

    public async getRemainingTrackTime(): Promise<Seconds> {
        const state = await this.api.getMyCurrentPlaybackState();

        if (state.body.is_playing == undefined) {
            return Promise.reject("Unknown playback state");
        } else {
            const duration = state.body.item?.duration_ms || -1;
            const progress = state.body.progress_ms || - 1;
            if (duration < 0 || progress < 0) {
                return Promise.resolve(new Seconds(0));
            }

            let remainingSeconds = (duration - progress) / 1000;
            if (state.body.is_playing) {
                const seconds = new Seconds(remainingSeconds);
                return Promise.resolve(seconds);
            }

            return Promise.resolve(new Seconds(0));
        }
    }

    public playNow(uri: string): void {
        this.api.play({ uris: [uri] });
    }
}

export default SpotifyApiWrapper;