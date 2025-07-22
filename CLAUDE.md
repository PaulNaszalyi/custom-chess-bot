# Chess.com Game Data Extractor

A TypeScript project that fetches and analyzes Chess.com game data for a specific player.

## Project Overview

This application connects to Chess.com's public API to:
- Retrieve game archives for a specified username
- Download individual games from each archive
- Parse PGN (Portable Game Notation) files to extract chess moves
- Display game URLs and complete move sequences

## Technology Stack

- **TypeScript** with Node.js runtime
- **axios** - HTTP client for API requests
- **pgn-parser** - Chess game notation parser
- **ts-node** - TypeScript execution environment

## Project Structure

```
/
├── index.ts          # Main application logic
├── package.json      # Dependencies and scripts
├── tsconfig.json     # TypeScript configuration
└── CLAUDE.md         # This documentation
```

## Key Functions

- `fetchArchives()` - Retrieves list of game archives from Chess.com API
- `fetchGamesFromArchive()` - Downloads games from a specific archive
- `extractMovesFromPGN()` - Parses PGN format to extract move sequences

## Configuration

- **Username**: Currently set to "Paul_Nas" in `index.ts:5`
- **API Endpoint**: Uses Chess.com's public API at `api.chess.com/pub/`

## Usage

```bash
npm start
```

## Development Commands

- `npm start` - Run Phase 1: Enhanced data collection and basic analysis

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

### Next: Phase 2
- Advanced pattern recognition using combined datasets
- Cross-platform tactical analysis and comparison
- Enhanced style mimicry algorithms
- Unified bot decision engine development