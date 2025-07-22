import { UnifiedGameData } from '../data/combined-extractor';

export interface OpeningStats {
    eco: string;
    name: string;
    frequency: number;
    games: number;
    results: {
        wins: number;
        losses: number;
        draws: number;
        winRate: number;
    };
    averageRating: number;
    ratingPerformance: number;
    commonContinuations: Array<{
        moves: string[];
        frequency: number;
        success: number;
    }>;
    opponentStrengths: {
        vsStronger: { games: number; winRate: number };
        vsWeaker: { games: number; winRate: number };
        vsSimilar: { games: number; winRate: number };
    };
}

export interface OpeningRepertoire {
    asWhite: {
        mainLines: OpeningStats[];
        responses: Map<string, OpeningStats[]>; // Opponent's first move -> your responses
        gambits: OpeningStats[];
        solid: OpeningStats[];
        aggressive: OpeningStats[];
    };
    asBlack: {
        vsE4: OpeningStats[];
        vsD4: OpeningStats[];
        vsOther: OpeningStats[];
        defensiveSetups: OpeningStats[];
        counterAttacking: OpeningStats[];
    };
    strengths: string[];
    weaknesses: string[];
    recommendations: Array<{
        type: 'expand' | 'improve' | 'avoid';
        opening: string;
        reason: string;
        priority: number;
    }>;
}

export interface OpeningPattern {
    pattern: string;
    description: string;
    frequency: number;
    success: number;
    examples: Array<{
        gameId: string;
        moves: string[];
        result: string;
    }>;
}

export class OpeningAnalyzer {
    private games: UnifiedGameData[];
    private openingStats: Map<string, OpeningStats> = new Map();

    constructor(games: UnifiedGameData[]) {
        this.games = games;
    }

    private categorizeOpening(opening: string): {
        type: 'solid' | 'aggressive' | 'gambit' | 'defensive' | 'counterattacking';
        mainLine: boolean;
    } {
        const openingLower = opening.toLowerCase();
        
        if (openingLower.includes('gambit')) {
            return { type: 'gambit', mainLine: false };
        }
        
        if (openingLower.includes('french') || openingLower.includes('caro-kann') || 
            openingLower.includes('petroff') || openingLower.includes('berlin')) {
            return { type: 'solid', mainLine: true };
        }
        
        if (openingLower.includes('sicilian') || openingLower.includes('pirc') || 
            openingLower.includes('dragon') || openingLower.includes('najdorf')) {
            return { type: 'counterattacking', mainLine: true };
        }
        
        if (openingLower.includes('attack') || openingLower.includes('aggressive') ||
            openingLower.includes('wing') || openingLower.includes('bird')) {
            return { type: 'aggressive', mainLine: false };
        }
        
        if (openingLower.includes('london') || openingLower.includes('colle') ||
            openingLower.includes('torre') || openingLower.includes('stonewall')) {
            return { type: 'solid', mainLine: false };
        }
        
        // Default categorization for main openings
        return { type: 'solid', mainLine: true };
    }

    private getOpponentFirstMove(game: UnifiedGameData): string | null {
        if (game.moves.length === 0) return null;
        
        if (game.playerColor === 'white') {
            // As white, we want opponent's first move (their response to our 1st move)
            return game.moves.length > 1 ? game.moves[1] : null;
        } else {
            // As black, opponent's first move is the first move in the game
            return game.moves[0];
        }
    }

    private calculateRatingPerformance(stats: OpeningStats): number {
        // Calculate performance rating based on results and opponent strength
        const { wins, losses, draws } = stats.results;
        const totalGames = wins + losses + draws;
        
        if (totalGames === 0) return stats.averageRating;
        
        const score = (wins + draws * 0.5) / totalGames;
        const performanceAdjustment = (score - 0.5) * 400; // Standard Elo calculation
        
        return Math.round(stats.averageRating + performanceAdjustment);
    }

    private analyzeCommonContinuations(games: UnifiedGameData[]): Array<{
        moves: string[];
        frequency: number;
        success: number;
    }> {
        const continuations = new Map<string, { count: number; wins: number }>();
        
        games.forEach(game => {
            // Get first 8 moves (4 moves per side) as continuation
            const continuation = game.moves.slice(0, 8);
            const key = continuation.join(' ');
            
            const existing = continuations.get(key) || { count: 0, wins: 0 };
            existing.count++;
            if (game.gameResult === 'win') existing.wins++;
            continuations.set(key, existing);
        });

        return Array.from(continuations.entries())
            .filter(([, data]) => data.count >= 2) // At least 2 games
            .map(([moves, data]) => ({
                moves: moves.split(' '),
                frequency: (data.count / games.length) * 100,
                success: (data.wins / data.count) * 100
            }))
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, 5);
    }

    private analyzeOpponentStrengths(games: UnifiedGameData[], playerRating: number): OpeningStats['opponentStrengths'] {
        const stronger = games.filter(g => g.opponentRating > playerRating + 100);
        const weaker = games.filter(g => g.opponentRating < playerRating - 100);
        const similar = games.filter(g => Math.abs(g.opponentRating - playerRating) <= 100);

        const calculateWinRate = (gameSet: UnifiedGameData[]) => {
            if (gameSet.length === 0) return 0;
            return (gameSet.filter(g => g.gameResult === 'win').length / gameSet.length) * 100;
        };

        return {
            vsStronger: { games: stronger.length, winRate: calculateWinRate(stronger) },
            vsWeaker: { games: weaker.length, winRate: calculateWinRate(weaker) },
            vsSimilar: { games: similar.length, winRate: calculateWinRate(similar) }
        };
    }

    analyzeOpeningStats(): Map<string, OpeningStats> {
        const openingGroups = new Map<string, UnifiedGameData[]>();
        
        // Group games by opening
        this.games.forEach(game => {
            if (!game.opening?.name) return;
            
            const openingName = game.opening.name;
            if (!openingGroups.has(openingName)) {
                openingGroups.set(openingName, []);
            }
            openingGroups.get(openingName)!.push(game);
        });

        // Analyze each opening
        openingGroups.forEach((games, openingName) => {
            const wins = games.filter(g => g.gameResult === 'win').length;
            const losses = games.filter(g => g.gameResult === 'loss').length;
            const draws = games.filter(g => g.gameResult === 'draw').length;
            
            const totalGames = games.length;
            const averageRating = games.reduce((sum, g) => sum + g.playerRating, 0) / totalGames;
            
            const stats: OpeningStats = {
                eco: games[0].opening?.eco || '',
                name: openingName,
                frequency: (totalGames / this.games.length) * 100,
                games: totalGames,
                results: {
                    wins,
                    losses,
                    draws,
                    winRate: (wins / totalGames) * 100
                },
                averageRating: Math.round(averageRating),
                ratingPerformance: 0, // Will be calculated below
                commonContinuations: this.analyzeCommonContinuations(games),
                opponentStrengths: this.analyzeOpponentStrengths(games, averageRating)
            };
            
            stats.ratingPerformance = this.calculateRatingPerformance(stats);
            this.openingStats.set(openingName, stats);
        });

        return this.openingStats;
    }

    generateOpeningRepertoire(): OpeningRepertoire {
        if (this.openingStats.size === 0) {
            this.analyzeOpeningStats();
        }

        const whiteGames = this.games.filter(g => g.playerColor === 'white');
        const blackGames = this.games.filter(g => g.playerColor === 'black');

        // Analyze White repertoire
        const whiteOpenings = Array.from(this.openingStats.values())
            .filter(stats => whiteGames.some(g => g.opening?.name === stats.name));

        const asWhite = {
            mainLines: whiteOpenings.filter(s => this.categorizeOpening(s.name).mainLine)
                .sort((a, b) => b.frequency - a.frequency),
            responses: new Map<string, OpeningStats[]>(),
            gambits: whiteOpenings.filter(s => this.categorizeOpening(s.name).type === 'gambit'),
            solid: whiteOpenings.filter(s => this.categorizeOpening(s.name).type === 'solid'),
            aggressive: whiteOpenings.filter(s => this.categorizeOpening(s.name).type === 'aggressive')
        };

        // Analyze responses to opponent's moves
        const responseGroups = new Map<string, OpeningStats[]>();
        whiteGames.forEach(game => {
            const opponentMove = this.getOpponentFirstMove(game);
            if (opponentMove && game.opening?.name) {
                const stats = this.openingStats.get(game.opening.name);
                if (stats) {
                    if (!responseGroups.has(opponentMove)) {
                        responseGroups.set(opponentMove, []);
                    }
                    responseGroups.get(opponentMove)!.push(stats);
                }
            }
        });
        asWhite.responses = responseGroups;

        // Analyze Black repertoire
        const blackOpenings = Array.from(this.openingStats.values())
            .filter(stats => blackGames.some(g => g.opening?.name === stats.name));

        const vsE4 = blackGames.filter(g => g.moves[0] === 'e4')
            .map(g => g.opening?.name)
            .filter((name, index, arr) => name && arr.indexOf(name) === index)
            .map(name => this.openingStats.get(name!))
            .filter(Boolean) as OpeningStats[];

        const vsD4 = blackGames.filter(g => g.moves[0] === 'd4')
            .map(g => g.opening?.name)
            .filter((name, index, arr) => name && arr.indexOf(name) === index)
            .map(name => this.openingStats.get(name!))
            .filter(Boolean) as OpeningStats[];

        const vsOther = blackOpenings.filter(stats => 
            !vsE4.includes(stats) && !vsD4.includes(stats));

        const asBlack = {
            vsE4: vsE4.sort((a, b) => b.frequency - a.frequency),
            vsD4: vsD4.sort((a, b) => b.frequency - a.frequency),
            vsOther: vsOther.sort((a, b) => b.frequency - a.frequency),
            defensiveSetups: blackOpenings.filter(s => 
                this.categorizeOpening(s.name).type === 'defensive'),
            counterAttacking: blackOpenings.filter(s => 
                this.categorizeOpening(s.name).type === 'counterattacking')
        };

        // Identify strengths and weaknesses
        const allStats = Array.from(this.openingStats.values());
        const strengths = allStats
            .filter(s => s.games >= 3 && s.results.winRate >= 60)
            .map(s => s.name);

        const weaknesses = allStats
            .filter(s => s.games >= 3 && s.results.winRate <= 40)
            .map(s => s.name);

        // Generate recommendations
        const recommendations = this.generateRecommendations(allStats);

        return {
            asWhite,
            asBlack,
            strengths,
            weaknesses,
            recommendations
        };
    }

    private generateRecommendations(stats: OpeningStats[]): Array<{
        type: 'expand' | 'improve' | 'avoid';
        opening: string;
        reason: string;
        priority: number;
    }> {
        const recommendations: Array<{
            type: 'expand' | 'improve' | 'avoid';
            opening: string;
            reason: string;
            priority: number;
        }> = [];

        stats.forEach(stat => {
            // Recommend expanding successful openings
            if (stat.results.winRate >= 70 && stat.games >= 3) {
                recommendations.push({
                    type: 'expand',
                    opening: stat.name,
                    reason: `High success rate (${stat.results.winRate.toFixed(1)}%) - consider playing more often`,
                    priority: Math.round(stat.results.winRate + stat.frequency)
                });
            }

            // Recommend improving struggling openings
            if (stat.results.winRate <= 40 && stat.games >= 3) {
                recommendations.push({
                    type: 'improve',
                    opening: stat.name,
                    reason: `Low win rate (${stat.results.winRate.toFixed(1)}%) - needs study or refinement`,
                    priority: Math.round(100 - stat.results.winRate + stat.frequency)
                });
            }

            // Recommend avoiding poor performing openings
            if (stat.results.winRate <= 25 && stat.games >= 5) {
                recommendations.push({
                    type: 'avoid',
                    opening: stat.name,
                    reason: `Very poor results (${stat.results.winRate.toFixed(1)}% in ${stat.games} games)`,
                    priority: Math.round(100 - stat.results.winRate)
                });
            }
        });

        return recommendations.sort((a, b) => b.priority - a.priority).slice(0, 10);
    }

    identifyOpeningPatterns(): OpeningPattern[] {
        const patterns: OpeningPattern[] = [];
        
        // Pattern 1: Early queen development
        const earlyQueenGames = this.games.filter(game => {
            const firstFewMoves = game.moves.slice(0, 6).join(' ');
            return firstFewMoves.includes('Qh5') || firstFewMoves.includes('Qf3') || firstFewMoves.includes('Qd4');
        });

        if (earlyQueenGames.length > 0) {
            patterns.push({
                pattern: 'Early Queen Development',
                description: 'Tendency to develop queen early in the game',
                frequency: (earlyQueenGames.length / this.games.length) * 100,
                success: (earlyQueenGames.filter(g => g.gameResult === 'win').length / earlyQueenGames.length) * 100,
                examples: earlyQueenGames.slice(0, 3).map(g => ({
                    gameId: g.gameId,
                    moves: g.moves.slice(0, 10),
                    result: g.gameResult
                }))
            });
        }

        // Pattern 2: Castle preference
        const shortCastleGames = this.games.filter(game => game.moves.includes('O-O'));
        const longCastleGames = this.games.filter(game => game.moves.includes('O-O-O'));

        if (shortCastleGames.length > longCastleGames.length * 2) {
            patterns.push({
                pattern: 'Short Castling Preference',
                description: 'Strong preference for kingside castling over queenside',
                frequency: (shortCastleGames.length / this.games.length) * 100,
                success: (shortCastleGames.filter(g => g.gameResult === 'win').length / shortCastleGames.length) * 100,
                examples: shortCastleGames.slice(0, 3).map(g => ({
                    gameId: g.gameId,
                    moves: g.moves.slice(0, 15),
                    result: g.gameResult
                }))
            });
        }

        // Pattern 3: Central pawn preference
        const centralPawnGames = this.games.filter(game => {
            const firstTenMoves = game.moves.slice(0, 10).join(' ');
            return firstTenMoves.includes('e4') || firstTenMoves.includes('d4') || 
                   firstTenMoves.includes('e5') || firstTenMoves.includes('d5');
        });

        if (centralPawnGames.length > this.games.length * 0.7) {
            patterns.push({
                pattern: 'Central Control Focus',
                description: 'Consistent focus on central pawn control',
                frequency: (centralPawnGames.length / this.games.length) * 100,
                success: (centralPawnGames.filter(g => g.gameResult === 'win').length / centralPawnGames.length) * 100,
                examples: centralPawnGames.slice(0, 3).map(g => ({
                    gameId: g.gameId,
                    moves: g.moves.slice(0, 8),
                    result: g.gameResult
                }))
            });
        }

        return patterns.sort((a, b) => b.frequency - a.frequency);
    }

    printOpeningAnalysis(): void {
        const repertoire = this.generateOpeningRepertoire();
        const patterns = this.identifyOpeningPatterns();

        console.log('\n🔍 ADVANCED OPENING ANALYSIS');
        console.log('==============================');

        console.log('\n📋 WHITE REPERTOIRE:');
        console.log('Main Lines:');
        repertoire.asWhite.mainLines.slice(0, 5).forEach((opening, i) => {
            console.log(`  ${i + 1}. ${opening.name}`);
            console.log(`      ${opening.frequency.toFixed(1)}% | ${opening.results.winRate.toFixed(1)}% wins | Perf: ${opening.ratingPerformance}`);
        });

        if (repertoire.asWhite.gambits.length > 0) {
            console.log('\nGambits:');
            repertoire.asWhite.gambits.forEach(opening => {
                console.log(`  • ${opening.name} - ${opening.results.winRate.toFixed(1)}% wins`);
            });
        }

        console.log('\n📋 BLACK REPERTOIRE:');
        if (repertoire.asBlack.vsE4.length > 0) {
            console.log('vs 1.e4:');
            repertoire.asBlack.vsE4.slice(0, 3).forEach(opening => {
                console.log(`  • ${opening.name} - ${opening.results.winRate.toFixed(1)}% wins`);
            });
        }

        if (repertoire.asBlack.vsD4.length > 0) {
            console.log('vs 1.d4:');
            repertoire.asBlack.vsD4.slice(0, 3).forEach(opening => {
                console.log(`  • ${opening.name} - ${opening.results.winRate.toFixed(1)}% wins`);
            });
        }

        console.log('\n💪 STRENGTHS:');
        repertoire.strengths.slice(0, 3).forEach(strength => {
            console.log(`  ✅ ${strength}`);
        });

        console.log('\n⚠️ WEAKNESSES:');
        repertoire.weaknesses.slice(0, 3).forEach(weakness => {
            console.log(`  ❌ ${weakness}`);
        });

        console.log('\n🎯 TOP RECOMMENDATIONS:');
        repertoire.recommendations.slice(0, 3).forEach((rec, i) => {
            const icon = rec.type === 'expand' ? '📈' : rec.type === 'improve' ? '🔧' : '🚫';
            console.log(`  ${i + 1}. ${icon} ${rec.type.toUpperCase()}: ${rec.opening}`);
            console.log(`      ${rec.reason}`);
        });

        if (patterns.length > 0) {
            console.log('\n🔄 OPENING PATTERNS:');
            patterns.forEach(pattern => {
                console.log(`  • ${pattern.pattern}: ${pattern.frequency.toFixed(1)}% frequency, ${pattern.success.toFixed(1)}% success`);
                console.log(`    ${pattern.description}`);
            });
        }
    }

    getOpeningStats(): Map<string, OpeningStats> {
        if (this.openingStats.size === 0) {
            this.analyzeOpeningStats();
        }
        return this.openingStats;
    }

    getOpeningRepertoire(): OpeningRepertoire {
        return this.generateOpeningRepertoire();
    }

    getOpeningPatterns(): OpeningPattern[] {
        return this.identifyOpeningPatterns();
    }
}