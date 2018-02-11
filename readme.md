# Wishmaster

## Setup Workspace
* Install Node
* npm -g install typescript
* npm -g install eslint
* add excludes to workspace settings

			"**/.git": true,
			"**/*.js.map": true,
			"**/*.js": { "when": "$(basename).ts" },
			"**/**.js": { "when": "$(basename).tsx" }