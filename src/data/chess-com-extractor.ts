import axios from "axios";
import { parse } from "pgn-parser";
import { DataStorage } from "./data-storage";

export interface PlayerProfile {
    username: string;
    player_id: number;
    title?: string;
    status: string;
    name?: string;
    avatar?: string;
    location?: string;
    country: string;
    joined: number;
    last_online: number;
    followers: number;
    is_streamer: boolean;
    verified: boolean;
}

export interface PlayerStats {
    chess_daily?: GameStats;
    chess_rapid?: GameStats;
    chess_blitz?: GameStats;
    chess_bullet?: GameStats;
    tactics?: TacticsStats;
    lessons?: LessonsStats;
    puzzle_rush?: PuzzleRushStats;
}

export interface GameStats {
    last: RatingInfo;
    best: RatingInfo;
    record: GameRecord;
    tournament?: TournamentRecord;
}

export interface RatingInfo {
    rating: number;
    date: number;
    rd: number;
}

export interface GameRecord {
    win: number;
    loss: number;
    draw: number;
}

export interface TournamentRecord {
    count: number;
    withdraw: number;
    points: number;
    highest_finish: number;
}

export interface TacticsStats {
    highest: RatingInfo;
    lowest: RatingInfo;
}

export interface LessonsStats {
    highest: RatingInfo;
    lowest: RatingInfo;
}

export interface PuzzleRushStats {
    best?: {
        total_attempts: number;
        score: number;
    };
}

export interface GameData {
    url: string;
    pgn: string;
    time_control: string;
    end_time: number;
    rated: boolean;
    tcn: string;
    uuid: string;
    initial_setup: string;
    fen: string;
    time_class: string;
    rules: string;
    white: PlayerGameInfo;
    black: PlayerGameInfo;
    eco?: string;
    opening?: string;
}

export interface PlayerGameInfo {
    rating: number;
    result: string;
    username: string;
    uuid: string;
}

export interface EnhancedGameData extends GameData {
    moves: string[];
    moveCount: number;
    gameResult: string;
    playerColor: 'white' | 'black';
    playerRating: number;
    opponentRating: number;
    ratingDifference: number;
    gameDuration?: number;
}

export class ChessComExtractor {
    private baseUrl = 'https://api.chess.com/pub';
    private username: string;
    private storage: DataStorage;
    private playerData: {
        profile?: PlayerProfile;
        stats?: PlayerStats;
        games: EnhancedGameData[];
        archives: string[];
    } = { games: [], archives: [] };

    constructor(username: string) {
        this.username = username;
        this.storage = new DataStorage(username);
    }

    async fetchPlayerProfile(): Promise<PlayerProfile> {
        try {
            const response = await axios.get(`${this.baseUrl}/player/${this.username}`);
            this.playerData.profile = response.data;
            console.log(`✅ Fetched profile for ${this.username}`);
            return response.data;
        } catch (error) {
            console.error(`❌ Failed to fetch profile for ${this.username}:`, error);
            throw error;
        }
    }

    async fetchPlayerStats(): Promise<PlayerStats> {
        try {
            const response = await axios.get(`${this.baseUrl}/player/${this.username}/stats`);
            this.playerData.stats = response.data;
            console.log(`✅ Fetched stats for ${this.username}`);
            return response.data;
        } catch (error) {
            console.error(`❌ Failed to fetch stats for ${this.username}:`, error);
            throw error;
        }
    }

    async fetchArchives(): Promise<string[]> {
        try {
            const response = await axios.get(`${this.baseUrl}/player/${this.username}/games/archives`);
            this.playerData.archives = response.data.archives;
            console.log(`✅ Found ${this.playerData.archives.length} archive(s)`);
            return this.playerData.archives;
        } catch (error) {
            console.error(`❌ Failed to fetch archives:`, error);
            throw error;
        }
    }

    async fetchGamesFromArchive(archiveUrl: string): Promise<GameData[]> {
        try {
            const response = await axios.get(archiveUrl);
            return response.data.games;
        } catch (error) {
            console.error(`❌ Failed to fetch games from ${archiveUrl}:`, error);
            return [];
        }
    }

    async extractMovesFromPGN(pgn: string): Promise<string[]> {
        try {
            const parsed = parse(pgn);
            return parsed[0]?.moves?.map((m: any) => m.move) || [];
        } catch (error) {
            console.error("❌ Failed to parse PGN:", error);
            return [];
        }
    }

    enhanceGameData(game: GameData): EnhancedGameData {
        const isPlayerWhite = game.white.username.toLowerCase() === this.username.toLowerCase();
        const playerColor = isPlayerWhite ? 'white' : 'black';
        const playerRating = isPlayerWhite ? game.white.rating : game.black.rating;
        const opponentRating = isPlayerWhite ? game.black.rating : game.white.rating;
        
        return {
            ...game,
            moves: [],
            moveCount: 0,
            gameResult: isPlayerWhite ? game.white.result : game.black.result,
            playerColor,
            playerRating,
            opponentRating,
            ratingDifference: playerRating - opponentRating,
            gameDuration: undefined
        };
    }

    async fetchAllGames(maxArchives?: number): Promise<EnhancedGameData[]> {
        if (this.playerData.archives.length === 0) {
            await this.fetchArchives();
        }

        const archivesToProcess = maxArchives 
            ? this.playerData.archives.slice(-maxArchives) 
            : this.playerData.archives;

        console.log(`📥 Processing ${archivesToProcess.length} archive(s)...`);

        for (const [index, archiveUrl] of archivesToProcess.entries()) {
            console.log(`📂 Archive ${index + 1}/${archivesToProcess.length}: ${archiveUrl}`);
            
            const games = await this.fetchGamesFromArchive(archiveUrl);
            
            for (const game of games) {
                const enhancedGame = this.enhanceGameData(game);
                enhancedGame.moves = await this.extractMovesFromPGN(game.pgn);
                enhancedGame.moveCount = enhancedGame.moves.length;
                
                this.playerData.games.push(enhancedGame);
            }
            
            console.log(`✅ Processed ${games.length} games from this archive`);
        }

        console.log(`🎯 Total games collected: ${this.playerData.games.length}`);
        return this.playerData.games;
    }

    async fetchCompletePlayerData(maxArchives?: number): Promise<typeof this.playerData> {
        console.log(`🚀 Starting complete data extraction for ${this.username}...`);
        
        await Promise.all([
            this.fetchPlayerProfile(),
            this.fetchPlayerStats()
        ]);

        await this.fetchAllGames(maxArchives);

        console.log(`✅ Complete data extraction finished!`);
        return this.playerData;
    }

    saveToFile(): void {
        this.storage.savePlayerData(
            this.playerData.profile,
            this.playerData.stats,
            this.playerData.games,
            this.playerData.archives
        );
    }

    loadExistingData(): boolean {
        const existingData = this.storage.loadPlayerData();
        if (existingData) {
            this.playerData = {
                profile: existingData.profile,
                stats: existingData.stats,
                games: existingData.games,
                archives: existingData.archives
            };
            return true;
        }
        return false;
    }

    getStorageSummary(): void {
        this.storage.getDataSummary();
    }

    getPlayerData(): typeof this.playerData {
        return this.playerData;
    }

    printSummary(): void {
        const { profile, stats, games } = this.playerData;
        
        console.log('\n📊 PLAYER DATA SUMMARY');
        console.log('========================');
        
        if (profile) {
            console.log(`👤 Player: ${profile.username}`);
            console.log(`🏆 Title: ${profile.title || 'None'}`);
            console.log(`🌍 Country: ${profile.country}`);
            console.log(`👥 Followers: ${profile.followers}`);
        }

        if (stats) {
            console.log('\n📈 RATINGS:');
            if (stats.chess_blitz) {
                console.log(`⚡ Blitz: ${stats.chess_blitz.last.rating} (Best: ${stats.chess_blitz.best.rating})`);
            }
            if (stats.chess_rapid) {
                console.log(`🏃 Rapid: ${stats.chess_rapid.last.rating} (Best: ${stats.chess_rapid.best.rating})`);
            }
            if (stats.chess_bullet) {
                console.log(`💨 Bullet: ${stats.chess_bullet.last.rating} (Best: ${stats.chess_bullet.best.rating})`);
            }
        }

        console.log(`\n🎮 GAMES COLLECTED: ${games.length}`);
        
        if (games.length > 0) {
            const wins = games.filter(g => g.gameResult === 'win').length;
            const losses = games.filter(g => g.gameResult === 'lose').length;
            const draws = games.filter(g => g.gameResult === 'agreed' || g.gameResult === 'draw').length;
            
            console.log(`🏆 Wins: ${wins}`);
            console.log(`❌ Losses: ${losses}`);
            console.log(`🤝 Draws: ${draws}`);
            console.log(`📊 Win Rate: ${((wins / games.length) * 100).toFixed(1)}%`);
        }
    }
}