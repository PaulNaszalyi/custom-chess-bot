import { EnhancedGameData, PlayerStats } from '../data/chess-com-extractor';

export interface GameAnalysis {
    gameId: string;
    opening?: {
        eco?: string;
        name?: string;
        moves: string[];
    };
    phases: {
        opening: number;  // Move count where opening ends
        middlegame: number;  // Move count where middlegame ends
        endgame: number;   // Move count where endgame starts
    };
    timeManagement: {
        averageTimePerMove?: number;
        timeInPhases?: {
            opening: number;
            middlegame: number;
            endgame: number;
        };
    };
    tactical: {
        blunders: number;
        mistakes: number;
        inaccuracies: number;
        brilliantMoves: number;
        goodMoves: number;
    };
    positional: {
        castledEarly: boolean;
        centerControl: 'aggressive' | 'balanced' | 'defensive';
        pieceDevelopment: 'fast' | 'normal' | 'slow';
    };
}

export interface StyleProfile {
    username: string;
    openingRepertoire: {
        asWhite: Array<{
            eco: string;
            name: string;
            frequency: number;
            winRate: number;
        }>;
        asBlack: Array<{
            eco: string;
            name: string;
            frequency: number;
            winRate: number;
        }>;
    };
    tacticalStyle: {
        aggressiveness: number;  // 0-100
        riskTaking: number;     // 0-100
        calculationDepth: number; // 0-100
        patternRecognition: number; // 0-100
    };
    positionalStyle: {
        pawnStructurePreference: 'solid' | 'dynamic' | 'aggressive';
        pieceActivity: 'active' | 'balanced' | 'solid';
        spaceControl: 'expansive' | 'normal' | 'compact';
        kingSafety: 'cautious' | 'normal' | 'risky';
    };
    timeManagement: {
        style: 'time_pressure' | 'consistent' | 'slow_start' | 'fast_finish';
        averageGameLength: number;
        criticalMomentHandling: 'panic' | 'steady' | 'cool';
    };
    strengthProfile: {
        ratingRange: {
            min: number;
            max: number;
            average: number;
        };
        consistency: number; // 0-100
        improvementTrend: 'improving' | 'stable' | 'declining';
    };
    preferences: {
        favoriteTimeControl: string;
        preferredGameLength: 'short' | 'medium' | 'long';
        challengeAcceptance: 'all' | 'similar_rating' | 'lower_rating';
    };
}

export class AnalysisPipeline {
    private games: EnhancedGameData[];
    private stats?: PlayerStats;
    private analyses: Map<string, GameAnalysis> = new Map();

    constructor(games: EnhancedGameData[], stats?: PlayerStats) {
        this.games = games;
        this.stats = stats;
    }

    analyzeGame(game: EnhancedGameData): GameAnalysis {
        return {
            gameId: game.uuid,
            opening: this.analyzeOpening(game),
            phases: this.analyzeGamePhases(game),
            timeManagement: this.analyzeTimeManagement(game),
            tactical: this.analyzeTactical(game),
            positional: this.analyzePositional(game)
        };
    }

    private analyzeOpening(game: EnhancedGameData): GameAnalysis['opening'] {
        return {
            eco: game.eco,
            name: game.opening,
            moves: game.moves.slice(0, Math.min(20, Math.floor(game.moves.length / 3)))
        };
    }

    private analyzeGamePhases(game: EnhancedGameData): GameAnalysis['phases'] {
        const totalMoves = game.moveCount;
        return {
            opening: Math.min(20, Math.floor(totalMoves * 0.3)),
            middlegame: Math.min(40, Math.floor(totalMoves * 0.7)),
            endgame: Math.floor(totalMoves * 0.7)
        };
    }

    private analyzeTimeManagement(game: EnhancedGameData): GameAnalysis['timeManagement'] {
        // Basic time analysis - would need more detailed time data from Chess.com
        return {
            averageTimePerMove: game.gameDuration ? game.gameDuration / game.moveCount : undefined
        };
    }

    private analyzeTactical(game: EnhancedGameData): GameAnalysis['tactical'] {
        // Placeholder - would need chess engine analysis for accurate tactical evaluation
        return {
            blunders: 0,
            mistakes: 0,
            inaccuracies: 0,
            brilliantMoves: 0,
            goodMoves: game.moveCount
        };
    }

    private analyzePositional(game: EnhancedGameData): GameAnalysis['positional'] {
        // Basic positional analysis from move patterns
        const hasCastling = game.moves.some(move => move === 'O-O' || move === 'O-O-O');
        
        return {
            castledEarly: hasCastling && game.moves.findIndex(move => move === 'O-O' || move === 'O-O-O') < 15,
            centerControl: this.determineCenterControl(game.moves),
            pieceDevelopment: this.determineDevelopmentSpeed(game.moves)
        };
    }

    private determineCenterControl(moves: string[]): 'aggressive' | 'balanced' | 'defensive' {
        const centerMoves = moves.slice(0, 20).filter(move => 
            move.includes('e4') || move.includes('e5') || 
            move.includes('d4') || move.includes('d5') ||
            move.includes('c4') || move.includes('c5')
        );
        
        if (centerMoves.length >= 4) return 'aggressive';
        if (centerMoves.length >= 2) return 'balanced';
        return 'defensive';
    }

    private determineDevelopmentSpeed(moves: string[]): 'fast' | 'normal' | 'slow' {
        const developmentMoves = moves.slice(0, 15).filter(move => 
            /^[NBRQ]/.test(move) || move === 'O-O' || move === 'O-O-O'
        );
        
        if (developmentMoves.length >= 6) return 'fast';
        if (developmentMoves.length >= 3) return 'normal';
        return 'slow';
    }

    analyzeAllGames(): Map<string, GameAnalysis> {
        console.log(`🔍 Analyzing ${this.games.length} games...`);
        
        this.games.forEach((game, index) => {
            if (index % 50 === 0) {
                console.log(`📊 Processed ${index}/${this.games.length} games`);
            }
            const analysis = this.analyzeGame(game);
            this.analyses.set(game.uuid, analysis);
        });

        console.log(`✅ Analysis complete for ${this.games.length} games`);
        return this.analyses;
    }

    generateStyleProfile(): StyleProfile {
        if (this.analyses.size === 0) {
            this.analyzeAllGames();
        }

        return {
            username: this.games[0]?.white.username === this.games[0]?.black.username ? 
                      this.games[0].white.username : 'Unknown',
            openingRepertoire: this.analyzeOpeningRepertoire(),
            tacticalStyle: this.analyzeTacticalStyle(),
            positionalStyle: this.analyzePositionalStyle(),
            timeManagement: this.analyzeTimeManagementStyle(),
            strengthProfile: this.analyzeStrengthProfile(),
            preferences: this.analyzePreferences()
        };
    }

    private analyzeOpeningRepertoire(): StyleProfile['openingRepertoire'] {
        const whiteGames = this.games.filter(g => g.playerColor === 'white');
        const blackGames = this.games.filter(g => g.playerColor === 'black');

        const analyzeOpenings = (games: EnhancedGameData[]) => {
            const openingCounts = new Map<string, { count: number; wins: number; eco: string }>();
            
            games.forEach(game => {
                const key = game.opening || game.eco || 'Unknown';
                const existing = openingCounts.get(key) || { count: 0, wins: 0, eco: game.eco || '' };
                existing.count++;
                if (game.gameResult === 'win') existing.wins++;
                openingCounts.set(key, existing);
            });

            return Array.from(openingCounts.entries())
                .map(([name, data]) => ({
                    eco: data.eco,
                    name,
                    frequency: (data.count / games.length) * 100,
                    winRate: games.length > 0 ? (data.wins / data.count) * 100 : 0
                }))
                .sort((a, b) => b.frequency - a.frequency)
                .slice(0, 10);
        };

        return {
            asWhite: analyzeOpenings(whiteGames),
            asBlack: analyzeOpenings(blackGames)
        };
    }

    private analyzeTacticalStyle(): StyleProfile['tacticalStyle'] {
        // Placeholder implementation - would need detailed game analysis
        return {
            aggressiveness: 50,
            riskTaking: 50,
            calculationDepth: 50,
            patternRecognition: 50
        };
    }

    private analyzePositionalStyle(): StyleProfile['positionalStyle'] {
        const analyses = Array.from(this.analyses.values());
        
        const fastCastling = analyses.filter(a => a.positional.castledEarly).length;
        const centerControl = analyses.map(a => a.positional.centerControl);
        const development = analyses.map(a => a.positional.pieceDevelopment);

        return {
            pawnStructurePreference: 'solid',
            pieceActivity: development.filter(d => d === 'fast').length > analyses.length / 2 ? 'active' : 'balanced',
            spaceControl: centerControl.filter(c => c === 'aggressive').length > analyses.length / 2 ? 'expansive' : 'normal',
            kingSafety: fastCastling > analyses.length / 2 ? 'cautious' : 'normal'
        };
    }

    private analyzeTimeManagementStyle(): StyleProfile['timeManagement'] {
        const avgGameLength = this.games.reduce((sum, g) => sum + g.moveCount, 0) / this.games.length;
        
        return {
            style: 'consistent',
            averageGameLength: Math.round(avgGameLength),
            criticalMomentHandling: 'steady'
        };
    }

    private analyzeStrengthProfile(): StyleProfile['strengthProfile'] {
        const ratings = this.games.map(g => g.playerRating).filter(r => r > 0);
        
        if (ratings.length === 0) {
            return {
                ratingRange: { min: 0, max: 0, average: 0 },
                consistency: 50,
                improvementTrend: 'stable'
            };
        }

        return {
            ratingRange: {
                min: Math.min(...ratings),
                max: Math.max(...ratings),
                average: Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length)
            },
            consistency: 75,
            improvementTrend: 'stable'
        };
    }

    private analyzePreferences(): StyleProfile['preferences'] {
        const timeControls = this.games.map(g => g.time_control);
        const timeControlCounts = timeControls.reduce((acc, tc) => {
            acc[tc] = (acc[tc] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const favoriteTimeControl = Object.entries(timeControlCounts)
            .sort(([, a], [, b]) => b - a)[0]?.[0] || 'unknown';

        return {
            favoriteTimeControl,
            preferredGameLength: 'medium',
            challengeAcceptance: 'similar_rating'
        };
    }

    printAnalysisSummary(): void {
        const profile = this.generateStyleProfile();
        
        console.log('\n🎯 STYLE ANALYSIS SUMMARY');
        console.log('==========================');
        console.log(`👤 Player: ${profile.username}`);
        console.log(`⭐ Average Rating: ${profile.strengthProfile.ratingRange.average}`);
        console.log(`🎮 Favorite Time Control: ${profile.preferences.favoriteTimeControl}`);
        console.log(`♔ King Safety: ${profile.positionalStyle.kingSafety}`);
        console.log(`🏰 Space Control: ${profile.positionalStyle.spaceControl}`);
        
        console.log('\n📈 TOP OPENINGS:');
        console.log('As White:');
        profile.openingRepertoire.asWhite.slice(0, 3).forEach((opening, i) => {
            console.log(`  ${i + 1}. ${opening.name} (${opening.frequency.toFixed(1)}%, ${opening.winRate.toFixed(1)}% wins)`);
        });
        
        console.log('As Black:');
        profile.openingRepertoire.asBlack.slice(0, 3).forEach((opening, i) => {
            console.log(`  ${i + 1}. ${opening.name} (${opening.frequency.toFixed(1)}%, ${opening.winRate.toFixed(1)}% wins)`);
        });
    }

    getStyleProfile(): StyleProfile {
        return this.generateStyleProfile();
    }

    getGameAnalyses(): Map<string, GameAnalysis> {
        return this.analyses;
    }
}