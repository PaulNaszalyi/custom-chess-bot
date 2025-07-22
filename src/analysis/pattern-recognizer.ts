import { UnifiedGameData } from '../data/combined-extractor';
import { TacticalPattern, TacticalProfile } from './tactical-analyzer';

export interface AdvancedPattern {
    id: string;
    name: string;
    category: 'tactical' | 'positional' | 'strategic' | 'endgame';
    description: string;
    complexity: 'basic' | 'intermediate' | 'advanced' | 'expert';
    frequency: number;
    successRate: number;
    confidence: number; // 0-100, how confident we are in pattern identification
    gamePhase: 'opening' | 'middlegame' | 'endgame' | 'any';
    triggers: string[]; // Conditions that lead to this pattern
    consequences: string[]; // What typically follows this pattern
    examples: Array<{
        gameId: string;
        platform: 'chess.com' | 'lichess';
        moveSequence: string[];
        context: {
            position: string;
            evaluation: number;
            timeSpent: number;
            gamePhase: string;
        };
        outcome: 'excellent' | 'good' | 'neutral' | 'poor' | 'blunder';
    }>;
    relatedPatterns: string[]; // IDs of related patterns
}

export interface PlayerStyleProfile {
    playingStrength: number; // Estimated ELO
    consistency: number; // How consistent the player is
    improvementRate: number; // How much they're improving over time
    
    preferences: {
        openings: {
            asWhite: Array<{ name: string; frequency: number; winRate: number }>;
            asBlack: Array<{ name: string; frequency: number; winRate: number }>;
        };
        pieceActivity: {
            knightVsBishop: 'knight' | 'bishop' | 'balanced';
            rookActivity: 'early' | 'late' | 'balanced';
            queenDevelopment: 'early' | 'late' | 'situational';
        };
        pawnStructure: {
            preferredFormations: string[];
            pawnStormTendency: number; // 0-100
            pawnSacrificeTendency: number; // 0-100
        };
    };
    
    weaknesses: {
        timeManagement: number; // 0-100, lower means worse time management
        tacticalBlindness: string[]; // Types of tactics often missed
        endgameSkill: number; // 0-100
        blunderPatterns: string[]; // Common blunder types
    };
    
    evolution: {
        ratingProgression: Array<{ date: string; rating: number; platform: string }>;
        skillDevelopment: Array<{ skill: string; improvement: number; timeframe: string }>;
        recentTrends: string[];
    };
}

export class AdvancedPatternRecognizer {
    private games: UnifiedGameData[];
    private patterns: Map<string, AdvancedPattern> = new Map();
    private playerProfile: PlayerStyleProfile | null = null;

    constructor(games: UnifiedGameData[]) {
        this.games = games.sort((a, b) => a.startTime - b.startTime);
    }

    public analyzeAdvancedPatterns(): Map<string, AdvancedPattern> {
        this.patterns.clear();
        
        // Analyze different types of patterns
        this.analyzeTacticalPatterns();
        this.analyzePositionalPatterns();
        this.analyzeStrategicPatterns();
        this.analyzeEndgamePatterns();
        this.analyzeCrossGamePatterns();
        
        // Calculate pattern relationships and confidence levels
        this.calculatePatternRelationships();
        this.adjustConfidenceLevels();
        
        return this.patterns;
    }

    private analyzeTacticalPatterns(): void {
        // Enhanced tactical pattern recognition beyond the basic tactical analyzer
        this.games.forEach(game => {
            const playerMoves = this.getPlayerMoves(game);
            
            // Advanced tactical patterns
            this.identifyDeflectionPatterns(game, playerMoves);
            this.identifyDecoyPatterns(game, playerMoves);
            this.identifyXRayPatterns(game, playerMoves);
            this.identifyZwischenzugPatterns(game, playerMoves);
            this.identifyQuietMovePatterns(game, playerMoves);
            this.identifyPieceTrapping(game, playerMoves);
        });
    }

    private analyzePositionalPatterns(): void {
        this.games.forEach(game => {
            const playerMoves = this.getPlayerMoves(game);
            
            // Positional pattern recognition
            this.identifyPawnStructurePreferences(game, playerMoves);
            this.identifyPieceCoordinationPatterns(game, playerMoves);
            this.identifySpaceAdvantagePatterns(game, playerMoves);
            this.identifyWeakSquareExploitation(game, playerMoves);
            this.identifyKingSafetyPatterns(game, playerMoves);
        });
    }

    private analyzeStrategicPatterns(): void {
        this.games.forEach(game => {
            const playerMoves = this.getPlayerMoves(game);
            
            // Strategic pattern recognition
            this.identifyPlanFormulation(game, playerMoves);
            this.identifyInitiativeManagement(game, playerMoves);
            this.identifyPieceExchangeStrategy(game, playerMoves);
            this.identifyEndgameTransition(game, playerMoves);
        });
    }

    private analyzeEndgamePatterns(): void {
        const endgames = this.games.filter(g => g.moves.length > 40);
        
        endgames.forEach(game => {
            const playerMoves = this.getPlayerMoves(game);
            const endgameMoves = playerMoves.filter(m => m.moveNumber > 40);
            
            this.identifyEndgameTechnique(game, endgameMoves);
            this.identifyKingActivity(game, endgameMoves);
            this.identifyPawnEndgameSkill(game, endgameMoves);
        });
    }

    private analyzeCrossGamePatterns(): void {
        // Analyze patterns across multiple games
        this.identifyRecurrentMistakes();
        this.identifyLearningPatterns();
        this.identifyAdaptationPatterns();
        this.identifyConsistencyPatterns();
    }

    private identifyDeflectionPatterns(game: UnifiedGameData, playerMoves: Array<{move: string, moveNumber: number}>): void {
        // Look for moves that force opponent pieces away from key squares
        playerMoves.forEach((moveData, i) => {
            const move = moveData.move;
            if (move.includes('+') || move.includes('x')) {
                // Check if this forces opponent to move a defender
                const nextOpponentMove = this.getOpponentMove(game, moveData.moveNumber);
                if (nextOpponentMove && this.isForcedMove(nextOpponentMove)) {
                    const followupMove = playerMoves[i + 1];
                    if (followupMove && followupMove.move.includes('x')) {
                        this.addPattern({
                            id: `deflection_${game.gameId}_${moveData.moveNumber}`,
                            name: 'Deflection',
                            category: 'tactical',
                            description: 'Forcing opponent piece away from key square to win material',
                            complexity: 'advanced',
                            frequency: 0,
                            successRate: 0,
                            confidence: 75,
                            gamePhase: this.determineGamePhase(moveData.moveNumber),
                            triggers: [move],
                            consequences: [followupMove.move],
                            examples: [{
                                gameId: game.gameId,
                                platform: game.source as 'chess.com' | 'lichess',
                                moveSequence: [move, nextOpponentMove, followupMove.move],
                                context: {
                                    position: `Move ${moveData.moveNumber}`,
                                    evaluation: 0,
                                    timeSpent: 0,
                                    gamePhase: this.determineGamePhase(moveData.moveNumber)
                                },
                                outcome: game.gameResult === 'win' ? 'excellent' : 'good'
                            }],
                            relatedPatterns: []
                        });
                    }
                }
            }
        });
    }

    private identifyDecoyPatterns(game: UnifiedGameData, playerMoves: Array<{move: string, moveNumber: number}>): void {
        // Look for sacrifices that lure opponent pieces to bad squares
        playerMoves.forEach((moveData, i) => {
            const move = moveData.move;
            if (move.includes('x') && this.isLikelySacrifice(move)) {
                const opponentResponse = this.getOpponentMove(game, moveData.moveNumber);
                if (opponentResponse && opponentResponse.includes('x')) {
                    // Check if this leads to tactical gain
                    const followupMoves = playerMoves.slice(i + 1, i + 3);
                    if (followupMoves.some(m => m.move.includes('x') || m.move.includes('+'))) {
                        this.addPattern({
                            id: `decoy_${game.gameId}_${moveData.moveNumber}`,
                            name: 'Decoy Sacrifice',
                            category: 'tactical',
                            description: 'Sacrificing material to lure opponent piece to vulnerable square',
                            complexity: 'expert',
                            frequency: 0,
                            successRate: 0,
                            confidence: 60,
                            gamePhase: this.determineGamePhase(moveData.moveNumber),
                            triggers: [move],
                            consequences: followupMoves.map(m => m.move),
                            examples: [{
                                gameId: game.gameId,
                                platform: game.source as 'chess.com' | 'lichess',
                                moveSequence: [move, opponentResponse, ...followupMoves.map(m => m.move)],
                                context: {
                                    position: `Move ${moveData.moveNumber}`,
                                    evaluation: 0,
                                    timeSpent: 0,
                                    gamePhase: this.determineGamePhase(moveData.moveNumber)
                                },
                                outcome: game.gameResult === 'win' ? 'excellent' : 'neutral'
                            }],
                            relatedPatterns: []
                        });
                    }
                }
            }
        });
    }

    private identifyPawnStructurePreferences(game: UnifiedGameData, playerMoves: Array<{move: string, moveNumber: number}>): void {
        const pawnMoves = playerMoves.filter(m => /^[a-h][2-7]/.test(m.move) || /^[a-h]x/.test(m.move));
        
        if (pawnMoves.length >= 5) {
            // Analyze pawn structure tendencies
            const structures = this.identifyPawnStructures(pawnMoves);
            structures.forEach(structure => {
                this.addPattern({
                    id: `pawn_structure_${structure}_${game.gameId}`,
                    name: `${structure} Pawn Structure`,
                    category: 'positional',
                    description: `Preference for ${structure} pawn formation`,
                    complexity: 'intermediate',
                    frequency: 0,
                    successRate: 0,
                    confidence: 70,
                    gamePhase: 'any',
                    triggers: pawnMoves.slice(0, 3).map(m => m.move),
                    consequences: [],
                    examples: [{
                        gameId: game.gameId,
                        platform: game.source as 'chess.com' | 'lichess',
                        moveSequence: pawnMoves.map(m => m.move),
                        context: {
                            position: 'Throughout game',
                            evaluation: 0,
                            timeSpent: 0,
                            gamePhase: 'middlegame'
                        },
                        outcome: game.gameResult === 'win' ? 'good' : 'neutral'
                    }],
                    relatedPatterns: []
                });
            });
        }
    }

    private identifyRecurrentMistakes(): void {
        const mistakePatterns = new Map<string, number>();
        
        this.games.forEach(game => {
            if (game.gameResult === 'loss') {
                // Look for common patterns in losses
                const playerMoves = this.getPlayerMoves(game);
                const potentialMistakes = this.identifyPotentialMistakes(game, playerMoves);
                
                potentialMistakes.forEach(mistake => {
                    mistakePatterns.set(mistake, (mistakePatterns.get(mistake) || 0) + 1);
                });
            }
        });

        // Create patterns for frequent mistakes
        mistakePatterns.forEach((count, mistake) => {
            if (count >= 3) {
                this.addPattern({
                    id: `recurrent_mistake_${mistake}`,
                    name: `Recurrent ${mistake}`,
                    category: 'tactical',
                    description: `Tendency to repeat ${mistake} mistakes`,
                    complexity: 'basic',
                    frequency: (count / this.games.length) * 100,
                    successRate: 0,
                    confidence: 90,
                    gamePhase: 'any',
                    triggers: [mistake],
                    consequences: ['Material loss', 'Positional disadvantage'],
                    examples: [],
                    relatedPatterns: []
                });
            }
        });
    }

    public buildPlayerStyleProfile(): PlayerStyleProfile {
        if (this.playerProfile) {
            return this.playerProfile;
        }

        const patterns = this.analyzeAdvancedPatterns();
        
        this.playerProfile = {
            playingStrength: this.estimatePlayingStrength(),
            consistency: this.calculateConsistency(),
            improvementRate: this.calculateImprovementRate(),
            
            preferences: {
                openings: this.analyzeOpeningPreferences(),
                pieceActivity: this.analyzePieceActivityPreferences(),
                pawnStructure: this.analyzePawnStructurePreferences()
            },
            
            weaknesses: {
                timeManagement: this.analyzeTimeManagement(),
                tacticalBlindness: this.identifyTacticalBlindspots(),
                endgameSkill: this.assessEndgameSkill(),
                blunderPatterns: this.identifyBlunderPatterns()
            },
            
            evolution: {
                ratingProgression: this.trackRatingProgression(),
                skillDevelopment: this.trackSkillDevelopment(),
                recentTrends: this.identifyRecentTrends()
            }
        };

        return this.playerProfile;
    }

    // Helper methods
    private getPlayerMoves(game: UnifiedGameData): Array<{move: string, moveNumber: number}> {
        const playerMoves: Array<{move: string, moveNumber: number}> = [];
        
        for (let i = 0; i < game.moves.length; i++) {
            const isWhiteMove = i % 2 === 0;
            const isPlayerMove = (game.playerColor === 'white' && isWhiteMove) || 
                                 (game.playerColor === 'black' && !isWhiteMove);
            
            if (isPlayerMove) {
                playerMoves.push({
                    move: game.moves[i],
                    moveNumber: Math.floor(i / 2) + 1
                });
            }
        }
        
        return playerMoves;
    }

    private getOpponentMove(game: UnifiedGameData, playerMoveNumber: number): string | null {
        const playerMoveIndex = (playerMoveNumber - 1) * 2 + (game.playerColor === 'white' ? 0 : 1);
        const opponentMoveIndex = playerMoveIndex + 1;
        
        return opponentMoveIndex < game.moves.length ? game.moves[opponentMoveIndex] : null;
    }

    private determineGamePhase(moveNumber: number): 'opening' | 'middlegame' | 'endgame' {
        if (moveNumber <= 12) return 'opening';
        if (moveNumber <= 40) return 'middlegame';
        return 'endgame';
    }

    private isForcedMove(move: string): boolean {
        // Simplified check for forced moves
        return move.includes('x') || move.includes('+') || move.includes('O-O');
    }

    private isLikelySacrifice(move: string): boolean {
        // Check if move is likely a sacrifice based on piece value and context
        return move.startsWith('Q') || move.startsWith('R') || 
               (move.startsWith('B') && move.includes('x')) ||
               (move.startsWith('N') && move.includes('x'));
    }

    private identifyPawnStructures(pawnMoves: Array<{move: string, moveNumber: number}>): string[] {
        // Simplified pawn structure identification
        const structures: string[] = [];
        const moveStrings = pawnMoves.map(m => m.move);
        
        if (moveStrings.some(m => m.includes('d4')) && moveStrings.some(m => m.includes('e4'))) {
            structures.push('Center Control');
        }
        if (moveStrings.some(m => m.includes('f4')) || moveStrings.some(m => m.includes('h4'))) {
            structures.push('Kingside Attack');
        }
        if (moveStrings.some(m => m.includes('a4')) || moveStrings.some(m => m.includes('b4'))) {
            structures.push('Queenside Expansion');
        }
        
        return structures;
    }

    private identifyPotentialMistakes(game: UnifiedGameData, playerMoves: Array<{move: string, moveNumber: number}>): string[] {
        const mistakes: string[] = [];
        
        // Look for hanging pieces (simplified)
        playerMoves.forEach(moveData => {
            if (this.leavesHangingPiece(moveData.move)) {
                mistakes.push('Hanging Piece');
            }
            if (this.weakensKingPosition(moveData.move, moveData.moveNumber)) {
                mistakes.push('King Safety');
            }
        });
        
        return mistakes;
    }

    private leavesHangingPiece(move: string): boolean {
        // Simplified check for moves that might leave pieces hanging
        return !move.includes('x') && !move.includes('+') && 
               (move.startsWith('Q') || move.startsWith('R')) &&
               !move.includes('O-O');
    }

    private weakensKingPosition(move: string, moveNumber: number): boolean {
        // Check for early king moves or pawn moves in front of king
        return (moveNumber <= 15 && move.startsWith('K')) ||
               (moveNumber <= 20 && (move.includes('f2') || move.includes('g2') || move.includes('h2')));
    }

    private addPattern(pattern: AdvancedPattern): void {
        const existingPattern = this.patterns.get(pattern.name);
        if (existingPattern) {
            existingPattern.frequency += 1;
            existingPattern.examples.push(...pattern.examples);
        } else {
            this.patterns.set(pattern.id, pattern);
        }
    }

    private calculatePatternRelationships(): void {
        // Calculate relationships between patterns
        this.patterns.forEach(pattern => {
            this.patterns.forEach(otherPattern => {
                if (pattern.id !== otherPattern.id && this.areRelated(pattern, otherPattern)) {
                    pattern.relatedPatterns.push(otherPattern.id);
                }
            });
        });
    }

    private areRelated(pattern1: AdvancedPattern, pattern2: AdvancedPattern): boolean {
        // Check if patterns are related based on category, triggers, or consequences
        return pattern1.category === pattern2.category ||
               pattern1.triggers.some(t => pattern2.triggers.includes(t)) ||
               pattern1.consequences.some(c => pattern2.consequences.includes(c));
    }

    private adjustConfidenceLevels(): void {
        this.patterns.forEach(pattern => {
            // Adjust confidence based on frequency and success rate
            const frequencyBonus = Math.min(20, pattern.frequency * 2);
            const successBonus = pattern.successRate > 70 ? 10 : 0;
            pattern.confidence = Math.min(100, pattern.confidence + frequencyBonus + successBonus);
        });
    }

    // Placeholder implementations for profile building methods
    private estimatePlayingStrength(): number {
        const totalGames = this.games.length;
        const wins = this.games.filter(g => g.gameResult === 'win').length;
        const winRate = wins / totalGames;
        const avgRating = this.games.reduce((sum, g) => sum + (g.playerRating || 1200), 0) / totalGames;
        
        return Math.round(avgRating + (winRate - 0.5) * 200);
    }

    private calculateConsistency(): number {
        // Calculate based on rating stability and performance consistency
        const ratings = this.games.map(g => g.playerRating || 1200);
        const variance = this.calculateVariance(ratings);
        return Math.max(0, 100 - Math.sqrt(variance) / 10);
    }

    private calculateImprovementRate(): number {
        if (this.games.length < 10) return 0;
        
        const recentGames = this.games.slice(-10);
        const oldGames = this.games.slice(0, 10);
        
        const recentAvgRating = recentGames.reduce((sum, g) => sum + (g.playerRating || 1200), 0) / recentGames.length;
        const oldAvgRating = oldGames.reduce((sum, g) => sum + (g.playerRating || 1200), 0) / oldGames.length;
        
        return recentAvgRating - oldAvgRating;
    }

    private calculateVariance(values: number[]): number {
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    }

    // Additional placeholder methods would be implemented here...
    private analyzeOpeningPreferences(): PlayerStyleProfile['preferences']['openings'] {
        return {
            asWhite: [{ name: 'Queen\'s Gambit', frequency: 30, winRate: 60 }],
            asBlack: [{ name: 'French Defense', frequency: 40, winRate: 55 }]
        };
    }

    private analyzePieceActivityPreferences(): PlayerStyleProfile['preferences']['pieceActivity'] {
        return {
            knightVsBishop: 'balanced',
            rookActivity: 'late',
            queenDevelopment: 'situational'
        };
    }

    private analyzePawnStructurePreferences(): PlayerStyleProfile['preferences']['pawnStructure'] {
        return {
            preferredFormations: ['Center Control'],
            pawnStormTendency: 40,
            pawnSacrificeTendency: 20
        };
    }

    private analyzeTimeManagement(): number { return 75; }
    private identifyTacticalBlindspots(): string[] { return ['Pin Tactics']; }
    private assessEndgameSkill(): number { return 60; }
    private identifyBlunderPatterns(): string[] { return ['Hanging Piece']; }
    private trackRatingProgression(): Array<{ date: string; rating: number; platform: string }> { return []; }
    private trackSkillDevelopment(): Array<{ skill: string; improvement: number; timeframe: string }> { return []; }
    private identifyRecentTrends(): string[] { return ['Improving tactical awareness']; }

    // Stub implementations for missing methods
    private identifyXRayPatterns(game: UnifiedGameData, playerMoves: Array<{move: string, moveNumber: number}>): void {}
    private identifyZwischenzugPatterns(game: UnifiedGameData, playerMoves: Array<{move: string, moveNumber: number}>): void {}
    private identifyQuietMovePatterns(game: UnifiedGameData, playerMoves: Array<{move: string, moveNumber: number}>): void {}
    private identifyPieceTrapping(game: UnifiedGameData, playerMoves: Array<{move: string, moveNumber: number}>): void {}
    private identifyPieceCoordinationPatterns(game: UnifiedGameData, playerMoves: Array<{move: string, moveNumber: number}>): void {}
    private identifySpaceAdvantagePatterns(game: UnifiedGameData, playerMoves: Array<{move: string, moveNumber: number}>): void {}
    private identifyWeakSquareExploitation(game: UnifiedGameData, playerMoves: Array<{move: string, moveNumber: number}>): void {}
    private identifyKingSafetyPatterns(game: UnifiedGameData, playerMoves: Array<{move: string, moveNumber: number}>): void {}
    private identifyPlanFormulation(game: UnifiedGameData, playerMoves: Array<{move: string, moveNumber: number}>): void {}
    private identifyInitiativeManagement(game: UnifiedGameData, playerMoves: Array<{move: string, moveNumber: number}>): void {}
    private identifyPieceExchangeStrategy(game: UnifiedGameData, playerMoves: Array<{move: string, moveNumber: number}>): void {}
    private identifyEndgameTransition(game: UnifiedGameData, playerMoves: Array<{move: string, moveNumber: number}>): void {}
    private identifyEndgameTechnique(game: UnifiedGameData, endgameMoves: Array<{move: string, moveNumber: number}>): void {}
    private identifyKingActivity(game: UnifiedGameData, endgameMoves: Array<{move: string, moveNumber: number}>): void {}
    private identifyPawnEndgameSkill(game: UnifiedGameData, endgameMoves: Array<{move: string, moveNumber: number}>): void {}
    private identifyLearningPatterns(): void {}
    private identifyAdaptationPatterns(): void {}
    private identifyConsistencyPatterns(): void {}

    public getPatterns(): Map<string, AdvancedPattern> {
        return this.patterns;
    }

    public getPlayerProfile(): PlayerStyleProfile | null {
        return this.playerProfile;
    }
}