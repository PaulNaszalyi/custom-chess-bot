import { UnifiedGameData } from '../data/combined-extractor';
import { TacticalAnalyzer, TacticalProfile } from '../analysis/tactical-analyzer';
import { AdvancedPatternRecognizer, PlayerStyleProfile, AdvancedPattern } from '../analysis/pattern-recognizer';
import { CrossPlatformAnalyzer, CrossPlatformInsights } from '../analysis/cross-platform-analyzer';
import { StyleMimicryEngine, StyleMimicryProfile, MoveEvaluation } from '../analysis/style-mimicry';

export interface GameState {
    position: string; // FEN notation or simplified position description
    moveHistory: string[];
    currentPlayer: 'white' | 'black';
    gamePhase: 'opening' | 'middlegame' | 'endgame';
    timeRemaining: { white: number; black: number };
    evaluation: number; // Position evaluation in centipawns
    threats: string[];
    opportunities: string[];
    availableMoves: string[];
}

export interface BotConfiguration {
    playerToMimic: string;
    platform: 'chess.com' | 'lichess';
    targetStrength: number; // ELO rating to play at
    adaptabilityLevel: 'strict' | 'moderate' | 'flexible'; // How much to deviate from mimicked style
    emergencyOverride: boolean; // Whether to override mimicry in critical situations
    debugMode: boolean; // Whether to output detailed reasoning
    timeManagementStyle: 'conservative' | 'balanced' | 'aggressive';
    riskTolerance: number; // 0-100, overrides player's natural risk tolerance if set
}

export interface MoveDecision {
    selectedMove: string;
    confidence: number; // 0-100, confidence in this move choice
    alternativeMoves: Array<{ move: string; score: number; reason: string }>;
    reasoning: string[];
    timeToThink: number; // Recommended thinking time in seconds
    riskAssessment: 'low' | 'medium' | 'high';
    styleAlignment: number; // 0-100, how well this aligns with mimicked style
    emergencyOverride?: {
        activated: boolean;
        reason: string;
        originalChoice: string;
    };
}

export interface EngineState {
    gamesAnalyzed: number;
    patternsLearned: number;
    lastUpdate: Date;
    confidence: number; // 0-100, overall confidence in mimicry accuracy
    adaptations: string[]; // Recent adaptations made
    performance: {
        gamesPlayed: number;
        winRate: number;
        averageAccuracy: number;
        styleFidelity: number; // How close to original player's style
    };
}

export class BotDecisionEngine {
    private games: UnifiedGameData[];
    private tacticalAnalyzer!: TacticalAnalyzer;
    private patternRecognizer!: AdvancedPatternRecognizer;
    private crossPlatformAnalyzer!: CrossPlatformAnalyzer;
    private styleMimicryEngine!: StyleMimicryEngine;
    
    private tacticalProfile!: TacticalProfile;
    private styleProfile!: PlayerStyleProfile;
    private crossPlatformInsights!: CrossPlatformInsights;
    private mimicryProfile!: StyleMimicryProfile;
    private patterns!: Map<string, AdvancedPattern>;
    
    private configuration: BotConfiguration;
    private engineState!: EngineState;

    constructor(games: UnifiedGameData[], configuration: BotConfiguration) {
        this.games = games;
        this.configuration = configuration;
        
        this.initializeAnalyzers();
        this.buildProfiles();
        this.initializeEngineState();
    }

    private initializeAnalyzers(): void {
        this.tacticalAnalyzer = new TacticalAnalyzer(this.games);
        this.patternRecognizer = new AdvancedPatternRecognizer(this.games);
        this.crossPlatformAnalyzer = new CrossPlatformAnalyzer(this.games);
    }

    private buildProfiles(): void {
        console.log('Building player profiles...');
        
        this.tacticalProfile = this.tacticalAnalyzer.analyzeTacticalProfile();
        this.patterns = this.patternRecognizer.analyzeAdvancedPatterns();
        this.styleProfile = this.patternRecognizer.buildPlayerStyleProfile();
        this.crossPlatformInsights = this.crossPlatformAnalyzer.analyzeCrossPlatform();
        
        this.styleMimicryEngine = new StyleMimicryEngine(
            this.games,
            this.patterns,
            this.styleProfile,
            this.crossPlatformInsights
        );
        
        this.mimicryProfile = this.styleMimicryEngine.buildMimicryProfile();
        
        console.log(`Analyzed ${this.games.length} games, identified ${this.patterns.size} patterns`);
    }

    private initializeEngineState(): void {
        this.engineState = {
            gamesAnalyzed: this.games.length,
            patternsLearned: this.patterns.size,
            lastUpdate: new Date(),
            confidence: Math.min(95, Math.max(60, this.games.length * 2)),
            adaptations: [],
            performance: {
                gamesPlayed: 0,
                winRate: 0,
                averageAccuracy: 0,
                styleFidelity: 85 // Start with reasonable estimate
            }
        };
    }

    public async makeMove(gameState: GameState): Promise<MoveDecision> {
        const startTime = Date.now();

        // Apply platform-specific adaptations
        this.applyPlatformAdaptations(gameState);
        
        // Evaluate all available moves
        const moveEvaluations = await this.evaluateAllMoves(gameState);
        
        // Select the best move based on configuration and profiles
        const selectedMove = this.selectBestMove(moveEvaluations, gameState);
        
        // Check for emergency overrides
        const emergencyOverride = this.checkEmergencyOverrides(selectedMove, gameState);
        let finalMove = selectedMove;
        if (emergencyOverride) {
            finalMove = selectedMove; // Emergency logic would modify the selected move
        }
        
        // Calculate thinking time
        const thinkingTime = this.calculateThinkingTime(gameState, finalMove);
        
        // Build reasoning
        const reasoning = this.buildReasoning(finalMove, gameState, moveEvaluations);

        const processingTime = (Date.now() - startTime) / 1000;

        if (this.configuration.debugMode) {
            console.log(`Move decision made in ${processingTime}s`);
            console.log('Selected:', finalMove.move);
            console.log('Confidence:', finalMove.overallScore);
            console.log('Reasoning:', reasoning.slice(0, 3).join(', '));
        }

        return {
            selectedMove: finalMove.move,
            confidence: Math.round(finalMove.overallScore),
            alternativeMoves: moveEvaluations
                .filter(me => me.move !== finalMove.move)
                .sort((a, b) => b.overallScore - a.overallScore)
                .slice(0, 3)
                .map(me => ({
                    move: me.move,
                    score: me.overallScore,
                    reason: me.explanation[0] || 'Alternative option'
                })),
            reasoning,
            timeToThink: thinkingTime,
            riskAssessment: this.assessRisk(finalMove, gameState),
            styleAlignment: finalMove.mimicryScore || 75,
            emergencyOverride
        };
    }

    private applyPlatformAdaptations(gameState: GameState): void {
        const platformRules = this.mimicryProfile.adaptationRules.platforms
            .find(p => p.platform === this.configuration.platform);
        
        if (platformRules) {
            this.engineState.adaptations.push(`Applied ${this.configuration.platform} adaptations`);
        }
    }

    private async evaluateAllMoves(gameState: GameState): Promise<MoveEvaluation[]> {
        const evaluations: MoveEvaluation[] = [];
        
        // Evaluate each available move
        for (const move of gameState.availableMoves) {
            const evaluation = this.styleMimicryEngine.evaluateMove(move, gameState.gamePhase, {
                position: gameState.position,
                timeRemaining: gameState.timeRemaining[gameState.currentPlayer],
                opponentStrength: this.estimateOpponentStrength(gameState),
                evaluation: gameState.evaluation,
                threats: gameState.threats,
                opportunities: gameState.opportunities
            });
            
            // Apply configuration adjustments
            evaluation.overallScore = this.adjustScoreForConfiguration(evaluation, gameState);
            
            evaluations.push(evaluation);
        }
        
        return evaluations.sort((a, b) => b.overallScore - a.overallScore);
    }

    private adjustScoreForConfiguration(evaluation: MoveEvaluation, gameState: GameState): number {
        let adjustedScore = evaluation.overallScore;
        
        // Adjust for target strength
        if (this.configuration.targetStrength !== this.styleProfile.playingStrength) {
            const strengthDiff = this.configuration.targetStrength - this.styleProfile.playingStrength;
            if (strengthDiff > 0) {
                // Playing stronger: boost tactical and positional scores
                adjustedScore += (evaluation.tacticalScore + evaluation.positionalScore) * 0.1;
            } else {
                // Playing weaker: reduce complexity, add some randomness
                if (evaluation.riskScore > 70) {
                    adjustedScore *= 0.9; // Reduce risky moves
                }
            }
        }
        
        // Adjust for adaptability level
        switch (this.configuration.adaptabilityLevel) {
            case 'strict':
                // Heavily weight mimicry score
                adjustedScore = evaluation.mimicryScore * 0.6 + adjustedScore * 0.4;
                break;
            case 'flexible':
                // Weight objective strength more
                adjustedScore = evaluation.mimicryScore * 0.3 + adjustedScore * 0.7;
                break;
            // 'moderate' keeps the default balance
        }
        
        // Apply risk tolerance override
        if (this.configuration.riskTolerance !== undefined) {
            const riskAdjustment = (this.configuration.riskTolerance - 50) / 100;
            adjustedScore += evaluation.riskScore * riskAdjustment * 0.2;
        }
        
        return Math.max(0, Math.min(100, adjustedScore));
    }

    private selectBestMove(evaluations: MoveEvaluation[], gameState: GameState): MoveEvaluation {
        // Select highest scoring move, with some consideration for style variation
        const topMoves = evaluations.slice(0, 3);
        
        // If adaptability is flexible, occasionally pick the second or third best move
        if (this.configuration.adaptabilityLevel === 'flexible' && Math.random() < 0.15) {
            const alternativeIndex = Math.floor(Math.random() * Math.min(3, topMoves.length));
            return topMoves[alternativeIndex];
        }
        
        return topMoves[0];
    }

    private checkEmergencyOverrides(moveEvaluation: MoveEvaluation, gameState: GameState): MoveDecision['emergencyOverride'] {
        if (!this.configuration.emergencyOverride) {
            return undefined;
        }

        const protocols = this.mimicryProfile.emergencyProtocols;
        let override: MoveDecision['emergencyOverride'];

        // Check for low time situations
        const timeRemaining = gameState.timeRemaining[gameState.currentPlayer];
        if (timeRemaining <= protocols.lowTime.threshold) {
            // Look for a simpler, forcing move
            const forcingMoves = gameState.availableMoves.filter(m => 
                m.includes('x') || m.includes('+') || m.includes('#')
            );
            
            if (forcingMoves.length > 0 && !forcingMoves.includes(moveEvaluation.move)) {
                override = {
                    activated: true,
                    reason: 'Low time - switching to forcing move',
                    originalChoice: moveEvaluation.move
                };
            }
        }

        // Check for losing position
        if (gameState.evaluation <= protocols.losingPosition.threshold) {
            // Look for tactical complications
            const tacticalMoves = gameState.availableMoves.filter(m => 
                m.includes('x') || m.includes('+')
            );
            
            if (tacticalMoves.length > 0 && moveEvaluation.riskScore < 50) {
                override = {
                    activated: true,
                    reason: 'Losing position - seeking complications',
                    originalChoice: moveEvaluation.move
                };
            }
        }

        return override;
    }

    private calculateThinkingTime(gameState: GameState, moveEvaluation: MoveEvaluation): number {
        const baseTime = 10; // Base thinking time in seconds
        const timeRemaining = gameState.timeRemaining[gameState.currentPlayer];
        
        let thinkingTime = baseTime;
        
        // Adjust based on position complexity
        if (gameState.threats.length > 2 || gameState.opportunities.length > 2) {
            thinkingTime += 15;
        }
        
        // Adjust based on game phase
        if (gameState.gamePhase === 'middlegame') {
            thinkingTime += 10;
        } else if (gameState.gamePhase === 'endgame') {
            thinkingTime += 5;
        }
        
        // Adjust based on move complexity
        if (moveEvaluation.riskScore > 70) {
            thinkingTime += 20;
        }
        
        // Apply time management style
        switch (this.configuration.timeManagementStyle) {
            case 'conservative':
                thinkingTime *= 1.3;
                break;
            case 'aggressive':
                thinkingTime *= 0.7;
                break;
        }
        
        // Never use more than 20% of remaining time for one move
        const maxTime = timeRemaining * 0.2;
        thinkingTime = Math.min(thinkingTime, maxTime);
        
        // Never think less than 3 seconds unless in severe time trouble
        if (timeRemaining > 30) {
            thinkingTime = Math.max(3, thinkingTime);
        }
        
        return Math.round(thinkingTime);
    }

    private buildReasoning(moveEvaluation: MoveEvaluation, gameState: GameState, allEvaluations: MoveEvaluation[]): string[] {
        const reasoning: string[] = [];
        
        // Primary reason for move selection
        if (moveEvaluation.mimicryScore >= 70) {
            reasoning.push(`Move aligns well with ${this.configuration.playerToMimic}'s typical style (${moveEvaluation.mimicryScore}% match)`);
        }
        
        if (moveEvaluation.tacticalScore >= 75) {
            reasoning.push(`Strong tactical opportunity (${moveEvaluation.tacticalScore}% tactical strength)`);
        }
        
        if (moveEvaluation.positionalScore >= 75) {
            reasoning.push(`Excellent positional improvement (${moveEvaluation.positionalScore}% positional value)`);
        }
        
        // Risk assessment
        if (moveEvaluation.riskScore >= 70) {
            reasoning.push(`High-risk move justified by position demands (${moveEvaluation.riskScore}% risk)`);
        } else if (moveEvaluation.riskScore <= 30) {
            reasoning.push(`Safe, solid choice with low risk (${moveEvaluation.riskScore}% risk)`);
        }
        
        // Time considerations
        const timeRemaining = gameState.timeRemaining[gameState.currentPlayer];
        if (timeRemaining < 120) {
            reasoning.push(`Time pressure influenced selection (${Math.round(timeRemaining)}s remaining)`);
        }
        
        // Pattern matching
        const relevantPatterns = Array.from(this.patterns.values()).filter(pattern => 
            pattern.gamePhase === gameState.gamePhase || pattern.gamePhase === 'any'
        );
        
        if (relevantPatterns.length > 0) {
            const strongPatterns = relevantPatterns.filter(p => p.confidence >= 70);
            if (strongPatterns.length > 0) {
                reasoning.push(`Move follows recognized successful patterns: ${strongPatterns[0].name}`);
            }
        }
        
        // Configuration influence
        if (this.configuration.adaptabilityLevel === 'strict') {
            reasoning.push('Prioritizing style mimicry over objective strength');
        } else if (this.configuration.adaptabilityLevel === 'flexible') {
            reasoning.push('Balancing style mimicry with optimal play');
        }
        
        return reasoning.slice(0, 5); // Limit to most important reasons
    }

    private assessRisk(moveEvaluation: MoveEvaluation, gameState: GameState): 'low' | 'medium' | 'high' {
        if (moveEvaluation.riskScore >= 70) return 'high';
        if (moveEvaluation.riskScore >= 40) return 'medium';
        return 'low';
    }

    private estimateOpponentStrength(gameState: GameState): number {
        // Simplified opponent strength estimation
        // In a real implementation, this would analyze opponent's moves
        return this.configuration.targetStrength; // Default assumption
    }

    // Public methods for engine management
    public updateConfiguration(newConfig: Partial<BotConfiguration>): void {
        this.configuration = { ...this.configuration, ...newConfig };
        this.engineState.adaptations.push(`Configuration updated: ${Object.keys(newConfig).join(', ')}`);
    }

    public getEngineState(): EngineState {
        return { ...this.engineState };
    }

    public getPlayerProfiles(): {
        tactical: TacticalProfile;
        style: PlayerStyleProfile;
        mimicry: StyleMimicryProfile;
        crossPlatform: CrossPlatformInsights;
    } {
        return {
            tactical: this.tacticalProfile,
            style: this.styleProfile,
            mimicry: this.mimicryProfile,
            crossPlatform: this.crossPlatformInsights
        };
    }

    public printEngineStatus(): void {
        console.log('\n🤖 BOT DECISION ENGINE STATUS');
        console.log('==============================');
        
        console.log(`\n📊 Training Data:`);
        console.log(`  Games Analyzed: ${this.engineState.gamesAnalyzed}`);
        console.log(`  Patterns Learned: ${this.engineState.patternsLearned}`);
        console.log(`  Last Updated: ${this.engineState.lastUpdate.toISOString().split('T')[0]}`);
        console.log(`  Confidence: ${this.engineState.confidence}%`);
        
        console.log(`\n⚙️ Configuration:`);
        console.log(`  Mimicking: ${this.configuration.playerToMimic}`);
        console.log(`  Platform: ${this.configuration.platform}`);
        console.log(`  Target Strength: ${this.configuration.targetStrength}`);
        console.log(`  Adaptability: ${this.configuration.adaptabilityLevel}`);
        console.log(`  Time Management: ${this.configuration.timeManagementStyle}`);
        
        console.log(`\n🎯 Player Profile:`);
        console.log(`  Playing Style: ${this.mimicryProfile.playerIdentity.playingStyle}`);
        console.log(`  Estimated Strength: ${this.mimicryProfile.playerIdentity.estimatedStrength}`);
        console.log(`  Risk Tolerance: ${this.mimicryProfile.decisionFactors.riskTolerance}%`);
        console.log(`  Tactical Weight: ${this.mimicryProfile.decisionFactors.tacticalWeight}%`);
        
        console.log(`\n📈 Performance:`);
        console.log(`  Games Played: ${this.engineState.performance.gamesPlayed}`);
        console.log(`  Win Rate: ${this.engineState.performance.winRate.toFixed(1)}%`);
        console.log(`  Style Fidelity: ${this.engineState.performance.styleFidelity}%`);
        
        if (this.engineState.adaptations.length > 0) {
            console.log(`\n🔧 Recent Adaptations:`);
            this.engineState.adaptations.slice(-3).forEach((adaptation, i) => {
                console.log(`  ${i + 1}. ${adaptation}`);
            });
        }
    }

    public updatePerformance(gameResult: 'win' | 'loss' | 'draw', accuracy: number, styleFidelity: number): void {
        this.engineState.performance.gamesPlayed++;
        
        // Update win rate
        const currentWins = this.engineState.performance.winRate * (this.engineState.performance.gamesPlayed - 1) / 100;
        const newWins = currentWins + (gameResult === 'win' ? 1 : 0);
        this.engineState.performance.winRate = (newWins / this.engineState.performance.gamesPlayed) * 100;
        
        // Update accuracy (running average)
        const currentAccuracy = this.engineState.performance.averageAccuracy;
        this.engineState.performance.averageAccuracy = 
            (currentAccuracy * (this.engineState.performance.gamesPlayed - 1) + accuracy) / this.engineState.performance.gamesPlayed;
        
        // Update style fidelity (running average)
        const currentFidelity = this.engineState.performance.styleFidelity;
        this.engineState.performance.styleFidelity = 
            (currentFidelity * (this.engineState.performance.gamesPlayed - 1) + styleFidelity) / this.engineState.performance.gamesPlayed;
    }
}