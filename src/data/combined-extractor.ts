import { ChessComExtractor, EnhancedGameData as ChessComGame, PlayerProfile as ChessComProfile, PlayerStats as ChessComStats } from './chess-com-extractor';
import { LichessExtractor, EnhancedLichessGame, LichessProfile } from './lichess-extractor';
import { DataStorage } from './data-storage';

export interface UnifiedGameData {
    source: 'chess.com' | 'lichess';
    gameId: string;
    url?: string;
    pgn: string;
    moves: string[];
    moveCount: number;
    
    // Player info
    playerColor: 'white' | 'black';
    playerRating: number;
    opponentRating: number;
    ratingDifference: number;
    
    // Game metadata
    gameResult: 'win' | 'loss' | 'draw' | 'unknown';
    timeControl: string;
    timeClass?: string;
    variant?: string;
    rated: boolean;
    
    // Timing
    startTime: number;
    endTime?: number;
    gameDurationMs?: number;
    
    // Opening
    opening?: {
        eco?: string;
        name?: string;
        ply?: number;
    };
    
    // Analysis (if available)
    analysis?: {
        inaccuracy?: number;
        mistake?: number;
        blunder?: number;
        acpl?: number; // Average centipawn loss
    };
}

export interface UnifiedPlayerProfile {
    username: string;
    sources: {
        chesscom?: {
            profile: ChessComProfile;
            stats: ChessComStats;
        };
        lichess?: {
            profile: LichessProfile;
        };
    };
    combinedStats: {
        totalGames: number;
        winRate: number;
        averageRating: number;
        ratingRange: {
            min: number;
            max: number;
        };
        favoriteTimeControls: string[];
        topOpenings: Array<{
            name: string;
            frequency: number;
            winRate: number;
            source: 'chess.com' | 'lichess' | 'both';
        }>;
    };
}

export class CombinedExtractor {
    private chessComExtractor?: ChessComExtractor;
    private lichessExtractor?: LichessExtractor;
    private storage: DataStorage;
    private username: string;
    
    private unifiedData: {
        profile: UnifiedPlayerProfile;
        games: UnifiedGameData[];
    } = { 
        profile: { username: '', sources: {}, combinedStats: { totalGames: 0, winRate: 0, averageRating: 0, ratingRange: { min: 0, max: 0 }, favoriteTimeControls: [], topOpenings: [] } }, 
        games: [] 
    };

    constructor(username: string, options: {
        chessComUsername?: string;
        lichessUsername?: string;
    } = {}) {
        this.username = username;
        this.storage = new DataStorage(username);
        
        if (options.chessComUsername || username) {
            this.chessComExtractor = new ChessComExtractor(options.chessComUsername || username);
        }
        
        if (options.lichessUsername || username) {
            this.lichessExtractor = new LichessExtractor(options.lichessUsername || username);
        }
    }

    private convertChessComGame(game: ChessComGame): UnifiedGameData {
        return {
            source: 'chess.com',
            gameId: game.uuid,
            url: game.url,
            pgn: game.pgn,
            moves: game.moves,
            moveCount: game.moveCount,
            playerColor: game.playerColor,
            playerRating: game.playerRating,
            opponentRating: game.opponentRating,
            ratingDifference: game.ratingDifference,
            gameResult: game.gameResult === 'lose' ? 'loss' : 
                       game.gameResult === 'agreed' ? 'draw' :
                       game.gameResult as 'win' | 'loss' | 'draw' | 'unknown',
            timeControl: game.time_control,
            timeClass: game.time_class,
            rated: game.rated,
            startTime: game.end_time * 1000, // Convert to milliseconds
            endTime: game.end_time * 1000,
            gameDurationMs: game.gameDuration,
            opening: game.eco || game.opening ? {
                eco: game.eco,
                name: game.opening,
            } : undefined
        };
    }

    private convertLichessGame(game: EnhancedLichessGame): UnifiedGameData {
        return {
            source: 'lichess',
            gameId: game.id,
            url: `https://lichess.org/${game.id}`,
            pgn: game.pgn,
            moves: game.movesArray,
            moveCount: game.moveCount,
            playerColor: game.playerColor,
            playerRating: game.playerRating,
            opponentRating: game.opponentRating,
            ratingDifference: game.ratingDifference,
            gameResult: game.gameResult,
            timeControl: game.timeControl,
            variant: game.variant,
            rated: game.rated,
            startTime: game.createdAt,
            endTime: game.lastMoveAt,
            gameDurationMs: game.gameDurationMs,
            opening: game.opening,
            analysis: game.players[game.playerColor].analysis
        };
    }

    async fetchChessComData(maxArchives: number = 3): Promise<void> {
        if (!this.chessComExtractor) {
            console.log('⚠️ Chess.com extractor not configured');
            return;
        }

        console.log('📥 Fetching Chess.com data...');
        await this.chessComExtractor.fetchCompletePlayerData(maxArchives);
        
        const chessComData = this.chessComExtractor.getPlayerData();
        
        // Store Chess.com profile data
        this.unifiedData.profile.sources.chesscom = {
            profile: chessComData.profile!,
            stats: chessComData.stats!
        };

        // Convert and add games
        const convertedGames = chessComData.games.map(game => this.convertChessComGame(game));
        this.unifiedData.games.push(...convertedGames);

        console.log(`✅ Added ${convertedGames.length} Chess.com games`);
    }

    async fetchLichessData(maxGames: number = 100): Promise<void> {
        if (!this.lichessExtractor) {
            console.log('⚠️ Lichess extractor not configured');
            return;
        }

        console.log('📥 Fetching Lichess data...');
        await this.lichessExtractor.fetchCompletePlayerData(maxGames);
        
        const lichessData = this.lichessExtractor.getPlayerData();
        
        // Store Lichess profile data
        this.unifiedData.profile.sources.lichess = {
            profile: lichessData.profile!
        };

        // Convert and add games
        const convertedGames = lichessData.games.map(game => this.convertLichessGame(game));
        this.unifiedData.games.push(...convertedGames);

        console.log(`✅ Added ${convertedGames.length} Lichess games`);
    }

    private calculateCombinedStats(): void {
        const games = this.unifiedData.games;
        
        if (games.length === 0) {
            return;
        }

        // Basic stats
        const wins = games.filter(g => g.gameResult === 'win').length;
        const ratings = games.map(g => g.playerRating).filter(r => r > 0);
        
        // Time controls
        const timeControlCounts = new Map<string, number>();
        games.forEach(game => {
            const tc = game.timeControl;
            timeControlCounts.set(tc, (timeControlCounts.get(tc) || 0) + 1);
        });

        const favoriteTimeControls = Array.from(timeControlCounts.entries())
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([tc]) => tc);

        // Openings
        const openingCounts = new Map<string, { total: number; wins: number; sources: Set<string> }>();
        games.forEach(game => {
            if (game.opening?.name) {
                const name = game.opening.name;
                const existing = openingCounts.get(name) || { total: 0, wins: 0, sources: new Set() };
                existing.total++;
                if (game.gameResult === 'win') existing.wins++;
                existing.sources.add(game.source);
                openingCounts.set(name, existing);
            }
        });

        const topOpenings = Array.from(openingCounts.entries())
            .map(([name, data]) => ({
                name,
                frequency: (data.total / games.length) * 100,
                winRate: (data.wins / data.total) * 100,
                source: data.sources.size > 1 ? 'both' as const : 
                        data.sources.has('chess.com') ? 'chess.com' as const : 'lichess' as const
            }))
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, 10);

        this.unifiedData.profile.combinedStats = {
            totalGames: games.length,
            winRate: (wins / games.length) * 100,
            averageRating: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
            ratingRange: {
                min: ratings.length > 0 ? Math.min(...ratings) : 0,
                max: ratings.length > 0 ? Math.max(...ratings) : 0
            },
            favoriteTimeControls,
            topOpenings
        };

        this.unifiedData.profile.username = this.username;
    }

    async fetchAllData(options: {
        chessComArchives?: number;
        lichessMaxGames?: number;
    } = {}): Promise<typeof this.unifiedData> {
        console.log(`🚀 Starting combined data extraction for ${this.username}...`);

        const promises: Promise<void>[] = [];

        if (this.chessComExtractor) {
            promises.push(this.fetchChessComData(options.chessComArchives || 3));
        }

        if (this.lichessExtractor) {
            promises.push(this.fetchLichessData(options.lichessMaxGames || 100));
        }

        // Fetch data from both platforms concurrently
        await Promise.all(promises);

        // Calculate combined statistics
        this.calculateCombinedStats();

        // Sort games by date (newest first)
        this.unifiedData.games.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));

        console.log(`✅ Combined data extraction complete!`);
        return this.unifiedData;
    }

    saveToFile(): void {
        const filename = `${this.username}_combined_data.json`;
        this.storage.savePlayerData(
            this.unifiedData.profile.sources.chesscom?.profile,
            this.unifiedData.profile.sources.chesscom?.stats,
            [], // Empty games array since we're using unified format
            []  // Empty archives array
        );

        // Also save the unified data separately
        const unifiedFilename = `data/${this.username}_unified_data.json`;
        try {
            const fs = require('fs');
            fs.writeFileSync(unifiedFilename, JSON.stringify(this.unifiedData, null, 2));
            console.log(`💾 Unified data saved to ${unifiedFilename}`);
        } catch (error) {
            console.error(`❌ Failed to save unified data:`, error);
        }
    }

    printCombinedSummary(): void {
        const { profile, games } = this.unifiedData;
        
        console.log('\n🌍 COMBINED DATA SUMMARY');
        console.log('=========================');
        console.log(`👤 Player: ${profile.username}`);
        console.log(`🎮 Total Games: ${profile.combinedStats.totalGames}`);
        console.log(`📊 Win Rate: ${profile.combinedStats.winRate.toFixed(1)}%`);
        console.log(`⭐ Average Rating: ${Math.round(profile.combinedStats.averageRating)}`);
        console.log(`📈 Rating Range: ${profile.combinedStats.ratingRange.min} - ${profile.combinedStats.ratingRange.max}`);

        const chessComGames = games.filter(g => g.source === 'chess.com').length;
        const lichessGames = games.filter(g => g.source === 'lichess').length;
        
        console.log('\n📊 DATA SOURCES:');
        console.log(`♟️ Chess.com: ${chessComGames} games`);
        console.log(`♔ Lichess: ${lichessGames} games`);

        console.log('\n⏱️ FAVORITE TIME CONTROLS:');
        profile.combinedStats.favoriteTimeControls.slice(0, 3).forEach((tc, i) => {
            console.log(`  ${i + 1}. ${tc}`);
        });

        console.log('\n🔍 TOP OPENINGS:');
        profile.combinedStats.topOpenings.slice(0, 5).forEach((opening, i) => {
            const sourceIcon = opening.source === 'both' ? '🌍' : 
                              opening.source === 'chess.com' ? '♟️' : '♔';
            console.log(`  ${i + 1}. ${opening.name} ${sourceIcon}`);
            console.log(`      ${opening.frequency.toFixed(1)}% frequency, ${opening.winRate.toFixed(1)}% win rate`);
        });
    }

    getUnifiedData(): typeof this.unifiedData {
        return this.unifiedData;
    }

    getGamesBySource(source: 'chess.com' | 'lichess'): UnifiedGameData[] {
        return this.unifiedData.games.filter(game => game.source === source);
    }

    getRecentGames(limit: number = 10): UnifiedGameData[] {
        return this.unifiedData.games.slice(0, limit);
    }
}