import { UnifiedGameData } from '../data/combined-extractor';

export interface TacticalPattern {
    name: string;
    description: string;
    moves: string[];
    frequency: number;
    successRate: number;
    difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    examples: Array<{
        gameId: string;
        position: string; // Move number where pattern occurred
        outcome: 'success' | 'missed' | 'failed';
        context: string[];
    }>;
}

export interface TacticalProfile {
    patterns: {
        preferred: TacticalPattern[];
        avoided: TacticalPattern[];
        missed: TacticalPattern[];
    };
    statistics: {
        aggressiveness: number; // 0-100 scale
        riskTaking: number; // 0-100 scale
        tacticalAwareness: number; // 0-100 scale
        calculationDepth: number; // 0-100 scale
        patternRecognition: number; // 0-100 scale
    };
    tendencies: {
        sacrificeWillingness: number;
        exchangePreference: 'material' | 'positional' | 'balanced';
        attackingStyle: 'direct' | 'positional' | 'mixed';
        defensiveApproach: 'solid' | 'active' | 'counterattacking';
    };
    strengths: string[];
    weaknesses: string[];
    recommendations: Array<{
        category: 'study' | 'practice' | 'avoid';
        pattern: string;
        reason: string;
        priority: number;
    }>;
}

export interface MoveCharacteristics {
    move: string;
    moveNumber: number;
    isCapture: boolean;
    isCheck: boolean;
    isCastling: boolean;
    isPawnAdvance: boolean;
    pieceType: 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';
    isForward: boolean;
    isCentralizing: boolean;
    isDefensive: boolean;
    isAggressive: boolean;
}

export class TacticalAnalyzer {
    private games: UnifiedGameData[];
    private tacticalPatterns: Map<string, TacticalPattern> = new Map();

    constructor(games: UnifiedGameData[]) {
        this.games = games;
    }

    private analyzeMoveCharacteristics(move: string, moveNumber: number): MoveCharacteristics {
        const isCapture = move.includes('x');
        const isCheck = move.includes('+');
        const isCastling = move === 'O-O' || move === 'O-O-O';
        const isPawnAdvance = /^[a-h][2-7]/.test(move) || /^[a-h]x/.test(move);
        
        let pieceType: MoveCharacteristics['pieceType'] = 'pawn';
        if (move.startsWith('N')) pieceType = 'knight';
        else if (move.startsWith('B')) pieceType = 'bishop';
        else if (move.startsWith('R')) pieceType = 'rook';
        else if (move.startsWith('Q')) pieceType = 'queen';
        else if (move.startsWith('K')) pieceType = 'king';

        // Determine move characteristics
        const centralSquares = ['d4', 'd5', 'e4', 'e5', 'c4', 'c5', 'f4', 'f5'];
        const isCentralizing = centralSquares.some(square => move.includes(square));
        
        const isForward = this.isMoveForward(move, pieceType);
        const isDefensive = this.isMoveDefensive(move, moveNumber);
        const isAggressive = isCapture || isCheck || this.isMoveAggressive(move, pieceType);

        return {
            move,
            moveNumber,
            isCapture,
            isCheck,
            isCastling,
            isPawnAdvance,
            pieceType,
            isForward,
            isCentralizing,
            isDefensive,
            isAggressive
        };
    }

    private isMoveForward(move: string, pieceType: string): boolean {
        // Simplified forward move detection
        if (pieceType === 'pawn') {
            return /[a-h][4-8]/.test(move); // Pawn advances to 4th rank or higher
        }
        return move.includes('4') || move.includes('5') || move.includes('6');
    }

    private isMoveDefensive(move: string, moveNumber: number): boolean {
        // Early castling or back rank moves are often defensive
        if (move === 'O-O' || move === 'O-O-O') return true;
        if (moveNumber <= 10 && (move.includes('1') || move.includes('2'))) return true;
        return false;
    }

    private isMoveAggressive(move: string, pieceType: string): boolean {
        // Moves toward opponent's territory or attacking moves
        return move.includes('6') || move.includes('7') || move.includes('8') ||
               (pieceType === 'queen' && move.includes('h')) ||
               (pieceType === 'knight' && (move.includes('5') || move.includes('6')));
    }

    private identifyTacticalMotifs(game: UnifiedGameData): TacticalPattern[] {
        const patterns: TacticalPattern[] = [];
        const moves = game.moves;
        const playerMoves = this.getPlayerMoves(moves, game.playerColor);

        // Pattern 1: Pin attacks
        const pinPatterns = this.identifyPins(playerMoves, game);
        patterns.push(...pinPatterns);

        // Pattern 2: Forks
        const forkPatterns = this.identifyForks(playerMoves, game);
        patterns.push(...forkPatterns);

        // Pattern 3: Skewers
        const skewerPatterns = this.identifySkewers(playerMoves, game);
        patterns.push(...skewerPatterns);

        // Pattern 4: Discovered attacks
        const discoveredPatterns = this.identifyDiscoveredAttacks(playerMoves, game);
        patterns.push(...discoveredPatterns);

        // Pattern 5: Sacrifices
        const sacrificePatterns = this.identifySacrifices(playerMoves, game);
        patterns.push(...sacrificePatterns);

        return patterns;
    }

    private getPlayerMoves(allMoves: string[], playerColor: 'white' | 'black'): Array<{move: string, index: number}> {
        const playerMoves: Array<{move: string, index: number}> = [];
        
        for (let i = 0; i < allMoves.length; i++) {
            const isWhiteMove = i % 2 === 0;
            if ((playerColor === 'white' && isWhiteMove) || (playerColor === 'black' && !isWhiteMove)) {
                playerMoves.push({ move: allMoves[i], index: i });
            }
        }
        
        return playerMoves;
    }

    private identifyPins(playerMoves: Array<{move: string, index: number}>, game: UnifiedGameData): TacticalPattern[] {
        const patterns: TacticalPattern[] = [];
        
        // Look for piece moves that could create pins (simplified heuristic)
        playerMoves.forEach((moveData, i) => {
            const move = moveData.move;
            if ((move.startsWith('B') || move.startsWith('R') || move.startsWith('Q')) && 
                i < playerMoves.length - 2) {
                
                // Check if subsequent moves suggest a pin was effective
                const nextMoves = playerMoves.slice(i + 1, i + 3).map(m => m.move);
                if (nextMoves.some(m => m.includes('x'))) {
                    patterns.push({
                        name: 'Pin Attack',
                        description: 'Pinning opponent piece to win material',
                        moves: [move, ...nextMoves.slice(0, 1)],
                        frequency: 0, // Will be calculated later
                        successRate: game.gameResult === 'win' ? 100 : 0,
                        difficulty: 'intermediate',
                        examples: [{
                            gameId: game.gameId,
                            position: `Move ${Math.floor(moveData.index / 2) + 1}`,
                            outcome: game.gameResult === 'win' ? 'success' : 'failed',
                            context: nextMoves
                        }]
                    });
                }
            }
        });
        
        return patterns;
    }

    private identifyForks(playerMoves: Array<{move: string, index: number}>, game: UnifiedGameData): TacticalPattern[] {
        const patterns: TacticalPattern[] = [];
        
        // Look for knight forks (most common)
        playerMoves.forEach((moveData, i) => {
            const move = moveData.move;
            if (move.startsWith('N') && move.includes('+')) {
                // Knight check that could be a fork
                patterns.push({
                    name: 'Knight Fork',
                    description: 'Knight attacking multiple pieces simultaneously',
                    moves: [move],
                    frequency: 0,
                    successRate: game.gameResult === 'win' ? 100 : 0,
                    difficulty: 'intermediate',
                    examples: [{
                        gameId: game.gameId,
                        position: `Move ${Math.floor(moveData.index / 2) + 1}`,
                        outcome: game.gameResult === 'win' ? 'success' : 'failed',
                        context: [move]
                    }]
                });
            }
        });
        
        return patterns;
    }

    private identifySkewers(playerMoves: Array<{move: string, index: number}>, game: UnifiedGameData): TacticalPattern[] {
        const patterns: TacticalPattern[] = [];
        
        // Look for long-range piece moves that give check and win material
        playerMoves.forEach((moveData, i) => {
            const move = moveData.move;
            if ((move.startsWith('B') || move.startsWith('R') || move.startsWith('Q')) && 
                move.includes('+') && i < playerMoves.length - 2) {
                
                const nextPlayerMove = playerMoves[i + 1]?.move;
                if (nextPlayerMove && nextPlayerMove.includes('x')) {
                    patterns.push({
                        name: 'Skewer',
                        description: 'Attacking valuable piece behind less valuable one',
                        moves: [move, nextPlayerMove],
                        frequency: 0,
                        successRate: game.gameResult === 'win' ? 100 : 0,
                        difficulty: 'intermediate',
                        examples: [{
                            gameId: game.gameId,
                            position: `Move ${Math.floor(moveData.index / 2) + 1}`,
                            outcome: game.gameResult === 'win' ? 'success' : 'failed',
                            context: [move, nextPlayerMove]
                        }]
                    });
                }
            }
        });
        
        return patterns;
    }

    private identifyDiscoveredAttacks(playerMoves: Array<{move: string, index: number}>, game: UnifiedGameData): TacticalPattern[] {
        const patterns: TacticalPattern[] = [];
        
        // Look for piece moves followed by captures from pieces behind
        playerMoves.forEach((moveData, i) => {
            if (i < playerMoves.length - 2) {
                const nextMove = playerMoves[i + 1]?.move;
                if (nextMove && nextMove.includes('x') && !moveData.move.includes('x')) {
                    patterns.push({
                        name: 'Discovered Attack',
                        description: 'Moving piece to reveal attack from piece behind',
                        moves: [moveData.move, nextMove],
                        frequency: 0,
                        successRate: game.gameResult === 'win' ? 100 : 0,
                        difficulty: 'advanced',
                        examples: [{
                            gameId: game.gameId,
                            position: `Move ${Math.floor(moveData.index / 2) + 1}`,
                            outcome: game.gameResult === 'win' ? 'success' : 'failed',
                            context: [moveData.move, nextMove]
                        }]
                    });
                }
            }
        });
        
        return patterns;
    }

    private identifySacrifices(playerMoves: Array<{move: string, index: number}>, game: UnifiedGameData): TacticalPattern[] {
        const patterns: TacticalPattern[] = [];
        
        // Look for captures followed by immediate recaptures (potential sacrifices)
        playerMoves.forEach((moveData, i) => {
            const move = moveData.move;
            if (move.includes('x') && i < game.moves.length - 2) {
                // Check if opponent recaptures
                const opponentResponse = game.moves[moveData.index + 1];
                if (opponentResponse && opponentResponse.includes('x')) {
                    // This could be a sacrifice if it leads to advantage
                    const sacrificeValue = this.estimateSacrificeValue(move);
                    if (sacrificeValue > 0) {
                        patterns.push({
                            name: 'Material Sacrifice',
                            description: 'Sacrificing material for positional or tactical advantage',
                            moves: [move, opponentResponse],
                            frequency: 0,
                            successRate: game.gameResult === 'win' ? 100 : 0,
                            difficulty: 'expert',
                            examples: [{
                                gameId: game.gameId,
                                position: `Move ${Math.floor(moveData.index / 2) + 1}`,
                                outcome: game.gameResult === 'win' ? 'success' : 'failed',
                                context: [move, opponentResponse]
                            }]
                        });
                    }
                }
            }
        });
        
        return patterns;
    }

    private estimateSacrificeValue(move: string): number {
        // Simplified sacrifice value estimation
        if (move.startsWith('Q')) return 9; // Queen sacrifice
        if (move.startsWith('R')) return 5; // Rook sacrifice
        if (move.startsWith('B') || move.startsWith('N')) return 3; // Minor piece sacrifice
        return 1; // Pawn sacrifice
    }

    analyzeTacticalProfile(): TacticalProfile {
        const allPatterns: TacticalPattern[] = [];
        
        // Analyze each game for tactical patterns
        this.games.forEach(game => {
            const gamePatterns = this.identifyTacticalMotifs(game);
            allPatterns.push(...gamePatterns);
        });

        // Group and analyze patterns
        const patternGroups = new Map<string, TacticalPattern[]>();
        allPatterns.forEach(pattern => {
            if (!patternGroups.has(pattern.name)) {
                patternGroups.set(pattern.name, []);
            }
            patternGroups.get(pattern.name)!.push(pattern);
        });

        // Calculate pattern statistics
        const analyzedPatterns = Array.from(patternGroups.entries()).map(([name, patterns]) => {
            const totalCount = patterns.length;
            const successCount = patterns.filter(p => p.examples[0]?.outcome === 'success').length;
            
            const combinedPattern: TacticalPattern = {
                name,
                description: patterns[0].description,
                moves: patterns[0].moves,
                frequency: (totalCount / this.games.length) * 100,
                successRate: totalCount > 0 ? (successCount / totalCount) * 100 : 0,
                difficulty: patterns[0].difficulty,
                examples: patterns.slice(0, 3).map(p => p.examples[0])
            };
            
            this.tacticalPatterns.set(name, combinedPattern);
            return combinedPattern;
        });

        // Calculate tactical statistics
        const statistics = this.calculateTacticalStatistics(analyzedPatterns);
        
        // Identify preferred, avoided, and missed patterns
        const preferred = analyzedPatterns.filter(p => p.frequency >= 10 && p.successRate >= 60);
        const avoided = analyzedPatterns.filter(p => p.frequency < 5);
        const missed = analyzedPatterns.filter(p => p.frequency >= 5 && p.successRate < 40);

        // Calculate tendencies
        const tendencies = this.calculateTacticalTendencies();

        // Identify strengths and weaknesses
        const strengths = this.identifyTacticalStrengths(preferred, statistics);
        const weaknesses = this.identifyTacticalWeaknesses(missed, statistics);

        // Generate recommendations
        const recommendations = this.generateTacticalRecommendations(preferred, avoided, missed);

        return {
            patterns: { preferred, avoided, missed },
            statistics,
            tendencies,
            strengths,
            weaknesses,
            recommendations
        };
    }

    private calculateTacticalStatistics(patterns: TacticalPattern[]): TacticalProfile['statistics'] {
        const captureGames = this.games.filter(g => 
            g.moves.filter(m => m.includes('x')).length >= 3
        ).length;
        
        const checkGames = this.games.filter(g => 
            g.moves.filter(m => m.includes('+')).length >= 2
        ).length;

        const aggressiveness = (captureGames / this.games.length) * 100;
        const riskTaking = (patterns.filter(p => p.name.includes('Sacrifice')).length / this.games.length) * 100;
        const tacticalAwareness = (patterns.reduce((sum, p) => sum + p.successRate, 0) / patterns.length) || 0;
        const calculationDepth = Math.min(100, patterns.filter(p => p.difficulty === 'advanced' || p.difficulty === 'expert').length * 10);
        const patternRecognition = (checkGames / this.games.length) * 100;

        return {
            aggressiveness: Math.round(aggressiveness),
            riskTaking: Math.round(riskTaking),
            tacticalAwareness: Math.round(tacticalAwareness),
            calculationDepth: Math.round(calculationDepth),
            patternRecognition: Math.round(patternRecognition)
        };
    }

    private calculateTacticalTendencies(): TacticalProfile['tendencies'] {
        const sacrificeCount = this.games.filter(g => 
            g.moves.some(m => m.includes('x') && this.estimateSacrificeValue(m) >= 3)
        ).length;

        const exchangeCount = this.games.filter(g => 
            g.moves.filter(m => m.includes('x')).length >= 4
        ).length;

        const attackingCount = this.games.filter(g => 
            g.moves.filter(m => m.includes('+') || m.includes('#')).length >= 3
        ).length;

        return {
            sacrificeWillingness: Math.round((sacrificeCount / this.games.length) * 100),
            exchangePreference: exchangeCount > this.games.length * 0.5 ? 'material' : 'positional',
            attackingStyle: attackingCount > this.games.length * 0.6 ? 'direct' : 'positional',
            defensiveApproach: 'solid' // Simplified - would need deeper analysis
        };
    }

    private identifyTacticalStrengths(preferred: TacticalPattern[], stats: TacticalProfile['statistics']): string[] {
        const strengths: string[] = [];
        
        if (stats.aggressiveness >= 70) strengths.push('Aggressive play');
        if (stats.tacticalAwareness >= 70) strengths.push('Tactical awareness');
        if (preferred.some(p => p.name === 'Knight Fork')) strengths.push('Knight tactics');
        if (preferred.some(p => p.name === 'Pin Attack')) strengths.push('Pin tactics');
        if (stats.calculationDepth >= 50) strengths.push('Calculation depth');
        
        return strengths.slice(0, 5);
    }

    private identifyTacticalWeaknesses(missed: TacticalPattern[], stats: TacticalProfile['statistics']): string[] {
        const weaknesses: string[] = [];
        
        if (stats.tacticalAwareness < 40) weaknesses.push('Tactical awareness');
        if (stats.calculationDepth < 30) weaknesses.push('Calculation depth');
        if (missed.some(p => p.name === 'Material Sacrifice')) weaknesses.push('Sacrifice timing');
        if (stats.patternRecognition < 30) weaknesses.push('Pattern recognition');
        if (stats.aggressiveness < 30) weaknesses.push('Tactical aggression');
        
        return weaknesses.slice(0, 5);
    }

    private generateTacticalRecommendations(
        preferred: TacticalPattern[], 
        avoided: TacticalPattern[], 
        missed: TacticalPattern[]
    ): TacticalProfile['recommendations'] {
        const recommendations: TacticalProfile['recommendations'] = [];
        
        // Study missed patterns
        missed.forEach(pattern => {
            recommendations.push({
                category: 'study',
                pattern: pattern.name,
                reason: `Low success rate (${pattern.successRate.toFixed(1)}%) - needs practice`,
                priority: Math.round(100 - pattern.successRate)
            });
        });

        // Practice preferred patterns more
        preferred.forEach(pattern => {
            if (pattern.frequency < 20) {
                recommendations.push({
                    category: 'practice',
                    pattern: pattern.name,
                    reason: `High success rate (${pattern.successRate.toFixed(1)}%) - use more often`,
                    priority: Math.round(pattern.successRate)
                });
            }
        });

        // Avoid problematic patterns
        avoided.forEach(pattern => {
            if (pattern.successRate < 30) {
                recommendations.push({
                    category: 'avoid',
                    pattern: pattern.name,
                    reason: `Very low success rate (${pattern.successRate.toFixed(1)}%)`,
                    priority: Math.round(100 - pattern.successRate)
                });
            }
        });

        return recommendations
            .sort((a, b) => b.priority - a.priority)
            .slice(0, 8);
    }

    printTacticalAnalysis(): void {
        const profile = this.analyzeTacticalProfile();

        console.log('\n⚔️ TACTICAL ANALYSIS');
        console.log('=====================');

        console.log('\n📊 TACTICAL STATISTICS:');
        console.log(`🗡️ Aggressiveness: ${profile.statistics.aggressiveness}%`);
        console.log(`🎲 Risk Taking: ${profile.statistics.riskTaking}%`);
        console.log(`🎯 Tactical Awareness: ${profile.statistics.tacticalAwareness}%`);
        console.log(`🧮 Calculation Depth: ${profile.statistics.calculationDepth}%`);
        console.log(`🔍 Pattern Recognition: ${profile.statistics.patternRecognition}%`);

        console.log('\n💪 PREFERRED PATTERNS:');
        profile.patterns.preferred.slice(0, 3).forEach(pattern => {
            console.log(`  ✅ ${pattern.name}: ${pattern.frequency.toFixed(1)}% freq, ${pattern.successRate.toFixed(1)}% success`);
        });

        console.log('\n⚠️ TACTICAL WEAKNESSES:');
        profile.weaknesses.forEach(weakness => {
            console.log(`  ❌ ${weakness}`);
        });

        console.log('\n🎯 TOP RECOMMENDATIONS:');
        profile.recommendations.slice(0, 3).forEach((rec, i) => {
            const icon = rec.category === 'study' ? '📚' : rec.category === 'practice' ? '🏋️' : '🚫';
            console.log(`  ${i + 1}. ${icon} ${rec.category.toUpperCase()}: ${rec.pattern}`);
            console.log(`      ${rec.reason}`);
        });

        console.log('\n🎮 PLAYING STYLE:');
        console.log(`⚔️ Attack Style: ${profile.tendencies.attackingStyle}`);
        console.log(`💰 Exchange Preference: ${profile.tendencies.exchangePreference}`);
        console.log(`🛡️ Defensive Approach: ${profile.tendencies.defensiveApproach}`);
        console.log(`🎲 Sacrifice Willingness: ${profile.tendencies.sacrificeWillingness}%`);
    }

    getTacticalProfile(): TacticalProfile {
        return this.analyzeTacticalProfile();
    }

    getTacticalPatterns(): Map<string, TacticalPattern> {
        if (this.tacticalPatterns.size === 0) {
            this.analyzeTacticalProfile();
        }
        return this.tacticalPatterns;
    }
}