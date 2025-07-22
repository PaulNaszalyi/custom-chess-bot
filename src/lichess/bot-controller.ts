import { LichessBotClient, LichessGameState, LichessChallenge } from './lichess-bot-client';
import { BotDecisionEngine, BotConfiguration, GameState } from '../engine/bot-decision-engine';
import { ChessPositionManager } from '../engine/chess-position-manager';
import { OpeningBookBuilder } from '../engine/opening-book';
import { UnifiedGameData } from '../data/combined-extractor';
import { EventEmitter } from 'events';

export interface BotControllerConfig {
    lichessToken: string;
    playerToMimic: string;
    maxConcurrentGames: number;
    autoAcceptChallenges: boolean;
    chatMessages: {
        gameStart?: string;
        gameEnd?: string;
        goodMove?: string;
        blunder?: string;
    };
    decisionConfig: BotConfiguration;
}

export interface GameSession {
    gameId: string;
    gameState: LichessGameState;
    positionManager: ChessPositionManager;
    ourColor: 'white' | 'black';
    moveCount: number;
    startTime: number;
    lastMoveTime: number;
    timeManagement: {
        baseTime: number;
        increment: number;
        timeUsedPerMove: number[];
    };
}

export interface BotPerformance {
    gamesPlayed: number;
    wins: number;
    draws: number;
    losses: number;
    totalMoves: number;
    averageThinkingTime: number;
    ratingChange: number;
    styleAccuracy: number; // How well the bot mimics the original player
    tacticalSharpness: number; // Tactical strength shown in games
    mistakes: Array<{
        gameId: string;
        move: string;
        position: string;
        reason: string;
    }>;
    achievements: string[];
}

export class BotController extends EventEmitter {
    private lichessClient: LichessBotClient;
    private decisionEngine: BotDecisionEngine;
    private openingBook: OpeningBookBuilder;
    private activeSessions: Map<string, GameSession> = new Map();
    private performance: BotPerformance;
    private config: BotControllerConfig;
    private isRunning: boolean = false;

    constructor(games: UnifiedGameData[], config: BotControllerConfig) {
        super();
        
        this.config = config;
        this.lichessClient = new LichessBotClient(config.lichessToken);
        this.decisionEngine = new BotDecisionEngine(games, config.decisionConfig);
        this.openingBook = new OpeningBookBuilder(games);
        
        this.performance = {
            gamesPlayed: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            totalMoves: 0,
            averageThinkingTime: 0,
            ratingChange: 0,
            styleAccuracy: 85, // Start with estimated value
            tacticalSharpness: 75,
            mistakes: [],
            achievements: []
        };

        this.setupEventHandlers();
    }

    private setupEventHandlers(): void {
        // Lichess client events
        this.lichessClient.on('challengeReceived', (challenge: LichessChallenge) => {
            this.handleChallenge(challenge);
        });

        this.lichessClient.on('gameStart', (gameState: LichessGameState) => {
            this.handleGameStart(gameState);
        });

        this.lichessClient.on('gameUpdate', (gameState: LichessGameState) => {
            this.handleGameUpdate(gameState);
        });

        this.lichessClient.on('gameEnd', (gameId: string) => {
            this.handleGameEnd(gameId);
        });

        this.lichessClient.on('gameChat', (data: { gameId: string; chat: any }) => {
            this.handleGameChat(data.gameId, data.chat);
        });

        this.lichessClient.on('error', (error: any) => {
            console.error('Lichess client error:', error);
            this.emit('error', error);
        });
    }

    public async start(): Promise<void> {
        console.log('🚀 Starting Personality Chess Bot...');
        
        try {
            // Get bot account info
            const account = await this.lichessClient.getBotAccount();
            console.log(`✅ Bot account: ${account.username} (ID: ${account.id})`);
            
            // Start event stream
            await this.lichessClient.startEventStream();
            
            this.isRunning = true;
            this.emit('started', { account });
            
            console.log('🎮 Bot is now online and ready to play!');
            this.lichessClient.printStatus();
            
        } catch (error) {
            console.error('❌ Failed to start bot:', error);
            this.emit('error', error);
            throw error;
        }
    }

    public async stop(): Promise<void> {
        console.log('🛑 Stopping Personality Chess Bot...');
        
        this.isRunning = false;
        
        // Finish active games gracefully
        const activeSessions = Array.from(this.activeSessions.values());
        for (const session of activeSessions) {
            try {
                await this.lichessClient.sendGameChat(
                    session.gameId, 
                    'Bot shutting down. Thanks for the game!'
                );
            } catch (error) {
                console.error(`Failed to send goodbye message in game ${session.gameId}:`, error);
            }
        }

        await this.lichessClient.disconnect();
        this.activeSessions.clear();
        
        this.emit('stopped');
        console.log('✅ Bot stopped successfully');
    }

    private async handleChallenge(challenge: LichessChallenge): Promise<void> {
        console.log(`🎯 Received challenge from ${challenge.challenger.name} (${challenge.challenger.rating})`);
        
        if (!this.config.autoAcceptChallenges) {
            console.log('⏸️ Auto-accept disabled, ignoring challenge');
            return;
        }

        const decision = this.lichessClient.shouldAcceptChallenge(challenge);
        
        if (decision.accept && this.activeSessions.size < this.config.maxConcurrentGames) {
            try {
                await this.lichessClient.acceptChallenge(challenge.id);
                console.log(`✅ Accepted challenge ${challenge.id}`);
                this.emit('challengeAccepted', challenge);
            } catch (error) {
                console.error(`❌ Failed to accept challenge ${challenge.id}:`, error);
                this.emit('challengeError', { challenge, error });
            }
        } else {
            try {
                await this.lichessClient.declineChallenge(challenge.id, decision.reason);
                console.log(`❌ Declined challenge ${challenge.id}: ${decision.reason}`);
                this.emit('challengeDeclined', { challenge, reason: decision.reason });
            } catch (error) {
                console.error(`Failed to decline challenge ${challenge.id}:`, error);
            }
        }
    }

    private async handleGameStart(gameState: LichessGameState): Promise<void> {
        console.log(`🎮 Game started: ${gameState.id}`);
        
        // Determine our color
        const botAccount = this.lichessClient.getBotAccount();
        const ourColor: 'white' | 'black' = gameState.white.id === botAccount?.id ? 'white' : 'black';
        
        // Create game session
        const session: GameSession = {
            gameId: gameState.id,
            gameState,
            positionManager: new ChessPositionManager(gameState.initialFen),
            ourColor,
            moveCount: 0,
            startTime: Date.now(),
            lastMoveTime: Date.now(),
            timeManagement: {
                baseTime: gameState.clock.initial,
                increment: gameState.clock.increment,
                timeUsedPerMove: []
            }
        };

        this.activeSessions.set(gameState.id, session);
        
        // Send game start message
        if (this.config.chatMessages.gameStart) {
            await this.lichessClient.sendGameChat(gameState.id, this.config.chatMessages.gameStart);
        }
        
        this.emit('gameStarted', session);
        
        // If we're white, make the first move
        if (ourColor === 'white') {
            await this.makeMove(session);
        }
    }

    private async handleGameUpdate(gameState: LichessGameState): Promise<void> {
        const session = this.activeSessions.get(gameState.id);
        if (!session) {
            console.error(`No session found for game ${gameState.id}`);
            return;
        }

        // Update session
        session.gameState = gameState;
        
        // Check if game ended
        if (gameState.state.status !== 'started' && gameState.state.status !== 'created') {
            await this.handleGameEnd(gameState.id);
            return;
        }

        // Parse moves and update position
        const moves = gameState.state.moves.trim().split(' ').filter(move => move);
        const newMoveCount = moves.length;
        
        if (newMoveCount > session.moveCount) {
            // New moves have been made
            for (let i = session.moveCount; i < newMoveCount; i++) {
                session.positionManager.makeMove(moves[i]);
            }
            session.moveCount = newMoveCount;
            
            // Check if it's our turn
            const isOurTurn = (session.ourColor === 'white' && newMoveCount % 2 === 0) ||
                             (session.ourColor === 'black' && newMoveCount % 2 === 1);
            
            if (isOurTurn) {
                console.log(`🤔 Our turn in game ${gameState.id} (move ${Math.floor(newMoveCount / 2) + 1})`);
                await this.makeMove(session);
            }
        }
        
        this.emit('gameUpdated', session);
    }

    private async makeMove(session: GameSession): Promise<void> {
        const startTime = Date.now();
        
        try {
            // Create game state for decision engine
            const gameState: GameState = {
                position: session.positionManager.getFEN(),
                moveHistory: session.positionManager.getMoveHistory().map(m => m.san),
                currentPlayer: session.ourColor,
                gamePhase: session.positionManager.analyzePosition().gamePhase,
                timeRemaining: {
                    white: session.gameState.state.wtime,
                    black: session.gameState.state.btime
                },
                evaluation: 0, // Will be calculated by decision engine
                threats: [],
                opportunities: [],
                availableMoves: session.positionManager.getLegalMoves().map(move => 
                    ChessPositionManager.convertMoveToUCI(move)
                )
            };

            // Check opening book first for opening phase
            let selectedMove: string | null = null;
            
            if (gameState.gamePhase === 'opening') {
                const bookMove = this.openingBook.getMoveFromPosition(
                    session.positionManager.getFEN(),
                    session.ourColor
                );
                
                if (bookMove) {
                    selectedMove = bookMove.move;
                    console.log(`📚 Using opening book move: ${bookMove.san} (${bookMove.performance.toFixed(0)}% performance)`);
                }
            }

            // If no book move, use decision engine
            if (!selectedMove) {
                const decision = await this.decisionEngine.makeMove(gameState);
                selectedMove = decision.selectedMove;
                
                console.log(`🧠 Decision engine selected: ${selectedMove}`);
                console.log(`   Confidence: ${decision.confidence}%`);
                console.log(`   Style Alignment: ${decision.styleAlignment}%`);
                console.log(`   Risk: ${decision.riskAssessment}`);
                
                if (decision.reasoning.length > 0) {
                    console.log(`   Reasoning: ${decision.reasoning[0]}`);
                }
            }

            // Make the move on Lichess
            await this.lichessClient.makeMove(session.gameId, { uci: selectedMove });
            
            // Update our position
            session.positionManager.makeMove(selectedMove);
            session.moveCount++;
            
            // Track thinking time
            const thinkingTime = (Date.now() - startTime) / 1000;
            session.timeManagement.timeUsedPerMove.push(thinkingTime);
            session.lastMoveTime = Date.now();
            
            // Update performance stats
            this.performance.totalMoves++;
            this.updateAverageThinkingTime(thinkingTime);
            
            console.log(`✅ Played ${selectedMove} in ${thinkingTime.toFixed(1)}s`);
            
            this.emit('moveMade', {
                gameId: session.gameId,
                move: selectedMove,
                thinkingTime,
                position: session.positionManager.getFEN()
            });
            
        } catch (error) {
            console.error(`❌ Failed to make move in game ${session.gameId}:`, error);
            
            // Record mistake
            this.performance.mistakes.push({
                gameId: session.gameId,
                move: 'ERROR',
                position: session.positionManager.getFEN(),
                reason: error.toString()
            });
            
            this.emit('moveError', { gameId: session.gameId, error });
        }
    }

    private async handleGameEnd(gameId: string): Promise<void> {
        const session = this.activeSessions.get(gameId);
        if (!session) {
            console.error(`No session found for ended game ${gameId}`);
            return;
        }

        console.log(`🏁 Game ended: ${gameId}`);
        
        // Determine result
        const gameResult = this.determineGameResult(session);
        
        // Update performance statistics
        this.updatePerformanceStats(session, gameResult);
        
        // Send end game message
        if (this.config.chatMessages.gameEnd) {
            try {
                await this.lichessClient.sendGameChat(gameId, this.config.chatMessages.gameEnd);
            } catch (error) {
                console.error(`Failed to send end game message:`, error);
            }
        }

        // Clean up session
        this.activeSessions.delete(gameId);
        
        this.emit('gameEnded', {
            gameId,
            result: gameResult,
            session,
            performance: this.performance
        });

        // Check for achievements
        this.checkAchievements();
        
        console.log(`📊 Performance: ${this.performance.wins}W-${this.performance.draws}D-${this.performance.losses}L (${this.getWinPercentage()}%)`);
    }

    private determineGameResult(session: GameSession): 'win' | 'draw' | 'loss' {
        const gameState = session.gameState;
        
        if (gameState.state.winner) {
            return gameState.state.winner === session.ourColor ? 'win' : 'loss';
        }
        
        // Check for draw conditions
        if (['draw', 'stalemate', 'timeout', 'repetition'].includes(gameState.state.status)) {
            return 'draw';
        }
        
        return 'loss'; // Default to loss if unclear
    }

    private updatePerformanceStats(session: GameSession, result: 'win' | 'draw' | 'loss'): void {
        this.performance.gamesPlayed++;
        
        switch (result) {
            case 'win':
                this.performance.wins++;
                break;
            case 'draw':
                this.performance.draws++;
                break;
            case 'loss':
                this.performance.losses++;
                break;
        }
        
        // Calculate style accuracy based on move choices
        // This is simplified - in reality would compare with historical games
        const moveCount = session.timeManagement.timeUsedPerMove.length;
        if (moveCount > 5) {
            // Adjust style accuracy based on performance
            const gameScore = result === 'win' ? 1 : (result === 'draw' ? 0.5 : 0);
            this.performance.styleAccuracy = (this.performance.styleAccuracy * 0.95) + (gameScore * 100 * 0.05);
        }

        // Update bot performance in decision engine
        const accuracy = this.estimateMoveAccuracy(session);
        this.decisionEngine.updatePerformance(result, accuracy, this.performance.styleAccuracy);
    }

    private updateAverageThinkingTime(thinkingTime: number): void {
        const totalTime = this.performance.averageThinkingTime * (this.performance.totalMoves - 1);
        this.performance.averageThinkingTime = (totalTime + thinkingTime) / this.performance.totalMoves;
    }

    private estimateMoveAccuracy(session: GameSession): number {
        // Simplified move accuracy estimation
        // In reality, would analyze moves with engine
        const averageTime = session.timeManagement.timeUsedPerMove.reduce((a, b) => a + b, 0) / session.timeManagement.timeUsedPerMove.length;
        
        // Assume better accuracy with more thinking time (up to a point)
        const baseAccuracy = Math.min(90, 60 + averageTime * 2);
        
        // Adjust based on game outcome
        const gameResult = this.determineGameResult(session);
        const resultBonus = gameResult === 'win' ? 10 : (gameResult === 'draw' ? 5 : 0);
        
        return Math.min(100, baseAccuracy + resultBonus);
    }

    private checkAchievements(): void {
        const achievements: string[] = [];
        
        if (this.performance.gamesPlayed === 1) {
            achievements.push('First Game Complete');
        }
        
        if (this.performance.wins === 10) {
            achievements.push('10 Wins Milestone');
        }
        
        if (this.performance.gamesPlayed === 100) {
            achievements.push('Centurion - 100 Games');
        }
        
        const winRate = this.getWinPercentage();
        if (winRate >= 60 && this.performance.gamesPlayed >= 10) {
            achievements.push('Strong Performance - 60%+ Win Rate');
        }
        
        if (this.performance.styleAccuracy >= 90 && this.performance.gamesPlayed >= 20) {
            achievements.push('Style Master - 90%+ Style Accuracy');
        }
        
        // Add new achievements
        achievements.forEach(achievement => {
            if (!this.performance.achievements.includes(achievement)) {
                this.performance.achievements.push(achievement);
                console.log(`🏆 Achievement Unlocked: ${achievement}`);
                this.emit('achievement', achievement);
            }
        });
    }

    private async handleGameChat(gameId: string, chat: any): Promise<void> {
        // Handle chat messages from opponents
        if (chat.username !== this.lichessClient.getBotAccount()?.username) {
            console.log(`💬 Chat in ${gameId}: ${chat.username}: ${chat.text}`);
            
            // Simple auto-responses
            const message = chat.text.toLowerCase();
            
            if (message.includes('good game') || message.includes('gg')) {
                await this.lichessClient.sendGameChat(gameId, 'Good game!');
            } else if (message.includes('good move')) {
                if (this.config.chatMessages.goodMove) {
                    await this.lichessClient.sendGameChat(gameId, this.config.chatMessages.goodMove);
                }
            }
            
            this.emit('chatReceived', { gameId, chat });
        }
    }

    // Public Methods
    public getPerformance(): BotPerformance {
        return { ...this.performance };
    }

    public getActiveSessions(): GameSession[] {
        return Array.from(this.activeSessions.values());
    }

    public getWinPercentage(): number {
        if (this.performance.gamesPlayed === 0) return 0;
        return Math.round((this.performance.wins + this.performance.draws * 0.5) / this.performance.gamesPlayed * 100);
    }

    public async challengeUser(username: string): Promise<void> {
        const options = {
            rated: true,
            timeLimit: 10, // 10 minutes
            increment: 0,
            variant: 'standard' as const,
            color: 'random' as const,
            message: `Hello! I'm a personality bot mimicking ${this.config.playerToMimic}'s playing style.`
        };

        try {
            const result = await this.lichessClient.challengeUser(username, options);
            console.log(`✅ Challenged ${username}`);
            this.emit('challengeSent', { username, challenge: result.challenge });
        } catch (error) {
            console.error(`❌ Failed to challenge ${username}:`, error);
            this.emit('challengeError', { username, error });
        }
    }

    public printStatus(): void {
        console.log('\n🤖 BOT CONTROLLER STATUS');
        console.log('=========================');
        
        console.log(`Running: ${this.isRunning ? '✅' : '❌'}`);
        console.log(`Mimicking: ${this.config.playerToMimic}`);
        console.log(`Auto-Accept: ${this.config.autoAcceptChallenges ? '✅' : '❌'}`);
        console.log(`Max Games: ${this.config.maxConcurrentGames}`);
        console.log(`Active Games: ${this.activeSessions.size}`);
        
        console.log('\n📊 PERFORMANCE:');
        console.log(`Games Played: ${this.performance.gamesPlayed}`);
        console.log(`Record: ${this.performance.wins}W-${this.performance.draws}D-${this.performance.losses}L`);
        console.log(`Win Rate: ${this.getWinPercentage()}%`);
        console.log(`Style Accuracy: ${this.performance.styleAccuracy.toFixed(1)}%`);
        console.log(`Avg Thinking Time: ${this.performance.averageThinkingTime.toFixed(1)}s`);
        console.log(`Total Moves: ${this.performance.totalMoves}`);
        
        if (this.performance.achievements.length > 0) {
            console.log('\n🏆 ACHIEVEMENTS:');
            this.performance.achievements.forEach((achievement, i) => {
                console.log(`  ${i + 1}. ${achievement}`);
            });
        }
        
        if (this.activeSessions.size > 0) {
            console.log('\n🎮 ACTIVE GAMES:');
            this.activeSessions.forEach((session, gameId) => {
                const opponent = session.gameState.white.id === this.lichessClient.getBotAccount()?.id ? 
                    session.gameState.black : session.gameState.white;
                const timeElapsed = Math.round((Date.now() - session.startTime) / 1000 / 60);
                console.log(`  ${gameId.slice(0, 8)}: vs ${opponent.name} (${opponent.rating}) - ${timeElapsed}min`);
            });
        }

        this.lichessClient.printStatus();
    }

    public isReady(): boolean {
        return this.isRunning && this.lichessClient.isConnected();
    }
}