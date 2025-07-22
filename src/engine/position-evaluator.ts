export interface PieceValues {
    pawn: number;
    knight: number;
    bishop: number;
    rook: number;
    queen: number;
    king: number;
}

export interface PositionFactors {
    material: number;
    mobility: number;
    kingSafety: number;
    pawnStructure: number;
    pieceCoordination: number;
    centerControl: number;
    development: number;
    endgameFactors: number;
}

export interface PositionEvaluation {
    totalScore: number; // Centipawns (+/- from current player's perspective)
    factors: PositionFactors;
    gamePhase: 'opening' | 'middlegame' | 'endgame';
    confidence: number; // 0-100, confidence in evaluation
    explanation: string[];
    threats: Array<{ type: string; severity: 'low' | 'medium' | 'high'; description: string }>;
    opportunities: Array<{ type: string; value: number; description: string }>;
}

export interface MoveScore {
    move: string;
    beforeEvaluation: PositionEvaluation;
    afterEvaluation: PositionEvaluation;
    improvementScore: number; // Difference in position evaluation
    tacticalMerit: number; // 0-100, tactical value
    positionalMerit: number; // 0-100, positional value
    risk: number; // 0-100, risk level
    complexity: number; // 0-100, how complex the resulting position is
    timeRecommended: number; // Seconds recommended to think about this move
    category: 'tactical' | 'positional' | 'defensive' | 'aggressive' | 'quiet' | 'forcing';
    explanation: string[];
}

export class PositionEvaluator {
    private pieceValues: PieceValues = {
        pawn: 100,
        knight: 320,
        bishop: 330,
        rook: 500,
        queen: 900,
        king: 0 // King value is positional, not material
    };

    private phaseWeights = {
        opening: {
            development: 0.25,
            kingSafety: 0.20,
            centerControl: 0.20,
            material: 0.15,
            pawnStructure: 0.10,
            mobility: 0.10
        },
        middlegame: {
            material: 0.25,
            pieceCoordination: 0.20,
            kingSafety: 0.15,
            mobility: 0.15,
            centerControl: 0.12,
            pawnStructure: 0.13
        },
        endgame: {
            material: 0.30,
            kingSafety: 0.05, // Less important in endgame
            endgameFactors: 0.25,
            pawnStructure: 0.20,
            mobility: 0.20
        }
    };

    public evaluatePosition(
        position: string, // Simplified position representation
        moveHistory: string[],
        currentPlayer: 'white' | 'black'
    ): PositionEvaluation {
        const gamePhase = this.determineGamePhase(position, moveHistory);
        const factors = this.calculatePositionFactors(position, gamePhase, currentPlayer);
        const totalScore = this.calculateTotalScore(factors, gamePhase);
        
        const threats = this.identifyThreats(position, currentPlayer);
        const opportunities = this.identifyOpportunities(position, currentPlayer);
        
        const confidence = this.calculateConfidence(position, factors);
        const explanation = this.generateExplanation(factors, gamePhase, totalScore);

        return {
            totalScore,
            factors,
            gamePhase,
            confidence,
            explanation,
            threats,
            opportunities
        };
    }

    public scoreMove(
        move: string,
        currentPosition: string,
        moveHistory: string[],
        currentPlayer: 'white' | 'black'
    ): MoveScore {
        const beforeEvaluation = this.evaluatePosition(currentPosition, moveHistory, currentPlayer);
        const afterPosition = this.simulateMove(currentPosition, move);
        const afterEvaluation = this.evaluatePosition(afterPosition, [...moveHistory, move], currentPlayer);
        
        const improvementScore = afterEvaluation.totalScore - beforeEvaluation.totalScore;
        
        return {
            move,
            beforeEvaluation,
            afterEvaluation,
            improvementScore,
            tacticalMerit: this.calculateTacticalMerit(move, afterEvaluation),
            positionalMerit: this.calculatePositionalMerit(improvementScore, afterEvaluation),
            risk: this.calculateMoveRisk(move, beforeEvaluation, afterEvaluation),
            complexity: this.calculateMoveComplexity(move, afterEvaluation),
            timeRecommended: this.recommendThinkingTime(move, improvementScore, afterEvaluation),
            category: this.categorizeMoveType(move, improvementScore),
            explanation: this.explainMoveScore(move, improvementScore, afterEvaluation)
        };
    }

    private determineGamePhase(position: string, moveHistory: string[]): 'opening' | 'middlegame' | 'endgame' {
        const moveCount = moveHistory.length;
        
        if (moveCount < 20) return 'opening';
        
        // Simple piece counting to determine endgame
        const pieceCount = this.countPieces(position);
        if (pieceCount.total <= 12) return 'endgame';
        if (pieceCount.total <= 20 && pieceCount.queens <= 1) return 'endgame';
        
        return 'middlegame';
    }

    private calculatePositionFactors(position: string, gamePhase: string, currentPlayer: 'white' | 'black'): PositionFactors {
        // Simplified position factor calculation
        // In a real implementation, this would parse FEN or use a chess library
        
        return {
            material: this.evaluateMaterial(position),
            mobility: this.evaluateMobility(position),
            kingSafety: this.evaluateKingSafety(position, currentPlayer),
            pawnStructure: this.evaluatePawnStructure(position),
            pieceCoordination: this.evaluatePieceCoordination(position),
            centerControl: this.evaluateCenterControl(position),
            development: this.evaluateDevelopment(position, gamePhase),
            endgameFactors: gamePhase === 'endgame' ? this.evaluateEndgameFactors(position) : 0
        };
    }

    private calculateTotalScore(factors: PositionFactors, gamePhase: 'opening' | 'middlegame' | 'endgame'): number {
        const weights = this.phaseWeights[gamePhase];
        
        let score = 0;
        score += factors.material * (weights.material || 0);
        score += factors.mobility * (weights.mobility || 0);
        score += factors.kingSafety * (weights.kingSafety || 0);
        score += factors.pawnStructure * (weights.pawnStructure || 0);
        
        if ('pieceCoordination' in weights) {
            score += factors.pieceCoordination * weights.pieceCoordination;
        }
        if ('centerControl' in weights) {
            score += factors.centerControl * weights.centerControl;
        }
        if ('development' in weights) {
            score += factors.development * weights.development;
        }
        if ('endgameFactors' in weights) {
            score += factors.endgameFactors * weights.endgameFactors;
        }
        
        return Math.round(score);
    }

    private identifyThreats(position: string, currentPlayer: 'white' | 'black'): PositionEvaluation['threats'] {
        const threats: PositionEvaluation['threats'] = [];
        
        // Simplified threat detection
        if (this.isKingInDanger(position, currentPlayer)) {
            threats.push({
                type: 'King Attack',
                severity: 'high',
                description: 'King is under immediate threat'
            });
        }
        
        if (this.hasPinnedPieces(position, currentPlayer)) {
            threats.push({
                type: 'Pinned Piece',
                severity: 'medium',
                description: 'Important piece is pinned and vulnerable'
            });
        }
        
        if (this.hasHangingPieces(position, currentPlayer)) {
            threats.push({
                type: 'Hanging Piece',
                severity: 'high',
                description: 'Undefended piece can be captured'
            });
        }
        
        return threats;
    }

    private identifyOpportunities(position: string, currentPlayer: 'white' | 'black'): PositionEvaluation['opportunities'] {
        const opportunities: PositionEvaluation['opportunities'] = [];
        
        // Simplified opportunity detection
        if (this.hasOpponentHangingPieces(position, currentPlayer)) {
            opportunities.push({
                type: 'Material Gain',
                value: 300, // Approximate centipawn value
                description: 'Can capture undefended opponent piece'
            });
        }
        
        if (this.hasTacticalMotif(position, currentPlayer)) {
            opportunities.push({
                type: 'Tactical Shot',
                value: 200,
                description: 'Tactical combination available'
            });
        }
        
        if (this.hasPositionalAdvantage(position, currentPlayer)) {
            opportunities.push({
                type: 'Positional Improvement',
                value: 100,
                description: 'Can improve piece coordination or structure'
            });
        }
        
        return opportunities;
    }

    private calculateTacticalMerit(move: string, afterEvaluation: PositionEvaluation): number {
        let merit = 50; // Base score
        
        if (move.includes('x')) merit += 25; // Captures
        if (move.includes('+')) merit += 20; // Checks
        if (move.includes('#')) merit += 50; // Checkmate
        
        // Bonus for addressing threats
        if (afterEvaluation.threats.length === 0) merit += 15;
        
        // Bonus for creating opportunities
        merit += afterEvaluation.opportunities.length * 10;
        
        return Math.min(100, merit);
    }

    private calculatePositionalMerit(improvementScore: number, afterEvaluation: PositionEvaluation): number {
        let merit = 50 + (improvementScore / 10); // Base score adjusted by improvement
        
        // Factor in positional elements
        if (afterEvaluation.factors.development > 0) merit += 10;
        if (afterEvaluation.factors.centerControl > 0) merit += 8;
        if (afterEvaluation.factors.pawnStructure > 0) merit += 8;
        
        return Math.max(0, Math.min(100, merit));
    }

    private calculateMoveRisk(move: string, beforeEval: PositionEvaluation, afterEval: PositionEvaluation): number {
        let risk = 0;
        
        // Material sacrifice detection
        if (move.includes('x') && this.isSacrifice(move)) {
            risk += 40;
        }
        
        // King exposure
        if (afterEval.factors.kingSafety < beforeEval.factors.kingSafety - 50) {
            risk += 30;
        }
        
        // Complex positions
        if (afterEval.threats.length > beforeEval.threats.length) {
            risk += 20;
        }
        
        // Weakening moves
        if (afterEval.factors.pawnStructure < beforeEval.factors.pawnStructure - 30) {
            risk += 25;
        }
        
        return Math.min(100, risk);
    }

    private calculateMoveComplexity(move: string, afterEvaluation: PositionEvaluation): number {
        let complexity = 30; // Base complexity
        
        if (move.includes('x')) complexity += 15;
        if (move.includes('+')) complexity += 20;
        if (move.includes('=')) complexity += 25; // Pawn promotion
        
        complexity += afterEvaluation.threats.length * 10;
        complexity += afterEvaluation.opportunities.length * 8;
        
        if (afterEvaluation.factors.pieceCoordination > 100) complexity += 15;
        
        return Math.min(100, complexity);
    }

    private recommendThinkingTime(move: string, improvement: number, afterEval: PositionEvaluation): number {
        let baseTime = 15; // Base thinking time in seconds
        
        // Complex moves need more time
        const complexity = this.calculateMoveComplexity(move, afterEval);
        baseTime += complexity * 0.3;
        
        // Important improvements deserve more calculation
        if (Math.abs(improvement) > 100) baseTime += 10;
        
        // Tactical shots need verification
        if (move.includes('x') || move.includes('+')) baseTime += 8;
        
        // Many opportunities require comparison
        if (afterEval.opportunities.length > 2) baseTime += 12;
        
        return Math.max(5, Math.min(60, Math.round(baseTime)));
    }

    private categorizeMoveType(move: string, improvement: number): MoveScore['category'] {
        if (move.includes('x') || move.includes('+') || move.includes('#')) {
            return 'tactical';
        }
        
        if (improvement < -50) return 'defensive';
        if (improvement > 100) return 'aggressive';
        if (improvement > 25) return 'positional';
        if (move.includes('O-O') || !move.includes('x')) return 'quiet';
        
        return 'forcing';
    }

    private explainMoveScore(move: string, improvement: number, afterEval: PositionEvaluation): string[] {
        const explanation: string[] = [];
        
        if (improvement > 50) {
            explanation.push(`Significant improvement (+${Math.round(improvement / 10) / 10} pawns)`);
        } else if (improvement < -50) {
            explanation.push(`Position deteriorates (${Math.round(improvement / 10) / 10} pawns)`);
        }
        
        if (move.includes('x')) {
            explanation.push('Captures material or exchanges pieces');
        }
        
        if (move.includes('+')) {
            explanation.push('Gives check, forcing opponent response');
        }
        
        if (afterEval.threats.length === 0) {
            explanation.push('Resolves immediate threats');
        }
        
        if (afterEval.opportunities.length > 0) {
            explanation.push(`Creates ${afterEval.opportunities.length} tactical opportunities`);
        }
        
        if (afterEval.factors.development > 50) {
            explanation.push('Improves piece development and coordination');
        }
        
        return explanation.slice(0, 3); // Limit to most important explanations
    }

    // Simplified position analysis methods
    // In a real implementation, these would use proper chess position parsing
    
    private evaluateMaterial(position: string): number {
        // Simplified material counting
        // Returns material balance in centipawns
        return 0; // Placeholder - would count pieces and calculate difference
    }

    private evaluateMobility(position: string): number {
        // Evaluate piece mobility and activity
        return Math.random() * 100 - 50; // Placeholder
    }

    private evaluateKingSafety(position: string, player: 'white' | 'black'): number {
        // Evaluate king safety
        return Math.random() * 200 - 100; // Placeholder
    }

    private evaluatePawnStructure(position: string): number {
        // Evaluate pawn structure (weaknesses, chains, etc.)
        return Math.random() * 100 - 50; // Placeholder
    }

    private evaluatePieceCoordination(position: string): number {
        // Evaluate how well pieces work together
        return Math.random() * 100 - 50; // Placeholder
    }

    private evaluateCenterControl(position: string): number {
        // Evaluate control of central squares
        return Math.random() * 80 - 40; // Placeholder
    }

    private evaluateDevelopment(position: string, gamePhase: string): number {
        // Evaluate piece development (mainly relevant in opening)
        if (gamePhase !== 'opening') return 0;
        return Math.random() * 100 - 50; // Placeholder
    }

    private evaluateEndgameFactors(position: string): number {
        // King activity, pawn advancement, etc.
        return Math.random() * 150 - 75; // Placeholder
    }

    private calculateConfidence(position: string, factors: PositionFactors): number {
        // Calculate confidence in evaluation based on position clarity
        let confidence = 85; // Base confidence
        
        // Complex positions reduce confidence
        const complexity = Math.abs(factors.material) + Math.abs(factors.mobility) + 
                          Math.abs(factors.kingSafety) + Math.abs(factors.pieceCoordination);
        
        if (complexity > 300) confidence -= 15;
        if (complexity > 500) confidence -= 10;
        
        return Math.max(60, Math.min(95, confidence));
    }

    private generateExplanation(factors: PositionFactors, gamePhase: string, totalScore: number): string[] {
        const explanation: string[] = [];
        
        if (Math.abs(totalScore) > 200) {
            const advantage = totalScore > 0 ? 'significant advantage' : 'significant disadvantage';
            explanation.push(`Position shows ${advantage} (${Math.round(totalScore / 10) / 10} pawns)`);
        }
        
        // Identify dominant factors
        const sortedFactors = Object.entries(factors)
            .filter(([key, value]) => key !== 'endgameFactors' || gamePhase === 'endgame')
            .sort(([,a], [,b]) => Math.abs(b) - Math.abs(a));
        
        const topFactors = sortedFactors.slice(0, 2);
        topFactors.forEach(([factor, value]) => {
            if (Math.abs(value) > 50) {
                const impact = value > 0 ? 'favorable' : 'unfavorable';
                explanation.push(`${this.factorToHumanString(factor)}: ${impact} (${Math.round(value)})`);
            }
        });
        
        if (gamePhase === 'endgame' && Math.abs(factors.endgameFactors) > 75) {
            explanation.push(`Strong endgame factors favor current position`);
        }
        
        return explanation.slice(0, 3);
    }

    private factorToHumanString(factor: string): string {
        const factorMap: Record<string, string> = {
            material: 'Material balance',
            mobility: 'Piece activity',
            kingSafety: 'King safety',
            pawnStructure: 'Pawn structure',
            pieceCoordination: 'Piece coordination',
            centerControl: 'Center control',
            development: 'Development',
            endgameFactors: 'Endgame technique'
        };
        return factorMap[factor] || factor;
    }

    private countPieces(position: string): { total: number; queens: number } {
        // Placeholder piece counting
        return { total: 20, queens: 2 };
    }

    private simulateMove(position: string, move: string): string {
        // Placeholder move simulation - would apply move to position
        return position + '_after_' + move;
    }

    private isKingInDanger(position: string, player: 'white' | 'black'): boolean {
        return Math.random() < 0.1; // 10% chance of immediate king danger
    }

    private hasPinnedPieces(position: string, player: 'white' | 'black'): boolean {
        return Math.random() < 0.15; // 15% chance of having pinned pieces
    }

    private hasHangingPieces(position: string, player: 'white' | 'black'): boolean {
        return Math.random() < 0.2; // 20% chance of hanging pieces
    }

    private hasOpponentHangingPieces(position: string, player: 'white' | 'black'): boolean {
        return Math.random() < 0.25; // 25% chance of opponent having hanging pieces
    }

    private hasTacticalMotif(position: string, player: 'white' | 'black'): boolean {
        return Math.random() < 0.3; // 30% chance of tactical opportunity
    }

    private hasPositionalAdvantage(position: string, player: 'white' | 'black'): boolean {
        return Math.random() < 0.4; // 40% chance of positional improvement
    }

    private isSacrifice(move: string): boolean {
        // Check if capture is actually a sacrifice
        return move.startsWith('Q') || move.startsWith('R') || 
               (Math.random() < 0.2); // 20% chance of other sacrifices
    }

    // Public utility methods
    public compareMoves(moves: string[], position: string, moveHistory: string[], currentPlayer: 'white' | 'black'): MoveScore[] {
        return moves
            .map(move => this.scoreMove(move, position, moveHistory, currentPlayer))
            .sort((a, b) => b.improvementScore - a.improvementScore);
    }

    public getTopMoves(moves: string[], position: string, moveHistory: string[], currentPlayer: 'white' | 'black', count: number = 5): MoveScore[] {
        return this.compareMoves(moves, position, moveHistory, currentPlayer).slice(0, count);
    }

    public evaluateGameProgression(positionHistory: string[], moveHistory: string[]): Array<{ move: string; evaluation: number; gamePhase: string }> {
        const progression: Array<{ move: string; evaluation: number; gamePhase: string }> = [];
        
        for (let i = 0; i < Math.min(positionHistory.length - 1, moveHistory.length); i++) {
            const position = positionHistory[i];
            const move = moveHistory[i];
            const currentPlayer: 'white' | 'black' = i % 2 === 0 ? 'white' : 'black';
            
            const evaluation = this.evaluatePosition(position, moveHistory.slice(0, i), currentPlayer);
            progression.push({
                move,
                evaluation: evaluation.totalScore,
                gamePhase: evaluation.gamePhase
            });
        }
        
        return progression;
    }
}