[![Build Status](https://travis-ci.com/VashSan/wishmaster.svg?branch=master)](https://travis-ci.com/VashSan/wishmaster)

# Wishmaster
An IRC bot for Twitch streamers. This is a rapid protoyping project I use to learn TypeScript & NEDB.

## Working directory
All files are stored in the folder ```%localappdata%\.wishmaster```. 
The file ```wishmaster.json``` contains the configuration.
The files ending with ```.db``` are the Nedb database files.
Files ending with ```.log``` are generated by the logger.

### Configuration
Remember to strip the comments before saving it as configuration file.
```javascript
{
	/** The host name to connect to  */
	"server": "irc.twitch.tv", 

	/** The name used to log on to the server */
	"nickname": "vash1080", 

	/** The OAuth (1) token to identify yourself. Regular passwords are not supported. */
	"password": "oauth:",

	/** The channel to connect to. */
	"channel": "#vash1080",

	/** The bot limit itself to this number of messages in 30 seconds. (2) */
	"msgLimitPer30Sec": 20,

	/** log,info,warn,error ... remove a token to avoid being written to log file. */
	"verbosity": "info,warn,error",
	
	/** Set to true to create a log file within .wishmaster directory. */
	"createLogFile": false,

	/** Set to true to write log messages to console. */
	"createLogConsole": true,

	/** Logger automatically deletes old log files. */
	"maxLogAgeDays": 10,

	/** For custom sounds configure a media player. */
	"mediaPlayer": "C:\Program Files\Windows Media Player\wmplayer.exe",
	
	/** The media players command line options, Each argument is an array item. {0} is replaced by the sound file. */
	"mediaPlayerArgs": ["{0}"],

	/** Configure alerts for new followers etc. */
	"alerts": [
		{
			"trigger": "NewFollower",       // "NewSubscriber", ... TODO complete list and add doc
			"action": "ToggleSceneItem",    // planned: "PlaySoundFile", "WriteTextMessage"
			"parameter": "FollowerAlert",   // the scene item name in OBS, sound file name, text message depending on action
			"sceneTextSource": "",          // The OBS text source holding for new follower text
			"sceneTextPattern": "New:\n{Viewer}", // text pattern, where {Viewer} is replaced, for OBS text source
			"bannerTextSource": "",         // The OBS text source holding a static banner text for alert history
			"bannerTextPattern": "{Viewer}",// text pattern, where {Viewer} is replaced, for OBS banner text source
			"chatPattern": "Thanks {Viewer}",     // text pattern for chat reply
			"durationInSeconds": 3000,      // time span the scene item shall be visible and minimum time between other alerts
			"timeoutInSeconds": 0           // this alert can be triggered again after this timespan, if occurring in between it is dropped
		}
	], 
	/** Email setup (to scan for follower email) */
	"email": {
		"address": "",  // someone@company.test
		"host": "",     // email server address 
		"port": 0,      // email server port number
		"login": "",    // account logon name
		"password": "", // password
		"tls": true     // `true` enables mail transport scramble
	},

	/** OBS Websocket JS configuration, port and password see: Tools->WebSocket Server Settings */
	"obs": {
		"address": "localhost",  // host name where OBS runs
		"port": 4444,            // port name of OBS Websocket instance
		"password": ""           // passphare to connect to OBS Websocket
	},

	/** URLs that are allowed in chat */
	"urlWhiteList": [
		"youtube.com" // example
	],

	/** any nymber of replies connected with a command */
	"staticAnswers": [
		{"trigger": "!discord", "answer": "My discord URL: ..."}
	],

	// experimental stomt config not documented yet 
	// experimental song request config not documented yet 
}
```

1. An oauth token can be generated easily by using the 
[Twitch Chat OAuth token generator](https://twitchapps.com/tmi/). 

   If you ever lose control over this token, 
   [disconnect the app from Twitch](https://www.twitch.tv/settings/connections). 
   You will not need to reset yout password.

2. Check appropriate limit bat or below what 
[Twitch recommends on their dev portal](https://dev.twitch.tv/docs/irc).

   ATOW the limit is 20 per 30 seconds for Users sending commands or messages to 
   channels in which they do not have Moderator or Operator status. It is 100 per 30 
   seconds for moderators or operators.



## Setup Workspace
* Install Node
* npm -g install typescript
* npm -g install eslint
* add excludes to workspace settings

			"**/.git": true,
			"**/*.js.map": true,
			"**/*.js": { "when": "$(basename).ts" },
			"**/**.js": { "when": "$(basename).tsx" }
