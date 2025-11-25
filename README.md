# Telegram Helper Bot (TGH)

AI-powered Telegram bot that uses Claude CLI to understand and execute your requests.

## Setup

### 1. Get a Telegram Bot Token

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot` and follow the prompts
3. Copy the bot token provided

**Note:** The bot will have its own identity - bots cannot send messages as your personal account. To interact with it, simply search for your bot's username in Telegram and start a private chat.

### 2. Set up Claude CLI

The bot uses the `claude` CLI in headless mode. Make sure you have it installed and authenticated:

```bash
# The Claude CLI will use your existing authentication
# Just ensure 'claude' is available in your PATH
claude --version
```

### 3. Local Development

```bash
# Install dependencies
bun install

# Create .env file
cp .env.example .env

# Edit .env and add your bot token
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Run the bot
bun run dev
```

### 4. Deploy to Render

The bot is configured to deploy via Docker on Render:

1. Push your code to GitHub (already done!)

2. Set environment variables in Render:
   - `TELEGRAM_BOT_TOKEN`: Your Telegram bot token from @BotFather
   - `ANTHROPIC_API_KEY`: Your Anthropic API key (for Claude CLI authentication)

3. Deploy using the included `render.yaml` configuration

The Dockerfile automatically installs the Claude CLI during the build process.

## How It Works

The bot:
1. Receives messages via Grammy (Telegram bot framework)
2. Passes them to Claude CLI using `claude -p "message"`
3. Returns Claude's response back to the user

This approach gives you the full power of Claude with all its capabilities:
- Natural language understanding
- Code execution and analysis
- Web search
- File operations
- And any MCP tools you have configured

## Extending the Bot

Since the bot uses Claude CLI directly, it automatically gets all Claude's capabilities. You can:

- Configure MCP servers for additional tools
- Use Claude's built-in capabilities for various tasks
- Customize prompts and behavior as needed

## Architecture

- **Grammy**: Lightweight Telegram bot framework
- **Claude CLI**: Headless mode for AI processing
- **Bun**: Fast JavaScript runtime and package manager
- **Biome**: Linting and formatting
- **Render**: Hosting platform with Docker support

## Development

```bash
# Format code
bun run format

# Lint code
bun run lint

# Run in development mode (with watch)
bun run dev
```
