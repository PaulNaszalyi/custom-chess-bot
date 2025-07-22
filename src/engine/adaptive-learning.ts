import { UnifiedGameData } from '../data/combined-extractor';
import { GameSession } from '../lichess/bot-controller';
import { ChessPositionManager } from './chess-position-manager';
import { AdvancedPattern } from '../analysis/pattern-recognizer';
import fs from 'fs';

export interface LearningData {
    gameId: string;
    date: string;
    opponent: {
        name: string;
        rating: number;
    };
    result: 'win' | 'draw' | 'loss';
    ourColor: 'white' | 'black';
    moves: Array<{
        moveNumber: number;
        move: string;
        position: string;
        timeSpent: number;
        evaluation?: number;
        wasBookMove: boolean;
        confidence: number;
        styleAlignment: number;
        actualOutcome: 'excellent' | 'good' | 'neutral' | 'poor' | 'blunder';
    }>;
    openingName?: string;
    gamePhase: 'opening' | 'middlegame' | 'endgame';
    lessonsLearned: string[];
    improvements: Array<{
        position: string;
        actualMove: string;
        suggestedMove: string;
        reason: string;
        priority: 'high' | 'medium' | 'low';
    }>;
}

export interface LearningInsights {
    totalGamesAnalyzed: number;
    improvementAreas: Array<{
        area: string;
        frequency: number;
        averageImpact: number;
        recommendations: string[];
    }>;
    strongPatterns: Array<{
        pattern: string;
        successRate: number;
        frequency: number;
        shouldUseMore: boolean;
    }>;
    weakPatterns: Array<{
        pattern: string;
        successRate: number;
        frequency: number;
        shouldAvoid: boolean;
    }>;
    opponentAdaptations: Array<{
        ratingRange: string;
        specificAdjustments: string[];
        successRate: number;
    }>;
    timeManagementLessons: {
        averageThinkingTime: number;
        optimalTimeDistribution: Array<{
            gamePhase: 'opening' | 'middlegame' | 'endgame';
            recommendedTimePercentage: number;
        }>;
        timeTraps: string[];
    };
    styleMimicryAccuracy: {
        overall: number;
        byGamePhase: Array<{
            phase: 'opening' | 'middlegame' | 'endgame';
            accuracy: number;
        }>;
        deviationReasons: Array<{
            reason: string;
            frequency: number;
            impact: 'positive' | 'negative' | 'neutral';
        }>;
    };
}

export interface AdaptationRule {
    id: string;
    name: string;
    condition: string;
    adjustment: string;
    confidence: number; // 0-100, how sure we are this rule helps
    gamesApplied: number;
    successRate: number;
    created: string;
    lastUsed?: string;
}

export class AdaptiveLearningSystem {
    private learningHistory: LearningData[] = [];
    private adaptationRules: AdaptationRule[] = [];
    private learningInsights: LearningInsights | null = null;
    private dataFilePath: string;
    private minGamesForInsight: number = 5;

    constructor(dataFilePath: string = './data/adaptive-learning.json') {
        this.dataFilePath = dataFilePath;
        this.loadLearningData();
    }

    public analyzeGameSession(session: GameSession, result: 'win' | 'draw' | 'loss'): LearningData {
        const gameState = session.gameState;
        const opponent = gameState.white.id === session.ourColor ? gameState.black : gameState.white;
        
        const learningData: LearningData = {
            gameId: session.gameId,
            date: new Date().toISOString(),
            opponent: {
                name: opponent.name,
                rating: opponent.rating
            },
            result,
            ourColor: session.ourColor,
            moves: [],
            gamePhase: 'opening', // Will be updated as we analyze
            lessonsLearned: [],
            improvements: []
        };

        // Analyze each move we made
        const moveHistory = session.positionManager.getMoveHistory();
        const timeSpent = session.timeManagement.timeUsedPerMove;
        
        moveHistory.forEach((move, index) => {
            const moveNumber = Math.floor(index / 2) + 1;
            const gamePhase = this.determineGamePhase(moveNumber, moveHistory.length);
            
            const moveAnalysis = {
                moveNumber,
                move: move.san,
                position: session.positionManager.getFEN(),
                timeSpent: timeSpent[index] || 0,
                wasBookMove: gamePhase === 'opening' && moveNumber <= 10,
                confidence: this.estimateMoveConfidence(move, gamePhase, result),
                styleAlignment: this.estimateStyleAlignment(move, gamePhase),
                actualOutcome: this.evaluateMoveOutcome(move, index, result, moveHistory)
            };

            learningData.moves.push(moveAnalysis);
        });

        // Identify lessons learned
        learningData.lessonsLearned = this.extractLessons(learningData);
        
        // Identify specific improvements
        learningData.improvements = this.identifyImprovements(learningData);

        // Add to learning history
        this.learningHistory.push(learningData);
        
        // Save learning data
        this.saveLearningData();
        
        console.log(`📚 Learning analysis complete for game ${session.gameId}`);
        console.log(`   Lessons learned: ${learningData.lessonsLearned.length}`);
        console.log(`   Improvements identified: ${learningData.improvements.length}`);
        
        return learningData;
    }

    public generateLearningInsights(): LearningInsights {
        if (this.learningHistory.length < this.minGamesForInsight) {
            throw new Error(`Need at least ${this.minGamesForInsight} games for insights, have ${this.learningHistory.length}`);
        }

        const insights: LearningInsights = {
            totalGamesAnalyzed: this.learningHistory.length,
            improvementAreas: this.identifyImprovementAreas(),
            strongPatterns: this.identifyStrongPatterns(),
            weakPatterns: this.identifyWeakPatterns(),
            opponentAdaptations: this.analyzeOpponentAdaptations(),
            timeManagementLessons: this.analyzeTimeManagement(),
            styleMimicryAccuracy: this.analyzeStyleMimicryAccuracy()
        };

        this.learningInsights = insights;
        return insights;
    }

    public createAdaptationRules(): AdaptationRule[] {
        if (!this.learningInsights) {
            this.generateLearningInsights();
        }

        const newRules: AdaptationRule[] = [];

        // Create rules based on improvement areas
        this.learningInsights!.improvementAreas.forEach((area, index) => {
            if (area.frequency > 3 && area.averageImpact > 50) {
                const rule: AdaptationRule = {
                    id: `improvement_${index}_${Date.now()}`,
                    name: `Improve ${area.area}`,
                    condition: `Game phase or pattern matches ${area.area}`,
                    adjustment: area.recommendations[0] || 'Increase focus on this area',
                    confidence: Math.min(90, area.frequency * 10 + area.averageImpact),
                    gamesApplied: 0,
                    successRate: 0,
                    created: new Date().toISOString()
                };
                newRules.push(rule);
            }
        });

        // Create rules based on weak patterns
        this.learningInsights!.weakPatterns.forEach((pattern, index) => {
            if (pattern.shouldAvoid && pattern.frequency > 2) {
                const rule: AdaptationRule = {
                    id: `avoid_pattern_${index}_${Date.now()}`,
                    name: `Avoid ${pattern.pattern}`,
                    condition: `Pattern matches ${pattern.pattern}`,
                    adjustment: `Decrease likelihood of this pattern by 50%`,
                    confidence: Math.round((100 - pattern.successRate) * pattern.frequency / 10),
                    gamesApplied: 0,
                    successRate: 0,
                    created: new Date().toISOString()
                };
                newRules.push(rule);
            }
        });

        // Create rules based on opponent adaptations
        this.learningInsights!.opponentAdaptations.forEach((adaptation, index) => {
            if (adaptation.successRate > 60) {
                const rule: AdaptationRule = {
                    id: `opponent_adapt_${index}_${Date.now()}`,
                    name: `${adaptation.ratingRange} Adaptation`,
                    condition: `Opponent rating in range ${adaptation.ratingRange}`,
                    adjustment: adaptation.specificAdjustments[0] || 'Apply specific adjustments for this rating range',
                    confidence: Math.round(adaptation.successRate),
                    gamesApplied: 0,
                    successRate: 0,
                    created: new Date().toISOString()
                };
                newRules.push(rule);
            }
        });

        // Add new rules to existing rules
        this.adaptationRules.push(...newRules);
        
        // Remove rules with very low confidence or success rate
        this.adaptationRules = this.adaptationRules.filter(rule => 
            rule.confidence > 30 && (rule.gamesApplied === 0 || rule.successRate > 25)
        );

        console.log(`🧠 Created ${newRules.length} new adaptation rules`);
        console.log(`📊 Total active rules: ${this.adaptationRules.length}`);

        return newRules;
    }

    public getApplicableRules(context: {
        gamePhase: 'opening' | 'middlegame' | 'endgame';
        opponentRating: number;
        position: string;
        timeRemaining: number;
    }): AdaptationRule[] {
        const applicableRules = this.adaptationRules.filter(rule => {
            // Simple rule matching - in a real system this would be more sophisticated
            if (rule.condition.includes('rating') && context.opponentRating) {
                return this.matchesRatingCondition(rule.condition, context.opponentRating);
            }
            
            if (rule.condition.includes('phase')) {
                return rule.condition.includes(context.gamePhase);
            }
            
            return false;
        });

        // Sort by confidence and recent success
        return applicableRules
            .sort((a, b) => {
                const scoreA = a.confidence + (a.successRate * 0.5);
                const scoreB = b.confidence + (b.successRate * 0.5);
                return scoreB - scoreA;
            })
            .slice(0, 5); // Top 5 rules
    }

    public applyRule(ruleId: string, successful: boolean): void {
        const rule = this.adaptationRules.find(r => r.id === ruleId);
        if (!rule) return;

        rule.gamesApplied++;
        rule.lastUsed = new Date().toISOString();
        
        // Update success rate
        const currentSuccesses = rule.successRate * (rule.gamesApplied - 1) / 100;
        const newSuccesses = currentSuccesses + (successful ? 1 : 0);
        rule.successRate = (newSuccesses / rule.gamesApplied) * 100;
        
        // Adjust confidence based on recent performance
        if (successful) {
            rule.confidence = Math.min(100, rule.confidence + 2);
        } else {
            rule.confidence = Math.max(0, rule.confidence - 1);
        }

        console.log(`🔄 Applied rule "${rule.name}": ${successful ? 'SUCCESS' : 'FAILURE'}`);
        console.log(`   Success rate: ${rule.successRate.toFixed(1)}%, Confidence: ${rule.confidence}`);
    }

    // Analysis Methods
    private identifyImprovementAreas(): LearningInsights['improvementAreas'] {
        const areas = new Map<string, { count: number; impact: number; examples: string[] }>();

        this.learningHistory.forEach(game => {
            game.improvements.forEach(improvement => {
                const area = this.categorizeImprovement(improvement.reason);
                if (!areas.has(area)) {
                    areas.set(area, { count: 0, impact: 0, examples: [] });
                }
                const data = areas.get(area)!;
                data.count++;
                data.impact += improvement.priority === 'high' ? 3 : (improvement.priority === 'medium' ? 2 : 1);
                data.examples.push(improvement.reason);
            });
        });

        return Array.from(areas.entries())
            .map(([area, data]) => ({
                area,
                frequency: data.count,
                averageImpact: data.impact / data.count,
                recommendations: this.generateRecommendations(area, data.examples)
            }))
            .sort((a, b) => b.frequency * b.averageImpact - a.frequency * a.averageImpact)
            .slice(0, 5);
    }

    private identifyStrongPatterns(): LearningInsights['strongPatterns'] {
        const patterns = this.analyzePatternPerformance();
        
        return patterns
            .filter(p => p.successRate >= 65 && p.frequency >= 3)
            .map(p => ({
                ...p,
                shouldUseMore: p.frequency < 10 && p.successRate >= 70
            }))
            .slice(0, 10);
    }

    private identifyWeakPatterns(): LearningInsights['weakPatterns'] {
        const patterns = this.analyzePatternPerformance();
        
        return patterns
            .filter(p => p.successRate <= 40 && p.frequency >= 2)
            .map(p => ({
                ...p,
                shouldAvoid: p.successRate <= 30
            }))
            .slice(0, 5);
    }

    private analyzePatternPerformance(): Array<{ pattern: string; successRate: number; frequency: number }> {
        const patterns = new Map<string, { successes: number; total: number }>();

        this.learningHistory.forEach(game => {
            const gameSuccess = game.result === 'win' ? 1 : (game.result === 'draw' ? 0.5 : 0);
            
            game.moves.forEach(move => {
                const pattern = this.identifyMovePattern(move);
                if (!patterns.has(pattern)) {
                    patterns.set(pattern, { successes: 0, total: 0 });
                }
                const data = patterns.get(pattern)!;
                data.total++;
                data.successes += gameSuccess;
            });
        });

        return Array.from(patterns.entries())
            .map(([pattern, data]) => ({
                pattern,
                successRate: (data.successes / data.total) * 100,
                frequency: data.total
            }))
            .filter(p => p.frequency >= 2);
    }

    private analyzeOpponentAdaptations(): LearningInsights['opponentAdaptations'] {
        const ratingRanges = ['800-1200', '1200-1600', '1600-2000', '2000+'];
        
        return ratingRanges.map(range => {
            const gamesInRange = this.learningHistory.filter(game => 
                this.isInRatingRange(game.opponent.rating, range)
            );
            
            if (gamesInRange.length < 2) {
                return {
                    ratingRange: range,
                    specificAdjustments: [],
                    successRate: 0
                };
            }

            const wins = gamesInRange.filter(g => g.result === 'win').length;
            const draws = gamesInRange.filter(g => g.result === 'draw').length;
            const successRate = ((wins + draws * 0.5) / gamesInRange.length) * 100;
            
            const adjustments = this.identifySuccessfulAdjustments(gamesInRange);

            return {
                ratingRange: range,
                specificAdjustments: adjustments,
                successRate
            };
        });
    }

    private analyzeTimeManagement(): LearningInsights['timeManagementLessons'] {
        const allMoves = this.learningHistory.flatMap(g => g.moves);
        const averageTime = allMoves.reduce((sum, m) => sum + m.timeSpent, 0) / allMoves.length;

        const phaseDistribution = ['opening', 'middlegame', 'endgame'].map(phase => {
            const phaseMoves = allMoves.filter(m => this.determineGamePhase(m.moveNumber, 50) === phase);
            const avgPhaseTime = phaseMoves.reduce((sum, m) => sum + m.timeSpent, 0) / phaseMoves.length;
            
            return {
                gamePhase: phase as 'opening' | 'middlegame' | 'endgame',
                recommendedTimePercentage: Math.round((avgPhaseTime / averageTime) * 100)
            };
        });

        return {
            averageThinkingTime: averageTime,
            optimalTimeDistribution: phaseDistribution,
            timeTraps: this.identifyTimeTraps()
        };
    }

    private analyzeStyleMimicryAccuracy(): LearningInsights['styleMimicryAccuracy'] {
        const allMoves = this.learningHistory.flatMap(g => g.moves);
        const overallAccuracy = allMoves.reduce((sum, m) => sum + m.styleAlignment, 0) / allMoves.length;

        const byGamePhase = ['opening', 'middlegame', 'endgame'].map(phase => {
            const phaseMoves = allMoves.filter(m => this.determineGamePhase(m.moveNumber, 50) === phase);
            const accuracy = phaseMoves.reduce((sum, m) => sum + m.styleAlignment, 0) / phaseMoves.length;
            
            return {
                phase: phase as 'opening' | 'middlegame' | 'endgame',
                accuracy: accuracy || 0
            };
        });

        return {
            overall: overallAccuracy,
            byGamePhase,
            deviationReasons: this.analyzeStyleDeviations()
        };
    }

    // Helper Methods
    private determineGamePhase(moveNumber: number, totalMoves: number): 'opening' | 'middlegame' | 'endgame' {
        if (moveNumber <= 15) return 'opening';
        if (moveNumber <= Math.max(30, totalMoves * 0.7)) return 'middlegame';
        return 'endgame';
    }

    private estimateMoveConfidence(move: any, gamePhase: string, result: string): number {
        let confidence = 75; // Base confidence
        
        if (gamePhase === 'opening') confidence += 10; // More confident in opening
        if (result === 'win') confidence += 10;
        if (result === 'loss') confidence -= 15;
        
        return Math.max(0, Math.min(100, confidence));
    }

    private estimateStyleAlignment(move: any, gamePhase: string): number {
        // Simplified style alignment estimation
        let alignment = 80; // Base alignment
        
        if (gamePhase === 'opening') alignment += 15; // Opening moves likely well-aligned
        
        return Math.max(0, Math.min(100, alignment));
    }

    private evaluateMoveOutcome(move: any, index: number, result: string, moveHistory: any[]): LearningData['moves'][0]['actualOutcome'] {
        // Simplified move outcome evaluation
        if (result === 'win' && index < moveHistory.length * 0.3) return 'excellent';
        if (result === 'win') return 'good';
        if (result === 'draw') return 'neutral';
        if (result === 'loss' && index > moveHistory.length * 0.7) return 'poor';
        return 'neutral';
    }

    private extractLessons(learningData: LearningData): string[] {
        const lessons: string[] = [];
        
        if (learningData.result === 'loss') {
            lessons.push('Analyze losing patterns');
            if (learningData.moves.some(m => m.actualOutcome === 'blunder')) {
                lessons.push('Avoid critical blunders');
            }
        }
        
        if (learningData.moves.some(m => m.timeSpent > 60)) {
            lessons.push('Improve time management');
        }
        
        return lessons;
    }

    private identifyImprovements(learningData: LearningData): LearningData['improvements'] {
        const improvements: LearningData['improvements'] = [];
        
        learningData.moves.forEach(move => {
            if (move.actualOutcome === 'poor' || move.actualOutcome === 'blunder') {
                improvements.push({
                    position: move.position,
                    actualMove: move.move,
                    suggestedMove: 'Better alternative needed',
                    reason: `Move led to ${move.actualOutcome} outcome`,
                    priority: move.actualOutcome === 'blunder' ? 'high' : 'medium'
                });
            }
        });
        
        return improvements;
    }

    private categorizeImprovement(reason: string): string {
        if (reason.includes('time') || reason.includes('clock')) return 'Time Management';
        if (reason.includes('tactical') || reason.includes('tactic')) return 'Tactical Vision';
        if (reason.includes('positional') || reason.includes('position')) return 'Positional Understanding';
        if (reason.includes('opening')) return 'Opening Knowledge';
        if (reason.includes('endgame')) return 'Endgame Technique';
        return 'General Play';
    }

    private generateRecommendations(area: string, examples: string[]): string[] {
        const recommendations: Record<string, string[]> = {
            'Time Management': ['Practice rapid calculation', 'Set time limits per move', 'Prioritize critical positions'],
            'Tactical Vision': ['Solve tactical puzzles', 'Look for forcing moves', 'Check for hanging pieces'],
            'Positional Understanding': ['Study pawn structures', 'Improve piece coordination', 'Focus on weak squares'],
            'Opening Knowledge': ['Expand opening repertoire', 'Study opening principles', 'Memorize key variations'],
            'Endgame Technique': ['Practice basic endgames', 'Improve king activity', 'Study pawn endgames'],
            'General Play': ['Analyze games', 'Study master games', 'Focus on move purpose']
        };
        
        return recommendations[area] || ['Continue studying and practicing'];
    }

    private identifyMovePattern(move: any): string {
        // Simplified pattern identification
        if (move.move.includes('O-O')) return 'Castling';
        if (move.move.includes('x')) return 'Capture';
        if (move.move.includes('+')) return 'Check';
        if (move.move.startsWith('N')) return 'Knight Move';
        if (move.move.startsWith('B')) return 'Bishop Move';
        if (move.move.startsWith('Q')) return 'Queen Move';
        return 'Pawn Move';
    }

    private matchesRatingCondition(condition: string, rating: number): boolean {
        if (condition.includes('800-1200')) return rating >= 800 && rating <= 1200;
        if (condition.includes('1200-1600')) return rating >= 1200 && rating <= 1600;
        if (condition.includes('1600-2000')) return rating >= 1600 && rating <= 2000;
        if (condition.includes('2000+')) return rating >= 2000;
        return false;
    }

    private isInRatingRange(rating: number, range: string): boolean {
        return this.matchesRatingCondition(range, rating);
    }

    private identifySuccessfulAdjustments(games: LearningData[]): string[] {
        const adjustments: string[] = [];
        
        const winningGames = games.filter(g => g.result === 'win');
        if (winningGames.length > games.length * 0.6) {
            adjustments.push('Current approach is working well');
        }
        
        return adjustments;
    }

    private identifyTimeTraps(): string[] {
        const traps: string[] = [];
        
        const longThinkingMoves = this.learningHistory
            .flatMap(g => g.moves)
            .filter(m => m.timeSpent > 60);
            
        if (longThinkingMoves.length > 0) {
            traps.push('Avoid overthinking in simple positions');
        }
        
        return traps;
    }

    private analyzeStyleDeviations(): Array<{ reason: string; frequency: number; impact: 'positive' | 'negative' | 'neutral' }> {
        return [
            { reason: 'Time pressure', frequency: 5, impact: 'negative' },
            { reason: 'Tactical opportunity', frequency: 8, impact: 'positive' },
            { reason: 'Unfamiliar position', frequency: 3, impact: 'neutral' }
        ];
    }

    // Data persistence
    private loadLearningData(): void {
        try {
            if (fs.existsSync(this.dataFilePath)) {
                const data = JSON.parse(fs.readFileSync(this.dataFilePath, 'utf-8'));
                this.learningHistory = data.learningHistory || [];
                this.adaptationRules = data.adaptationRules || [];
                console.log(`📚 Loaded ${this.learningHistory.length} learning records and ${this.adaptationRules.length} adaptation rules`);
            }
        } catch (error) {
            console.warn('Failed to load learning data:', error);
            this.learningHistory = [];
            this.adaptationRules = [];
        }
    }

    private saveLearningData(): void {
        try {
            const data = {
                learningHistory: this.learningHistory,
                adaptationRules: this.adaptationRules,
                lastUpdated: new Date().toISOString()
            };
            
            const dir = this.dataFilePath.substring(0, this.dataFilePath.lastIndexOf('/'));
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(this.dataFilePath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Failed to save learning data:', error);
        }
    }

    // Public utility methods
    public printLearningStats(): void {
        console.log('\n🧠 ADAPTIVE LEARNING STATISTICS');
        console.log('===============================');
        
        console.log(`Games analyzed: ${this.learningHistory.length}`);
        console.log(`Active adaptation rules: ${this.adaptationRules.length}`);
        
        if (this.learningHistory.length > 0) {
            const recentGames = this.learningHistory.slice(-10);
            const wins = recentGames.filter(g => g.result === 'win').length;
            const winRate = (wins / recentGames.length) * 100;
            
            console.log(`Recent performance (last ${recentGames.length} games): ${winRate.toFixed(1)}% win rate`);
            
            const avgLessons = recentGames.reduce((sum, g) => sum + g.lessonsLearned.length, 0) / recentGames.length;
            console.log(`Average lessons per game: ${avgLessons.toFixed(1)}`);
        }
        
        if (this.adaptationRules.length > 0) {
            const activeRules = this.adaptationRules.filter(r => r.confidence > 50);
            console.log(`High-confidence rules: ${activeRules.length}`);
            
            const mostUsed = this.adaptationRules
                .filter(r => r.gamesApplied > 0)
                .sort((a, b) => b.gamesApplied - a.gamesApplied)[0];
                
            if (mostUsed) {
                console.log(`Most applied rule: "${mostUsed.name}" (${mostUsed.gamesApplied} times, ${mostUsed.successRate.toFixed(1)}% success)`);
            }
        }
    }

    public getLearningHistory(): LearningData[] {
        return [...this.learningHistory];
    }

    public getAdaptationRules(): AdaptationRule[] {
        return [...this.adaptationRules];
    }

    public getLearningInsights(): LearningInsights | null {
        return this.learningInsights;
    }
}