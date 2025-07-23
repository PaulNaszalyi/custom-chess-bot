# Chess Bot - Paul_Nas Style Mimicry

A complete chess bot system that learns and mimics a specific player's style using comprehensive game analysis and AI.

## Project Overview

This comprehensive system:
- **Phase 1**: Collects game data from Chess.com and Lichess APIs
- **Phase 2**: Analyzes playing patterns and style preferences
- **Phase 3**: Deploys a live chess bot on Lichess that mimics the analyzed style
- **Status**: Fully operational with 1047-1061 ELO rating

## Technology Stack

- **TypeScript** with Node.js runtime
- **axios** - HTTP client for API requests  
- **chess.js** - Chess game logic and validation
- **pgn-parser** - Chess game notation parser
- **dotenv** - Environment configuration
- **Lichess Bot API** - Live bot deployment

## Project Structure

```
/
├── bot.ts            # Main chess bot (npm run bot)
├── index.ts          # Data collection entry point (npm start)
├── package.json      # Dependencies and scripts
├── tsconfig.json     # TypeScript configuration
├── CLAUDE.md         # Project documentation
├── README.md         # User-facing documentation
├── src/              # Core functionality modules
├── scripts/          # Utility and setup scripts
├── demos/            # Phase demonstrations
├── archive/          # Historical bot versions
├── docs/             # Detailed documentation
└── data/             # Game data and analysis results
```

## Key Components

- **bot.ts** - Main chess bot with Lichess API integration
- **index.ts** - Multi-platform data collection system
- **src/data/** - Chess.com and Lichess extractors
- **src/analysis/** - Style analysis and pattern recognition
- **scripts/** - Deployment and utility tools

## Configuration

- **Player Username**: "Paul_Nas" (Chess.com) / "paul_nas" (Lichess)
- **Bot Username**: "Paul_Nas_Bot" on Lichess
- **API Endpoints**: Chess.com public API + Lichess Bot API
- **Environment**: Configure via `.env` file

## Usage

```bash
# Collect game data
npm start

# Deploy live bot
npm run bot

# Check setup
npm run check-setup

# Run demo
npm run demo
```

## Development Commands

- `npm start` - Data collection from Chess.com/Lichess
- `npm run bot` - Start live chess bot on Lichess
- `npm run check-setup` - Validate configuration
- `npm run demo` - Show all systems working

## Phase 1+ Progress ✅

**Phase 1+ Complete** - Combined Data Collection & Enhanced Analysis

### Implemented Features:
- ✅ Enhanced Chess.com API integration with comprehensive metadata
- ✅ **NEW: Lichess.org data extractor** with full API support
- ✅ **NEW: Combined data extractor** merging both platforms
- ✅ **NEW: Unified data format** for cross-platform analysis
- ✅ Player profile and statistics collection from both sources
- ✅ Structured data storage system with metadata calculation
- ✅ Enhanced analysis pipeline for style profiling
- ✅ Opening repertoire analysis across platforms
- ✅ Game result tracking and win rate calculations

### Data Collected:
- **47 total games** from both Chess.com (46) and Lichess (1)
- **55.3% combined win rate** across platforms
- **Average rating: 441** (range: 238-1500)
- Opening preferences: French Defense, Queen's Pawn Opening, Indian Defense
- Multiple time control preferences (600, 600+0)
- Cross-platform performance metrics

### Current Capabilities:
- **Multi-platform data extraction** from Chess.com and Lichess
- **Unified game analysis** with consistent data format
- **Cross-platform style profiling** and pattern recognition
- **Combined opening repertoire** analysis
- **Integrated time management** and tactical preference tracking
- **Comprehensive player profiling** using data from both sources

### Data Files Generated:
- `data/Paul_Nas_complete_data.json` - Chess.com specific data
- `data/Paul_Nas_unified_data.json` - Combined platform data

## Phase 3 Complete ✅

**All Systems Operational** - Live Chess Bot Deployed

### Bot Performance:
- **ELO Rating**: 1047-1061 (achieved through live gameplay)
- **Platform**: Lichess.org (@Paul_Nas_Bot)
- **Style Accuracy**: Mimics Paul_Nas opening preferences (d4, Queen's Pawn)
- **Tactical Awareness**: Smart piece value evaluation prevents material loss
- **Game Handling**: Proper stalemate, checkmate, and draw detection

### Technical Achievements:
- ✅ **Live Bot Deployment** with real-time Lichess integration
- ✅ **Event Stream Processing** for challenge acceptance
- ✅ **Color Detection** with multiple fallback methods
- ✅ **Strategic Move Selection** with opening/tactical phases
- ✅ **Clean File Organization** with proper project structure
- ✅ **Environment Configuration** with secure token management

### Bot Capabilities:
- **Real-time Gameplay**: Accepts challenges and plays live games
- **Style Mimicry**: Uses analyzed patterns from 47 collected games
- **Opening Book**: Prefers d4, Queen's Pawn Opening, French Defense
- **Tactical Play**: Evaluates piece values, avoids bad trades
- **Game End Handling**: Properly handles all chess game conclusions