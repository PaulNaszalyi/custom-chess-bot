import { UnifiedGameData } from '../data/combined-extractor';
import { AdvancedPattern, PlayerStyleProfile } from './pattern-recognizer';
import { CrossPlatformInsights } from './cross-platform-analyzer';

export interface MoveWeight {
    move: string;
    weight: number; // 0-100, how likely this move is for this player
    reasoning: string[];
    confidence: number; // 0-100, confidence in this weighting
    context: {
        gamePhase: 'opening' | 'middlegame' | 'endgame';
        position: string;
        threats: string[];
        opportunities: string[];
    };
}

export interface StyleMimicryProfile {
    playerIdentity: {
        name: string;
        estimatedStrength: number;
        playingStyle: 'aggressive' | 'positional' | 'tactical' | 'defensive' | 'balanced';
        confidence: number;
    };
    
    decisionFactors: {
        tacticalWeight: number; // 0-100, how much tactics influence decisions
        positionalWeight: number; // 0-100, how much position influences decisions
        materialWeight: number; // 0-100, how much material balance matters
        timeWeight: number; // 0-100, how much time pressure affects decisions
        riskTolerance: number; // 0-100, willingness to take risks
    };
    
    movePreferences: {
        opening: Map<string, number>; // Opening moves and their preference weights
        middlegame: Map<string, number>; // Middlegame patterns and preferences
        endgame: Map<string, number>; // Endgame technique preferences
    };
    
    avoidancePatterns: {
        blunderTypes: Array<{ pattern: string; avoidanceStrength: number }>;
        weakMoves: Array<{ context: string; moves: string[]; reason: string }>;
        timetraps: Array<{ situation: string; tendency: string }>;
    };
    
    adaptationRules: {
        opponentStrength: Array<{ strengthRange: [number, number]; adjustments: string[] }>;
        timeControls: Array<{ timeControl: string; styleAdjustments: string[] }>;
        platforms: Array<{ platform: 'chess.com' | 'lichess'; adjustments: string[] }>;
    };
    
    emergencyProtocols: {
        lowTime: { threshold: number; actions: string[] };
        losingPosition: { threshold: number; actions: string[] };
        winningPosition: { threshold: number; actions: string[] };
        drawishPosition: { actions: string[] };
    };
}

export interface MoveEvaluation {
    move: string;
    mimicryScore: number; // 0-100, how much this move matches the player's style
    tacticalScore: number; // 0-100, tactical strength of the move
    positionalScore: number; // 0-100, positional merit of the move
    riskScore: number; // 0-100, risk level of the move
    timeScore: number; // 0-100, appropriateness given time constraints
    overallScore: number; // 0-100, weighted combination of all factors
    explanation: string[];
}

export class StyleMimicryEngine {
    private games: UnifiedGameData[];
    private patterns: Map<string, AdvancedPattern>;
    private styleProfile: PlayerStyleProfile;
    private crossPlatformInsights: CrossPlatformInsights;
    private mimicryProfile: StyleMimicryProfile | null = null;

    constructor(
        games: UnifiedGameData[], 
        patterns: Map<string, AdvancedPattern>,
        styleProfile: PlayerStyleProfile,
        crossPlatformInsights: CrossPlatformInsights
    ) {
        this.games = games;
        this.patterns = patterns;
        this.styleProfile = styleProfile;
        this.crossPlatformInsights = crossPlatformInsights;
    }

    public buildMimicryProfile(): StyleMimicryProfile {
        if (this.mimicryProfile) {
            return this.mimicryProfile;
        }

        this.mimicryProfile = {
            playerIdentity: this.analyzePlayerIdentity(),
            decisionFactors: this.analyzeDecisionFactors(),
            movePreferences: this.analyzeMovePreferences(),
            avoidancePatterns: this.analyzeAvoidancePatterns(),
            adaptationRules: this.buildAdaptationRules(),
            emergencyProtocols: this.buildEmergencyProtocols()
        };

        return this.mimicryProfile;
    }

    private analyzePlayerIdentity(): StyleMimicryProfile['playerIdentity'] {
        const wins = this.games.filter(g => g.gameResult === 'win').length;
        const winRate = wins / this.games.length;
        
        // Determine playing style based on tactical profile and patterns
        let playingStyle: 'aggressive' | 'positional' | 'tactical' | 'defensive' | 'balanced';
        const tacticalPatterns = Array.from(this.patterns.values()).filter(p => p.category === 'tactical').length;
        const positionalPatterns = Array.from(this.patterns.values()).filter(p => p.category === 'positional').length;
        
        if (tacticalPatterns > positionalPatterns * 1.5) {
            playingStyle = 'tactical';
        } else if (positionalPatterns > tacticalPatterns * 1.5) {
            playingStyle = 'positional';
        } else if (this.styleProfile.preferences.pawnStructure.pawnStormTendency > 70) {
            playingStyle = 'aggressive';
        } else if (this.styleProfile.weaknesses.timeManagement < 40) {
            playingStyle = 'defensive';
        } else {
            playingStyle = 'balanced';
        }

        return {
            name: 'Mimicked Player',
            estimatedStrength: this.styleProfile.playingStrength,
            playingStyle,
            confidence: Math.min(95, Math.max(60, this.games.length * 2))
        };
    }

    private analyzeDecisionFactors(): StyleMimicryProfile['decisionFactors'] {
        const tacticalGames = this.games.filter(g => 
            g.moves.filter(m => m.includes('x') || m.includes('+')).length >= 5
        ).length;
        const tacticalWeight = (tacticalGames / this.games.length) * 100;

        const longGames = this.games.filter(g => g.moves.length > 50).length;
        const positionalWeight = (longGames / this.games.length) * 80 + 20; // Base 20%

        const exchangeGames = this.games.filter(g => 
            g.moves.filter(m => m.includes('x')).length >= 6
        ).length;
        const materialWeight = (exchangeGames / this.games.length) * 70 + 30; // Base 30%

        return {
            tacticalWeight: Math.round(Math.min(100, tacticalWeight)),
            positionalWeight: Math.round(Math.min(100, positionalWeight)),
            materialWeight: Math.round(Math.min(100, materialWeight)),
            timeWeight: this.styleProfile.weaknesses.timeManagement,
            riskTolerance: this.styleProfile.preferences.pawnStructure.pawnSacrificeTendency
        };
    }

    private analyzeMovePreferences(): StyleMimicryProfile['movePreferences'] {
        const opening = new Map<string, number>();
        const middlegame = new Map<string, number>();
        const endgame = new Map<string, number>();

        this.games.forEach(game => {
            const playerMoves = this.getPlayerMoves(game);
            
            playerMoves.forEach((moveData, index) => {
                const phase = this.determineGamePhase(moveData.moveNumber);
                const movePattern = this.abstractMove(moveData.move);
                
                if (phase === 'opening') {
                    opening.set(movePattern, (opening.get(movePattern) || 0) + 1);
                } else if (phase === 'middlegame') {
                    middlegame.set(movePattern, (middlegame.get(movePattern) || 0) + 1);
                } else {
                    endgame.set(movePattern, (endgame.get(movePattern) || 0) + 1);
                }
            });
        });

        // Convert counts to preference weights (0-100)
        this.normalizePreferences(opening, this.games.length);
        this.normalizePreferences(middlegame, this.games.length);
        this.normalizePreferences(endgame, this.games.length);

        return { opening, middlegame, endgame };
    }

    private analyzeAvoidancePatterns(): StyleMimicryProfile['avoidancePatterns'] {
        const blunderTypes: Array<{ pattern: string; avoidanceStrength: number }> = [];
        const weakMoves: Array<{ context: string; moves: string[]; reason: string }> = [];
        const timetraps: Array<{ situation: string; tendency: string }> = [];

        // Analyze losses for common blunder patterns
        const losses = this.games.filter(g => g.gameResult === 'loss');
        const blunderPatterns = new Map<string, number>();

        losses.forEach(game => {
            const playerMoves = this.getPlayerMoves(game);
            const potentialBlunders = this.identifyPotentialBlunders(game, playerMoves);
            
            potentialBlunders.forEach(blunder => {
                blunderPatterns.set(blunder, (blunderPatterns.get(blunder) || 0) + 1);
            });
        });

        // Convert to avoidance patterns
        blunderPatterns.forEach((count, pattern) => {
            if (count >= 2) {
                blunderTypes.push({
                    pattern,
                    avoidanceStrength: Math.min(100, (count / losses.length) * 100 + 50)
                });
            }
        });

        // Identify weak moves in specific contexts
        if (losses.length > 3) {
            const earlyLosses = losses.filter(g => g.moves.length < 30);
            if (earlyLosses.length > losses.length * 0.3) {
                weakMoves.push({
                    context: 'Opening phase',
                    moves: ['Early queen moves', 'Weakening pawn moves'],
                    reason: 'Frequent early game losses'
                });
            }
        }

        // Time trouble patterns
        if (this.styleProfile.weaknesses.timeManagement < 50) {
            timetraps.push({
                situation: 'Complex positions with low time',
                tendency: 'Makes hasty decisions leading to blunders'
            });
        }

        return { blunderTypes, weakMoves, timetraps };
    }

    private buildAdaptationRules(): StyleMimicryProfile['adaptationRules'] {
        const opponentStrength: Array<{ strengthRange: [number, number]; adjustments: string[] }> = [
            {
                strengthRange: [0, 1000],
                adjustments: ['Play more directly', 'Avoid complex sacrifices', 'Focus on basic tactics']
            },
            {
                strengthRange: [1000, 1500],
                adjustments: ['Mix tactical and positional play', 'Watch for intermediate moves']
            },
            {
                strengthRange: [1500, 2000],
                adjustments: ['Increase calculation depth', 'Be more careful in endgames']
            }
        ];

        const timeControls: Array<{ timeControl: string; styleAdjustments: string[] }> = [
            {
                timeControl: '600+0',
                styleAdjustments: ['Play more intuitively', 'Avoid deep calculation', 'Trust pattern recognition']
            },
            {
                timeControl: '900+10',
                styleAdjustments: ['Balance calculation with intuition', 'Use time for critical positions']
            }
        ];

        const platforms: Array<{ platform: 'chess.com' | 'lichess'; adjustments: string[] }> = [];
        
        // Add platform-specific adjustments based on cross-platform insights
        this.crossPlatformInsights.platformComparisons.forEach(platform => {
            if (platform.gameCount > 0) {
                const adjustments: string[] = [];
                
                if (platform.platform === 'chess.com') {
                    adjustments.push('Account for Chess.com interface timing');
                    if (platform.uniquePatterns.includes('Extended Game Stamina')) {
                        adjustments.push('Prepare for longer games');
                    }
                } else {
                    adjustments.push('Adapt to Lichess interface responsiveness');
                    if (platform.uniquePatterns.includes('Quick Victory Tactics')) {
                        adjustments.push('Look for quick tactical wins');
                    }
                }
                
                platforms.push({ platform: platform.platform, adjustments });
            }
        });

        return { opponentStrength, timeControls, platforms };
    }

    private buildEmergencyProtocols(): StyleMimicryProfile['emergencyProtocols'] {
        return {
            lowTime: {
                threshold: 60, // 60 seconds
                actions: [
                    'Switch to intuitive play',
                    'Avoid complex calculations', 
                    'Trust pattern recognition',
                    'Play forcing moves when possible'
                ]
            },
            losingPosition: {
                threshold: -200, // 2 point disadvantage (centipawns)
                actions: [
                    'Increase tactical alertness',
                    'Look for counterplay opportunities',
                    'Consider sacrificial options',
                    'Complicate the position if needed'
                ]
            },
            winningPosition: {
                threshold: 200, // 2 point advantage
                actions: [
                    'Avoid unnecessary risks',
                    'Simplify when advantageous',
                    'Focus on technique over tactics',
                    'Trade pieces to reach favorable endgame'
                ]
            },
            drawishPosition: {
                actions: [
                    'Look for small improvements',
                    'Maintain piece activity',
                    'Avoid pawn weaknesses',
                    'Keep options flexible'
                ]
            }
        };
    }

    public evaluateMove(
        move: string, 
        gamePhase: 'opening' | 'middlegame' | 'endgame',
        context: {
            position: string;
            timeRemaining: number;
            opponentStrength: number;
            evaluation: number;
            threats: string[];
            opportunities: string[];
        }
    ): MoveEvaluation {
        const profile = this.buildMimicryProfile();
        const movePattern = this.abstractMove(move);
        
        // Calculate mimicry score based on historical preferences
        const mimicryScore = this.calculateMimicryScore(movePattern, gamePhase, profile);
        
        // Calculate component scores
        const tacticalScore = this.calculateTacticalScore(move, context);
        const positionalScore = this.calculatePositionalScore(move, gamePhase);
        const riskScore = this.calculateRiskScore(move, context);
        const timeScore = this.calculateTimeScore(move, context.timeRemaining);
        
        // Calculate weighted overall score
        const weights = profile.decisionFactors;
        const overallScore = (
            (mimicryScore * 0.3) +
            (tacticalScore * weights.tacticalWeight / 100 * 0.25) +
            (positionalScore * weights.positionalWeight / 100 * 0.2) +
            ((100 - riskScore) * (100 - profile.decisionFactors.riskTolerance) / 100 * 0.15) +
            (timeScore * weights.timeWeight / 100 * 0.1)
        );

        const explanation = this.generateMoveExplanation(
            move, mimicryScore, tacticalScore, positionalScore, riskScore, timeScore, profile
        );

        return {
            move,
            mimicryScore: Math.round(mimicryScore),
            tacticalScore: Math.round(tacticalScore),
            positionalScore: Math.round(positionalScore),
            riskScore: Math.round(riskScore),
            timeScore: Math.round(timeScore),
            overallScore: Math.round(overallScore),
            explanation
        };
    }

    private calculateMimicryScore(movePattern: string, gamePhase: 'opening' | 'middlegame' | 'endgame', profile: StyleMimicryProfile): number {
        const preferences = profile.movePreferences[gamePhase];
        return preferences.get(movePattern) || 50; // Default to neutral if pattern not found
    }

    private calculateTacticalScore(move: string, context: any): number {
        let score = 50; // Base score
        
        if (move.includes('x')) score += 20; // Captures often good tactically
        if (move.includes('+')) score += 25; // Checks create threats
        if (move.includes('#')) score += 40; // Checkmate is ultimate tactical goal
        if (context.threats.length > 0 && this.addressesThreat(move, context.threats)) {
            score += 15;
        }
        
        return Math.min(100, score);
    }

    private calculatePositionalScore(move: string, gamePhase: 'opening' | 'middlegame' | 'endgame'): number {
        let score = 50;
        
        // Phase-specific positional considerations
        if (gamePhase === 'opening') {
            if (this.isDevelopmentMove(move)) score += 20;
            if (this.controlsCenter(move)) score += 15;
        } else if (gamePhase === 'middlegame') {
            if (this.improvesCoordination(move)) score += 15;
            if (this.attacksWeakness(move)) score += 20;
        } else { // endgame
            if (this.activatesKing(move)) score += 25;
            if (this.advancesPawn(move)) score += 15;
        }
        
        return Math.min(100, score);
    }

    private calculateRiskScore(move: string, context: any): number {
        let risk = 0;
        
        if (this.exposesKing(move)) risk += 30;
        if (this.sacrificesMaterial(move)) risk += 40;
        if (this.weakensPawnStructure(move)) risk += 20;
        if (context.timeRemaining < 120 && this.isComplexMove(move)) risk += 25;
        
        return Math.min(100, risk);
    }

    private calculateTimeScore(move: string, timeRemaining: number): number {
        if (timeRemaining > 300) return 100; // Plenty of time
        
        let score = 100;
        if (timeRemaining < 60 && this.isComplexMove(move)) score -= 40;
        if (timeRemaining < 30 && !this.isForcingMove(move)) score -= 30;
        
        return Math.max(0, score);
    }

    private generateMoveExplanation(
        move: string, mimicryScore: number, tacticalScore: number, 
        positionalScore: number, riskScore: number, timeScore: number, 
        profile: StyleMimicryProfile
    ): string[] {
        const explanation: string[] = [];
        
        if (mimicryScore >= 70) {
            explanation.push(`This move fits well with the player's historical preferences (${mimicryScore}%)`);
        } else if (mimicryScore <= 30) {
            explanation.push(`This move is unusual for this player's style (${mimicryScore}%)`);
        }

        if (tacticalScore >= 70) {
            explanation.push(`Strong tactical merit (${tacticalScore}%)`);
        }
        
        if (positionalScore >= 70) {
            explanation.push(`Good positional value (${positionalScore}%)`);
        }
        
        if (riskScore >= 70) {
            explanation.push(`High-risk move (${riskScore}% risk)`);
        }
        
        if (timeScore <= 50) {
            explanation.push(`May be too complex for remaining time (${timeScore}% time appropriateness)`);
        }

        return explanation;
    }

    // Helper methods for move evaluation
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

    private determineGamePhase(moveNumber: number): 'opening' | 'middlegame' | 'endgame' {
        if (moveNumber <= 12) return 'opening';
        if (moveNumber <= 40) return 'middlegame';
        return 'endgame';
    }

    private abstractMove(move: string): string {
        // Abstract moves to patterns for better matching
        if (move === 'O-O') return 'short-castle';
        if (move === 'O-O-O') return 'long-castle';
        if (move.includes('x')) return 'capture-' + move.charAt(0);
        if (move.includes('+')) return 'check-' + move.charAt(0);
        if (/^[NBRQK]/.test(move)) return 'piece-move-' + move.charAt(0);
        return 'pawn-move';
    }

    private normalizePreferences(preferences: Map<string, number>, totalGames: number): void {
        preferences.forEach((count, move) => {
            preferences.set(move, Math.min(100, (count / totalGames) * 100 * 5)); // Scale to 0-100
        });
    }

    private identifyPotentialBlunders(game: UnifiedGameData, playerMoves: Array<{move: string, moveNumber: number}>): string[] {
        const blunders: string[] = [];
        
        // Simple blunder identification
        playerMoves.forEach((moveData, i) => {
            if (this.isLikelyBlunder(moveData.move, moveData.moveNumber, game)) {
                if (moveData.moveNumber <= 15) {
                    blunders.push('Opening blunder');
                } else if (moveData.moveNumber <= 40) {
                    blunders.push('Middlegame blunder');
                } else {
                    blunders.push('Endgame blunder');
                }
            }
        });
        
        return blunders;
    }

    private isLikelyBlunder(move: string, moveNumber: number, game: UnifiedGameData): boolean {
        // Simplified blunder detection
        return game.gameResult === 'loss' && 
               (moveNumber <= 10 && move.startsWith('Q')) || // Early queen
               (move.includes('?') || move.includes('??')); // If PGN has annotations
    }

    // Additional helper methods for move characteristics
    private addressesThreat(move: string, threats: string[]): boolean {
        return threats.some(threat => move.includes(threat.charAt(0)));
    }

    private isDevelopmentMove(move: string): boolean {
        return /^[NBRQK]/.test(move) && !move.includes('x');
    }

    private controlsCenter(move: string): boolean {
        return move.includes('d4') || move.includes('e4') || move.includes('d5') || move.includes('e5');
    }

    private improvesCoordination(move: string): boolean {
        return /^[RQ]/.test(move) || move === 'O-O' || move === 'O-O-O';
    }

    private attacksWeakness(move: string): boolean {
        return move.includes('x') || move.includes('+');
    }

    private activatesKing(move: string): boolean {
        return move.startsWith('K') && !move.includes('x');
    }

    private advancesPawn(move: string): boolean {
        return /^[a-h][5-8]/.test(move);
    }

    private exposesKing(move: string): boolean {
        return move.includes('f2') || move.includes('g2') || move.includes('h2') ||
               move.includes('f7') || move.includes('g7') || move.includes('h7');
    }

    private sacrificesMaterial(move: string): boolean {
        return move.includes('x') && (move.startsWith('Q') || move.startsWith('R'));
    }

    private weakensPawnStructure(move: string): boolean {
        return /^[a-h]/.test(move) && (move.includes('3') || move.includes('6'));
    }

    private isComplexMove(move: string): boolean {
        return move.length > 4 || move.includes('=') || move.includes('+');
    }

    private isForcingMove(move: string): boolean {
        return move.includes('x') || move.includes('+') || move.includes('#');
    }

    public getMimicryProfile(): StyleMimicryProfile | null {
        return this.mimicryProfile;
    }
}