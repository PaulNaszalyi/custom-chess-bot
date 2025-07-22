import axios from "axios";
import { parse } from "pgn-parser";

export interface LichessProfile {
    id: string;
    username: string;
    title?: string;
    patron: boolean;
    perfs: {
        [key: string]: {
            games: number;
            rating: number;
            rd: number;
            prog: number;
            prov?: boolean;
        };
    };
    createdAt: number;
    seenAt?: number;
    playTime?: {
        total: number;
        tv: number;
    };
    language?: string;
    url: string;
    nbFollowing?: number;
    nbFollowers?: number;
    count: {
        all: number;
        rated: number;
        ai: number;
        draw: number;
        drawH: number;
        loss: number;
        lossH: number;
        win: number;
        winH: number;
        bookmark: number;
        playing: number;
        import: number;
        me: number;
    };
    streaming?: boolean;
    followable?: boolean;
    following?: boolean;
    blocking?: boolean;
    followsYou?: boolean;
}

export interface LichessGameData {
    id: string;
    rated: boolean;
    variant: string;
    speed: string;
    perf: string;
    createdAt: number;
    lastMoveAt: number;
    status: string;
    players: {
        white: LichessPlayer;
        black: LichessPlayer;
    };
    opening?: {
        eco: string;
        name: string;
        ply: number;
    };
    moves: string;
    pgn: string;
    clock?: {
        initial: number;
        increment: number;
        totalTime: number;
    };
    analysis?: any[];
    winner?: string;
}

export interface LichessPlayer {
    user: {
        name: string;
        title?: string;
        patron?: boolean;
        id: string;
    };
    rating: number;
    ratingDiff?: number;
    analysis?: {
        inaccuracy: number;
        mistake: number;
        blunder: number;
        acpl: number;
    };
}

export interface EnhancedLichessGame extends LichessGameData {
    movesArray: string[];
    moveCount: number;
    gameResult: 'win' | 'loss' | 'draw' | 'unknown';
    playerColor: 'white' | 'black';
    playerRating: number;
    opponentRating: number;
    ratingDifference: number;
    gameDurationMs: number;
    timeControl: string;
}

export class LichessExtractor {
    private baseUrl = 'https://lichess.org/api';
    private username: string;
    private playerData: {
        profile?: LichessProfile;
        games: EnhancedLichessGame[];
    } = { games: [] };

    constructor(username: string) {
        this.username = username;
    }

    async fetchUserProfile(): Promise<LichessProfile> {
        try {
            const response = await axios.get(`${this.baseUrl}/user/${this.username}`);
            this.playerData.profile = response.data;
            console.log(`✅ Fetched Lichess profile for ${this.username}`);
            return response.data;
        } catch (error) {
            console.error(`❌ Failed to fetch Lichess profile for ${this.username}:`, error);
            throw error;
        }
    }

    async fetchUserGames(options: {
        max?: number;
        rated?: boolean;
        since?: number;
        until?: number;
        color?: 'white' | 'black';
        sort?: 'dateAsc' | 'dateDesc';
        withAnalysis?: boolean;
        withOpening?: boolean;
        withClock?: boolean;
    } = {}): Promise<LichessGameData[]> {
        try {
            const params = new URLSearchParams();
            
            if (options.max) params.append('max', options.max.toString());
            if (options.rated !== undefined) params.append('rated', options.rated.toString());
            if (options.since) params.append('since', options.since.toString());
            if (options.until) params.append('until', options.until.toString());
            if (options.color) params.append('color', options.color);
            if (options.sort) params.append('sort', options.sort);
            if (options.withAnalysis) params.append('evals', 'true');
            if (options.withOpening) params.append('opening', 'true');
            if (options.withClock) params.append('clocks', 'true');
            
            params.append('pgnInJson', 'true');
            
            const url = `${this.baseUrl}/games/user/${this.username}?${params.toString()}`;
            console.log(`📥 Fetching Lichess games: ${url}`);
            
            const response = await axios.get(url, {
                headers: {
                    'Accept': 'application/x-ndjson'
                },
                timeout: 30000,
                responseType: 'text' // Get raw text to handle NDJSON properly
            });

            // Parse NDJSON response (each line is a JSON object)
            const games: LichessGameData[] = [];
            
            if (typeof response.data === 'string') {
                const lines = response.data.split('\n').filter((line: string) => line.trim());
                
                for (const line of lines) {
                    try {
                        const game = JSON.parse(line);
                        games.push(game);
                    } catch (parseError) {
                        console.warn('❌ Failed to parse game line:', parseError);
                    }
                }
            } else {
                // If response is already parsed (single game object or array)
                if (Array.isArray(response.data)) {
                    games.push(...response.data);
                } else if (response.data && typeof response.data === 'object') {
                    games.push(response.data);
                }
            }

            console.log(`✅ Fetched ${games.length} games from Lichess`);
            return games;
        } catch (error) {
            console.error(`❌ Failed to fetch Lichess games:`, error);
            return [];
        }
    }

    private parseMovesFromPgn(pgn: string): string[] {
        try {
            const parsed = parse(pgn);
            return parsed[0]?.moves?.map((m: any) => m.move) || [];
        } catch (error) {
            // Fallback: extract moves from PGN text
            return this.extractMovesFromPgnText(pgn);
        }
    }

    private extractMovesFromPgnText(pgn: string): string[] {
        try {
            // Remove headers and comments, then extract moves
            const gameText = pgn.replace(/\[.*?\]/g, '').replace(/\{[^}]*\}/g, '');
            const moveRegex = /(?:\d+\.\s*)?([NBRQK]?[a-h]?[1-8]?x?[a-h][1-8](?:=[NBRQ])?[+#]?|O-O(?:-O)?)/g;
            const moves = gameText.match(moveRegex) || [];
            return moves;
        } catch (error) {
            console.error('❌ Failed to parse moves from PGN:', error);
            return [];
        }
    }

    private enhanceGameData(game: LichessGameData): EnhancedLichessGame {
        const isPlayerWhite = game.players.white.user.name.toLowerCase() === this.username.toLowerCase();
        const playerColor = isPlayerWhite ? 'white' : 'black';
        const playerRating = isPlayerWhite ? game.players.white.rating : game.players.black.rating;
        const opponentRating = isPlayerWhite ? game.players.black.rating : game.players.white.rating;
        
        let gameResult: 'win' | 'loss' | 'draw' | 'unknown' = 'unknown';
        if (game.status === 'draw' || game.status === 'stalemate') {
            gameResult = 'draw';
        } else if (game.winner) {
            gameResult = (game.winner === playerColor) ? 'win' : 'loss';
        }

        const movesArray = game.moves ? game.moves.split(' ').filter(m => m.trim()) : 
                          this.parseMovesFromPgn(game.pgn);

        const timeControl = game.clock ? 
            `${game.clock.initial}+${game.clock.increment}` : 
            game.speed || 'unknown';

        return {
            ...game,
            movesArray,
            moveCount: movesArray.length,
            gameResult,
            playerColor,
            playerRating,
            opponentRating,
            ratingDifference: playerRating - opponentRating,
            gameDurationMs: game.lastMoveAt - game.createdAt,
            timeControl
        };
    }

    async fetchAllGames(maxGames: number = 100): Promise<EnhancedLichessGame[]> {
        console.log(`🔍 Fetching up to ${maxGames} games from Lichess...`);
        
        const games = await this.fetchUserGames({
            max: maxGames,
            sort: 'dateDesc',
            withAnalysis: true,
            withOpening: true,
            withClock: true
        });

        this.playerData.games = games.map(game => this.enhanceGameData(game));
        
        console.log(`🎯 Enhanced ${this.playerData.games.length} Lichess games`);
        return this.playerData.games;
    }

    async fetchCompletePlayerData(maxGames: number = 100): Promise<typeof this.playerData> {
        console.log(`🚀 Starting Lichess data extraction for ${this.username}...`);
        
        await this.fetchUserProfile();
        await this.fetchAllGames(maxGames);
        
        console.log(`✅ Lichess data extraction complete!`);
        return this.playerData;
    }

    getPlayerData(): typeof this.playerData {
        return this.playerData;
    }

    printSummary(): void {
        const { profile, games } = this.playerData;
        
        console.log('\n📊 LICHESS DATA SUMMARY');
        console.log('=========================');
        
        if (profile) {
            console.log(`👤 Player: ${profile.username}`);
            console.log(`🏆 Title: ${profile.title || 'None'}`);
            console.log(`👥 Followers: ${profile.nbFollowers || 0}`);
            console.log(`🎮 Total Games: ${profile.count.all}`);
            
            console.log('\n📈 RATINGS:');
            Object.entries(profile.perfs).forEach(([variant, perf]) => {
                if (perf.games > 0) {
                    console.log(`${variant}: ${perf.rating} (${perf.games} games)`);
                }
            });
        }

        console.log(`\n🎮 GAMES ANALYZED: ${games.length}`);
        
        if (games.length > 0) {
            const wins = games.filter(g => g.gameResult === 'win').length;
            const losses = games.filter(g => g.gameResult === 'loss').length;
            const draws = games.filter(g => g.gameResult === 'draw').length;
            
            console.log(`🏆 Wins: ${wins}`);
            console.log(`❌ Losses: ${losses}`);
            console.log(`🤝 Draws: ${draws}`);
            console.log(`📊 Win Rate: ${((wins / games.length) * 100).toFixed(1)}%`);

            const timeControls = [...new Set(games.map(g => g.timeControl))];
            console.log(`⏱️ Time Controls: ${timeControls.join(', ')}`);

            const openings = games.filter(g => g.opening).map(g => g.opening!.name);
            const uniqueOpenings = [...new Set(openings)];
            console.log(`🔍 Unique Openings: ${uniqueOpenings.length}`);
        }
    }

    getGameStats(): {
        totalGames: number;
        winRate: number;
        averageRating: number;
        timeControls: string[];
        variants: string[];
        openings: Array<{ name: string; count: number }>;
    } {
        const { games } = this.playerData;
        
        if (games.length === 0) {
            return {
                totalGames: 0,
                winRate: 0,
                averageRating: 0,
                timeControls: [],
                variants: [],
                openings: []
            };
        }

        const wins = games.filter(g => g.gameResult === 'win').length;
        const totalRating = games.reduce((sum, g) => sum + g.playerRating, 0);
        
        const timeControls = [...new Set(games.map(g => g.timeControl))];
        const variants = [...new Set(games.map(g => g.variant))];
        
        const openingCounts = new Map<string, number>();
        games.forEach(game => {
            if (game.opening) {
                const name = game.opening.name;
                openingCounts.set(name, (openingCounts.get(name) || 0) + 1);
            }
        });

        const openings = Array.from(openingCounts.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        return {
            totalGames: games.length,
            winRate: (wins / games.length) * 100,
            averageRating: totalRating / games.length,
            timeControls,
            variants,
            openings
        };
    }
}