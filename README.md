# Chess Bot - Paul_Nas Style Mimicry

A chess bot that learns and mimics a specific player's style using game analysis and AI.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure your bot (copy and edit .env.example)
cp .env.example .env

# 3. Check setup
npm run check-setup

# 4. Start the bot
npm run bot
```

## Commands

- `npm start` - Collect game data from Chess.com/Lichess
- `npm run bot` - Start the chess bot on Lichess
- `npm run check-setup` - Validate configuration
- `npm run demo` - Show all systems working together

## Bot Features

- **Style Mimicry**: Plays like the analyzed player
- **Opening Book**: Uses historical game preferences
- **Tactical Awareness**: Smart piece value evaluation
- **Adaptive Learning**: Improves from each game
- **Multi-platform**: Chess.com + Lichess data

## File Structure

```
/
├── bot.ts              # Main bot (run with npm run bot)
├── index.ts            # Data collection (npm start)
├── src/                # Core functionality
├── scripts/            # Utility scripts
├── demos/              # Demo files
├── archive/            # Old bot versions
├── docs/               # Documentation
└── data/               # Game data and analysis
```

## Documentation

See `docs/` folder for detailed guides:
- `QUICK_START.md` - Fast setup guide
- `LICHESS_DEPLOYMENT_GUIDE.md` - Deployment details
- `PHASE3_SUMMARY.md` - Complete feature overview

---

**Your chess bot is ready to compete! 🏆**