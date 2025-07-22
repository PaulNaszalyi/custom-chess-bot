import { UnifiedGameData } from '../data/combined-extractor';
import { ChessPositionManager } from './chess-position-manager';
import { Chess } from 'chess.js';

export interface OpeningMove {
    move: string; // In UCI format (e.g., "e2e4")
    san: string; // In standard algebraic notation (e.g., "e4")
    frequency: number; // How often this move was played
    winRate: number; // Win rate when this move was played
    performance: number; // Overall performance score (0-100)
    averageOpponentRating: number;
    followupMoves: OpeningMove[]; // Most common continuations
    notes: string[]; // Strategic notes about the move
}

export interface OpeningPosition {
    fen: string;
    moves: OpeningMove[];
    totalGames: number;
    successRate: number; // Overall success rate from this position
    popularity: number; // How often this position was reached
    eco?: string; // ECO code if known
    name?: string; // Opening name if known
}

export interface OpeningRepertoire {
    asWhite: Map<string, OpeningPosition>; // Key is FEN without move counters
    asBlack: Map<string, OpeningPosition>;
    statistics: {
        totalPositions: number;
        averageDepth: number;
        preferredOpenings: {
            white: Array<{ name: string; frequency: number; winRate: number }>;
            black: Array<{ name: string; frequency: number; winRate: number }>;
        };
        weakOpenings: {
            white: Array<{ name: string; frequency: number; winRate: number }>;
            black: Array<{ name: string; frequency: number; winRate: number }>;
        };
    };
}

export class OpeningBookBuilder {
    private games: UnifiedGameData[];
    private maxDepth: number = 15; // Maximum moves to analyze per game
    private minFrequency: number = 2; // Minimum times a move must appear to be included

    constructor(games: UnifiedGameData[], maxDepth: number = 15, minFrequency: number = 2) {
        this.games = games;
        this.maxDepth = maxDepth;
        this.minFrequency = minFrequency;
    }

    public buildOpeningRepertoire(): OpeningRepertoire {
        const asWhitePositions = new Map<string, OpeningPosition>();
        const asBlackPositions = new Map<string, OpeningPosition>();
        
        // Process each game to extract opening sequences
        for (const game of this.games) {
            const chess = new Chess();
            const targetColor = game.playerColor;
            const positionMap = targetColor === 'white' ? asWhitePositions : asBlackPositions;
            
            // Analyze opening moves
            for (let moveIndex = 0; moveIndex < Math.min(game.moves.length, this.maxDepth * 2); moveIndex += 2) {
                if (targetColor === 'black' && moveIndex === 0) {
                    // For black, start from move 1 (opponent's first move + our response)
                    continue;
                }
                
                const positionKey = this.getPositionKey(chess.fen());
                
                // Get or create position entry
                if (!positionMap.has(positionKey)) {
                    positionMap.set(positionKey, {
                        fen: chess.fen(),
                        moves: [],
                        totalGames: 0,
                        successRate: 0,
                        popularity: 0,
                        eco: game.opening?.eco,
                        name: game.opening?.name
                    });
                }
                
                const position = positionMap.get(positionKey)!;
                position.totalGames++;
                
                // Record the move made from this position
                const moveToPlay = targetColor === 'white' ? moveIndex : moveIndex + 1;
                if (moveToPlay < game.moves.length) {
                    const moveStr = game.moves[moveToPlay];
                    this.recordMove(position, moveStr, game, chess);
                    
                    // Make the moves to advance position
                    try {
                        if (targetColor === 'white') {
                            chess.move(game.moves[moveIndex]); // Our move
                            if (moveIndex + 1 < game.moves.length) {
                                chess.move(game.moves[moveIndex + 1]); // Opponent's response
                            }
                        } else {
                            if (moveIndex < game.moves.length) {
                                chess.move(game.moves[moveIndex]); // Opponent's move
                            }
                            if (moveIndex + 1 < game.moves.length) {
                                chess.move(game.moves[moveIndex + 1]); // Our move
                            }
                        }
                    } catch (error) {
                        console.warn(`Failed to advance position in game ${game.gameId}:`, error);
                        break; // Stop processing this game
                    }
                }
            }
        }
        
        // Post-process positions to calculate statistics and filter
        this.processPositions(asWhitePositions);
        this.processPositions(asBlackPositions);
        
        // Calculate overall statistics
        const statistics = this.calculateOpeningStatistics(asWhitePositions, asBlackPositions);
        
        return {
            asWhite: asWhitePositions,
            asBlack: asBlackPositions,
            statistics
        };
    }

    private recordMove(position: OpeningPosition, moveStr: string, game: UnifiedGameData, chess: Chess): void {
        // Find existing move or create new one
        let moveEntry = position.moves.find(m => m.san === moveStr);
        
        if (!moveEntry) {
            // Convert to UCI format
            const testChess = new Chess(chess.fen());
            let move;
            
            try {
                move = testChess.move(moveStr);
            } catch (error) {
                console.warn(`Invalid move ${moveStr} in position ${chess.fen()}`);
                return; // Invalid move
            }
            
            if (!move) return; // Invalid move
            
            const uciMove = ChessPositionManager.convertMoveToUCI(move);
            
            moveEntry = {
                move: uciMove,
                san: moveStr,
                frequency: 0,
                winRate: 0,
                performance: 0,
                averageOpponentRating: 0,
                followupMoves: [],
                notes: []
            };
            position.moves.push(moveEntry);
        }
        
        // Update statistics
        moveEntry.frequency++;
        
        const gameWon = game.gameResult === 'win';
        const gameDraw = game.gameResult === 'draw';
        
        // Update win rate (wins = 1, draws = 0.5, losses = 0)
        const gameScore = gameWon ? 1 : (gameDraw ? 0.5 : 0);
        const totalGames = moveEntry.frequency;
        const currentWinRate = moveEntry.winRate;
        
        moveEntry.winRate = ((currentWinRate * (totalGames - 1)) + gameScore) / totalGames;
        
        // Update average opponent rating
        const opponentRating = game.opponentRating || 1200;
        moveEntry.averageOpponentRating = ((moveEntry.averageOpponentRating * (totalGames - 1)) + opponentRating) / totalGames;
        
        // Calculate performance score based on results and opponent strength
        moveEntry.performance = this.calculateMovePerformance(moveEntry);
        
        // Add strategic notes based on game analysis
        this.addStrategicNotes(moveEntry, game, moveStr);
    }

    private calculateMovePerformance(moveEntry: OpeningMove): number {
        // Performance score considers win rate, frequency, and opponent strength
        let performance = moveEntry.winRate * 100; // Base score from win rate
        
        // Bonus for frequency (popular moves are generally good)
        const frequencyBonus = Math.min(20, moveEntry.frequency * 2);
        performance += frequencyBonus;
        
        // Bonus for playing against stronger opponents
        const ratingBonus = Math.max(0, (moveEntry.averageOpponentRating - 1200) / 20);
        performance += ratingBonus;
        
        return Math.min(100, Math.max(0, performance));
    }

    private addStrategicNotes(moveEntry: OpeningMove, game: UnifiedGameData, moveStr: string): void {
        // Add strategic notes based on common patterns
        if (moveStr.includes('O-O')) {
            if (!moveEntry.notes.includes('King safety')) {
                moveEntry.notes.push('King safety');
            }
        }
        
        if (moveStr.includes('d4') || moveStr.includes('e4')) {
            if (!moveEntry.notes.includes('Center control')) {
                moveEntry.notes.push('Center control');
            }
        }
        
        if (moveStr.startsWith('N') || moveStr.startsWith('B')) {
            if (!moveEntry.notes.includes('Development')) {
                moveEntry.notes.push('Development');
            }
        }
        
        if (moveStr.includes('x')) {
            if (!moveEntry.notes.includes('Tactical')) {
                moveEntry.notes.push('Tactical');
            }
        }
        
        // Add opening-specific notes
        if (game.opening?.name) {
            const openingNote = `Part of ${game.opening.name}`;
            if (!moveEntry.notes.includes(openingNote)) {
                moveEntry.notes.push(openingNote);
            }
        }
    }

    private processPositions(positions: Map<string, OpeningPosition>): void {
        // Calculate success rates and popularity
        const totalGames = this.games.length;
        
        positions.forEach((position, key) => {
            // Calculate overall success rate for this position
            let totalWins = 0;
            let totalMoves = 0;
            
            for (const move of position.moves) {
                totalWins += move.winRate * move.frequency;
                totalMoves += move.frequency;
            }
            
            position.successRate = totalMoves > 0 ? totalWins / totalMoves : 0;
            position.popularity = (position.totalGames / totalGames) * 100;
            
            // Filter moves by minimum frequency
            position.moves = position.moves
                .filter(move => move.frequency >= this.minFrequency)
                .sort((a, b) => b.performance - a.performance); // Sort by performance
            
            // Remove positions with no qualifying moves
            if (position.moves.length === 0) {
                positions.delete(key);
            } else {
                // Calculate followup moves for top moves
                this.calculateFollowupMoves(position);
            }
        });
    }

    private calculateFollowupMoves(position: OpeningPosition): void {
        // This is a simplified implementation
        // In a full version, you'd analyze what typically happens after each move
        
        for (const move of position.moves.slice(0, 3)) { // Top 3 moves
            // For now, just add placeholder followup analysis
            move.followupMoves = [];
            
            if (move.frequency > 3) {
                // Add common strategic ideas that typically follow
                if (move.notes.includes('Development')) {
                    move.followupMoves.push({
                        move: 'continuation',
                        san: 'Continue development',
                        frequency: move.frequency,
                        winRate: move.winRate,
                        performance: move.performance * 0.9,
                        averageOpponentRating: move.averageOpponentRating,
                        followupMoves: [],
                        notes: ['Natural continuation']
                    });
                }
            }
        }
    }

    private calculateOpeningStatistics(
        whitePositions: Map<string, OpeningPosition>, 
        blackPositions: Map<string, OpeningPosition>
    ): OpeningRepertoire['statistics'] {
        const totalPositions = whitePositions.size + blackPositions.size;
        
        // Calculate average depth
        let totalDepth = 0;
        let positionCount = 0;
        
        [...whitePositions.values(), ...blackPositions.values()].forEach(position => {
            // Estimate depth from position (simplified)
            const fen = position.fen;
            const moveNumber = parseInt(fen.split(' ')[5]) || 1;
            totalDepth += moveNumber;
            positionCount++;
        });
        
        const averageDepth = positionCount > 0 ? totalDepth / positionCount : 0;
        
        // Identify preferred and weak openings
        const preferredWhite = this.getTopOpenings(whitePositions, true);
        const preferredBlack = this.getTopOpenings(blackPositions, true);
        const weakWhite = this.getTopOpenings(whitePositions, false);
        const weakBlack = this.getTopOpenings(blackPositions, false);
        
        return {
            totalPositions,
            averageDepth,
            preferredOpenings: {
                white: preferredWhite,
                black: preferredBlack
            },
            weakOpenings: {
                white: weakWhite,
                black: weakBlack
            }
        };
    }

    private getTopOpenings(
        positions: Map<string, OpeningPosition>, 
        best: boolean
    ): Array<{ name: string; frequency: number; winRate: number }> {
        const openings: Array<{ name: string; frequency: number; winRate: number }> = [];
        
        positions.forEach(position => {
            if (position.name && position.totalGames >= this.minFrequency) {
                const existing = openings.find(o => o.name === position.name);
                if (existing) {
                    existing.frequency += position.totalGames;
                    existing.winRate = (existing.winRate + position.successRate) / 2;
                } else {
                    openings.push({
                        name: position.name,
                        frequency: position.totalGames,
                        winRate: position.successRate
                    });
                }
            }
        });
        
        // Sort by performance (frequency * win rate) and take top/bottom
        openings.sort((a, b) => {
            const aScore = a.frequency * a.winRate;
            const bScore = b.frequency * b.winRate;
            return best ? bScore - aScore : aScore - bScore;
        });
        
        return openings.slice(0, 5);
    }

    private getPositionKey(fen: string): string {
        // Remove move counters and turn to create a position key
        const parts = fen.split(' ');
        return parts.slice(0, 4).join(' '); // Board, turn, castling, en passant
    }

    // Public utility methods
    public getMoveFromPosition(fen: string, color: 'white' | 'black'): OpeningMove | null {
        const repertoire = this.buildOpeningRepertoire();
        const positions = color === 'white' ? repertoire.asWhite : repertoire.asBlack;
        const positionKey = this.getPositionKey(fen);
        
        const position = positions.get(positionKey);
        if (!position || position.moves.length === 0) {
            return null;
        }
        
        // Return the best move (highest performance)
        return position.moves[0];
    }

    public getPositionAnalysis(fen: string, color: 'white' | 'black'): OpeningPosition | null {
        const repertoire = this.buildOpeningRepertoire();
        const positions = color === 'white' ? repertoire.asWhite : repertoire.asBlack;
        const positionKey = this.getPositionKey(fen);
        
        return positions.get(positionKey) || null;
    }

    public exportOpeningBook(filePath: string): void {
        const repertoire = this.buildOpeningRepertoire();
        
        const exportData = {
            metadata: {
                generatedFrom: `${this.games.length} games`,
                maxDepth: this.maxDepth,
                minFrequency: this.minFrequency,
                generatedAt: new Date().toISOString()
            },
            statistics: repertoire.statistics,
            positions: {
                asWhite: Array.from(repertoire.asWhite.entries()).map(([key, position]) => ({
                    key,
                    ...position
                })),
                asBlack: Array.from(repertoire.asBlack.entries()).map(([key, position]) => ({
                    key,
                    ...position
                }))
            }
        };
        
        const fs = require('fs');
        fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
    }

    public printOpeningStatistics(): void {
        const repertoire = this.buildOpeningRepertoire();
        
        console.log('\n📚 OPENING BOOK ANALYSIS');
        console.log('========================');
        
        console.log(`\n📊 Statistics:`);
        console.log(`  Total Positions: ${repertoire.statistics.totalPositions}`);
        console.log(`  Average Depth: ${repertoire.statistics.averageDepth.toFixed(1)} moves`);
        console.log(`  White Positions: ${repertoire.asWhite.size}`);
        console.log(`  Black Positions: ${repertoire.asBlack.size}`);
        
        console.log(`\n⭐ Preferred Openings as White:`);
        repertoire.statistics.preferredOpenings.white.forEach((opening, i) => {
            console.log(`  ${i + 1}. ${opening.name}: ${opening.frequency} games, ${(opening.winRate * 100).toFixed(1)}% score`);
        });
        
        console.log(`\n⭐ Preferred Openings as Black:`);
        repertoire.statistics.preferredOpenings.black.forEach((opening, i) => {
            console.log(`  ${i + 1}. ${opening.name}: ${opening.frequency} games, ${(opening.winRate * 100).toFixed(1)}% score`);
        });
        
        console.log(`\n⚠️ Openings to Avoid as White:`);
        repertoire.statistics.weakOpenings.white.forEach((opening, i) => {
            console.log(`  ${i + 1}. ${opening.name}: ${opening.frequency} games, ${(opening.winRate * 100).toFixed(1)}% score`);
        });
        
        console.log(`\n⚠️ Openings to Avoid as Black:`);
        repertoire.statistics.weakOpenings.black.forEach((opening, i) => {
            console.log(`  ${i + 1}. ${opening.name}: ${opening.frequency} games, ${(opening.winRate * 100).toFixed(1)}% score`);
        });
        
        // Show sample positions
        console.log(`\n🎯 Sample Positions:`);
        
        const sampleWhitePositions = Array.from(repertoire.asWhite.values())
            .filter(p => p.moves.length > 0)
            .sort((a, b) => b.popularity - a.popularity)
            .slice(0, 3);
            
        sampleWhitePositions.forEach((position, i) => {
            console.log(`\n  ${i + 1}. ${position.name || 'Position'} (${position.popularity.toFixed(1)}% of games)`);
            console.log(`     Success Rate: ${(position.successRate * 100).toFixed(1)}%`);
            console.log(`     Top Moves:`);
            position.moves.slice(0, 3).forEach((move, j) => {
                console.log(`       ${j + 1}. ${move.san} (${move.frequency}x, ${(move.winRate * 100).toFixed(1)}%, perf: ${move.performance.toFixed(0)})`);
            });
        });
    }
}