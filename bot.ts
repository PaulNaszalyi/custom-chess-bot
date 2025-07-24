import * as dotenv from 'dotenv';
import axios from 'axios';
import { Chess } from 'chess.js';
// Temporarily disable Stockfish integration until library issues resolved
// import { StockfishEngine, StockfishMove } from './src/engine/stockfish-engine';
// import { PaulNasStyleFilter } from './src/engine/paul-nas-style-filter';

// Load environment variables
dotenv.config();

class SimpleWorkingBot {
    private apiToken: string;
    private botUsername: string;
    private activeGames: Map<string, { chess: Chess; ourColor: 'white' | 'black' }> = new Map();
    private openingBook: any;
    // Temporarily disable engines
    // private stockfishEngine: StockfishEngine;
    // private styleFilter: PaulNasStyleFilter;

    constructor(apiToken: string, botUsername: string) {
        this.apiToken = apiToken;
        this.botUsername = botUsername;
        this.loadOpeningBook();
        // Temporarily disable engines
        // this.stockfishEngine = new StockfishEngine();
        // this.styleFilter = new PaulNasStyleFilter();
    }

    private loadOpeningBook(): void {
        // Paul_Nas's analyzed opening repertoire from 68 games
        this.openingBook = {
            asWhite: {
                // Always play 1.d4 (100% win rate)
                moves: {
                    0: 'd4'  // Move 1 for White
                }
            },
            asBlack: {
                // Response to opponent's first move
                responses: {
                    'e4': 'e6',    // French Defense (84.6% win rate!)
                    'd4': 'd5'     // Queen's Pawn Game (63.6% win rate)
                },
                // Continuation moves based on opening type
                sequences: {
                    // French Defense sequence: 1.e4 e6 2.d4 d5
                    'e4-e6': {
                        2: 'd5'  // After 1.e4 e6 2.d4, play 2...d5
                    },
                    // Queen's Pawn: 1.d4 d5 2.c4 c6 (Caro-Kann structure)
                    'd4-d5': {
                        2: 'c6'  // After 1.d4 d5 2.c4, play 2...c6
                    }
                }
            }
        };
        console.log('📚 Opening book loaded with Paul_Nas repertoire');
    }

    private getOpeningMove(chess: Chess, moveCount: number, gameId: string): string | null {
        const gameInfo = this.activeGames.get(gameId);
        if (!gameInfo) return null;

        const { ourColor } = gameInfo;
        const history = chess.history();
        
        // Only use opening book for first 10-12 moves
        if (moveCount >= 12) return null;

        if (ourColor === 'white') {
            // Playing as White - use our repertoire
            if (moveCount === 0) {
                return this.openingBook.asWhite.moves[0]; // Always 1.d4
            }
            // For later moves as White, we'd need more complex logic
            return null;
        } else {
            // Playing as Black - respond to opponent's moves
            if (moveCount === 1) {
                // Respond to opponent's first move
                const opponentFirstMove = history[0];
                const response = this.openingBook.asBlack.responses[opponentFirstMove];
                if (response) {
                    console.log(`🎯 Paul_Nas response to ${opponentFirstMove}: ${response}`);
                    return response;
                }
            } else if (moveCount === 3) {
                // Our second move as Black
                const opponentFirst = history[0];
                const ourFirst = history[1];
                const sequenceKey = `${opponentFirst}-${ourFirst}`;
                
                if (this.openingBook.asBlack.sequences[sequenceKey]) {
                    const move = this.openingBook.asBlack.sequences[sequenceKey][2];
                    if (move) {
                        console.log(`📚 Continuing ${sequenceKey} sequence: ${move}`);
                        return move;
                    }
                }
            }
        }
        
        return null;
    }

    private async getHybridMove(chess: Chess, legalMoves: any[], moveCount: number): Promise<any> {
        // Temporarily disabled Stockfish integration - fall back to tactical analysis
        console.log('🎯 Using Paul_Nas tactical analysis (Stockfish temporarily disabled)...');
        return this.selectBestMove(legalMoves, chess, moveCount);
    }

    private async makeApiRequest(endpoint: string, method: 'GET' | 'POST' = 'GET', data?: any): Promise<any> {
        try {
            const config: any = {
                method,
                url: `https://lichess.org/api${endpoint}`,
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                },
                timeout: 10000
            };

            if (method === 'POST' && data) {
                config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
                config.data = new URLSearchParams(data).toString();
            }

            const response = await axios(config);
            return response.data;
        } catch (error: any) {
            console.error(`❌ API request failed: ${endpoint}`, error.response?.data || error.message);
            throw error;
        }
    }

    async startBot(): Promise<void> {
        console.log('🤖 Starting Simple Working Bot');
        console.log(`Bot Account: ${this.botUsername}`);
        console.log('==============================');
        
        // Test API connection
        try {
            const account = await this.makeApiRequest('/account');
            console.log(`✅ Connected as: ${account.username}`);
            console.log(`📊 Current Rating: ${account.perfs?.rapid?.rating || 'Unrated'}`);
        } catch (error) {
            console.error('❌ Failed to connect to Lichess API');
            return;
        }

        console.log('');
        console.log('🎯 Bot is now live and waiting for challenges!');
        console.log('🔄 Starting event stream...');
        
        await this.startEventStream();
    }

    private async startEventStream(): Promise<void> {
        try {
            const response = await axios({
                method: 'GET',
                url: 'https://lichess.org/api/stream/event',
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                },
                responseType: 'stream',
                timeout: 0
            });

            console.log('✅ Event stream connected!');
            console.log('👀 Listening for challenges...');

            response.data.on('data', (chunk: Buffer) => {
                const lines = chunk.toString().split('\n');
                
                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            const event = JSON.parse(line);
                            this.handleEvent(event);
                        } catch (error) {
                            // Skip invalid JSON
                        }
                    }
                }
            });

            response.data.on('error', (error: any) => {
                console.error('❌ Event stream error, reconnecting...');
                setTimeout(() => this.startEventStream(), 5000);
            });

            response.data.on('end', () => {
                console.log('⚠️ Event stream ended, reconnecting...');
                setTimeout(() => this.startEventStream(), 1000);
            });

        } catch (error) {
            console.error('❌ Failed to start event stream, retrying...');
            setTimeout(() => this.startEventStream(), 5000);
        }
    }

    private async handleEvent(event: any): Promise<void> {
        switch (event.type) {
            case 'challenge':
                await this.handleChallenge(event.challenge);
                break;
            
            case 'gameStart':
                await this.handleGameStart(event.game);
                break;
            
            case 'gameFinish':
                await this.handleGameFinish(event.game);
                break;
        }
    }

    private async handleChallenge(challenge: any): Promise<void> {
        console.log('');
        console.log('🎯 Challenge received!');
        console.log(`👤 From: ${challenge.challenger.name} (${challenge.challenger.rating || 'Unrated'})`);
        console.log(`⚡ Accepting challenge...`);
        
        try {
            await this.makeApiRequest(`/challenge/${challenge.id}/accept`, 'POST');
            console.log(`✅ Challenge accepted!`);
        } catch (error) {
            console.error(`❌ Failed to accept challenge`);
        }
    }

    private async handleGameStart(game: any): Promise<void> {
        console.log('');
        console.log('🎮 Game started!');
        console.log(`🆔 Game ID: ${game.id}`);
        console.log(`🔗 URL: https://lichess.org/${game.id}`);
        
        // Start the game stream to get the actual game data
        this.startGameStream(game.id);
    }

    private async startGameStream(gameId: string): Promise<void> {
        try {
            console.log(`📡 Starting game stream...`);

            const response = await axios({
                method: 'GET',
                url: `https://lichess.org/api/bot/game/stream/${gameId}`,
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                },
                responseType: 'stream',
                timeout: 0
            });

            response.data.on('data', (chunk: Buffer) => {
                const lines = chunk.toString().split('\n');
                
                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            const gameEvent = JSON.parse(line);
                            this.handleGameEvent(gameId, gameEvent);
                        } catch (error) {
                            // Skip invalid JSON
                        }
                    }
                }
            });

        } catch (error) {
            console.error(`❌ Failed to start game stream`);
        }
    }

    private async handleGameEvent(gameId: string, event: any): Promise<void> {
        if (event.type === 'gameFull') {
            // This is the initial game state - determine our color here
            console.log('🎯 Game full state received');
            console.log(`⚪ White: ${event.white.name}`);
            console.log(`⚫ Black: ${event.black.name}`);
            
            // Determine our color
            let ourColor: 'white' | 'black';
            if (event.white.name === this.botUsername) {
                ourColor = 'white';
                console.log(`✅ We are WHITE`);
            } else {
                ourColor = 'black';
                console.log(`✅ We are BLACK`);
            }
            
            // Initialize the game
            const chess = new Chess();
            this.activeGames.set(gameId, { chess, ourColor });
            
            // Process the initial state
            this.processGameState(gameId, event.state);
            
        } else if (event.type === 'gameState') {
            // This is a game state update
            this.processGameState(gameId, event);
        }
    }

    private async processGameState(gameId: string, state: any): Promise<void> {
        const gameInfo = this.activeGames.get(gameId);
        if (!gameInfo) return;
        
        const { chess, ourColor } = gameInfo;
        const moves = state.moves || '';
        
        // Reset and replay all moves
        chess.reset();
        if (moves) {
            const moveList = moves.split(' ').filter((m: string) => m);
            console.log(`🎯 Position: ${moveList.length} moves played`);
            
            for (const move of moveList) {
                try {
                    chess.move(move);
                } catch (error) {
                    console.error(`❌ Invalid move: ${move}`);
                    return;
                }
            }
        }
        
        // Check if it's our turn
        const isOurTurn = (chess.turn() === 'w' && ourColor === 'white') || 
                         (chess.turn() === 'b' && ourColor === 'black');
        
        console.log(`🎮 Turn: ${chess.turn() === 'w' ? 'White' : 'Black'} | We are: ${ourColor} | Our turn: ${isOurTurn ? 'YES' : 'NO'}`);
        console.log(`🎲 Game status: ${state.status}`);
        
        // Check for game end conditions
        if (state.status !== 'started') {
            this.handleGameEnd(gameId, state.status, chess);
            return;
        }
        
        // Check for chess.js end conditions (stalemate, checkmate, etc.)
        if (chess.isGameOver()) {
            const reason = chess.isCheckmate() ? 'checkmate' : 
                          chess.isStalemate() ? 'stalemate' : 
                          chess.isInsufficientMaterial() ? 'insufficient material' :
                          chess.isThreefoldRepetition() ? 'repetition' : 'draw';
            console.log(`🏁 Game over detected by chess.js: ${reason}`);
            this.handleGameEnd(gameId, reason, chess);
            return;
        }
        
        if (isOurTurn) {
            console.log(`🤔 Making our move...`);
            setTimeout(() => {
                this.makeMove(gameId, chess);
            }, 1000);
        }
    }

    private async makeMove(gameId: string, chess: Chess): Promise<void> {
        const legalMoves = chess.moves({ verbose: true });
        
        if (legalMoves.length === 0) {
            console.log('🏁 No legal moves');
            return;
        }

        try {
            let selectedMove;
            const moveCount = chess.history().length;
            
            // HYBRID APPROACH: Opening book + Stockfish + Style filtering
            const bookMove = this.getOpeningMove(chess, moveCount, gameId);
            if (bookMove) {
                // Phase 1: Use Paul_Nas opening book (moves 1-12)
                selectedMove = legalMoves.find(move => move.san === bookMove);
                if (selectedMove) {
                    console.log(`📚 Playing Paul_Nas book move: ${bookMove}`);
                } else {
                    console.log(`⚠️ Book move ${bookMove} not legal, using hybrid engine`);
                    selectedMove = await this.getHybridMove(chess, legalMoves, moveCount);
                }
            } else {
                // Phase 2: Stockfish analysis + Paul_Nas style filtering
                selectedMove = await this.getHybridMove(chess, legalMoves, moveCount);
            }

            const moveString = `${selectedMove.from}${selectedMove.to}${selectedMove.promotion || ''}`;
            console.log(`📤 Sending: ${moveString}`);
            
            await this.makeApiRequest(`/bot/game/${gameId}/move/${moveString}`, 'POST');
            console.log(`✅ Move sent!`);

        } catch (error) {
            console.error(`❌ Failed to make move:`, error);
            // Fallback to simple move selection on engine failure
            try {
                const fallbackMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
                const moveString = `${fallbackMove.from}${fallbackMove.to}${fallbackMove.promotion || ''}`;
                console.log(`🔄 Emergency fallback move: ${moveString}`);
                await this.makeApiRequest(`/bot/game/${gameId}/move/${moveString}`, 'POST');
            } catch (fallbackError) {
                console.error('❌ Even fallback move failed:', fallbackError);
            }
        }
    }

    private selectBestMove(legalMoves: any[], chess: Chess, moveCount: number): any {
        // Piece values for evaluation
        const pieceValues: { [key: string]: number } = {
            'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 0
        };

        // 1. Filter out dangerous moves (giving away valuable pieces)
        const safeMoves = legalMoves.filter(move => {
            const testChess = new Chess(chess.fen());
            testChess.move(move);
            
            // Check if this move hangs a valuable piece
            const movingPiece = move.piece;
            const isCapture = move.captured;
            
            // Don't move queen early unless it's a good capture
            if (movingPiece === 'q' && moveCount < 15 && !isCapture) {
                return false;
            }
            
            // Don't make trades that lose material
            if (isCapture) {
                const ourPieceValue = pieceValues[movingPiece] || 0;
                const capturedPieceValue = pieceValues[move.captured] || 0;
                
                // Only capture if we gain material or it's equal
                if (ourPieceValue > capturedPieceValue + 1) {
                    return false; // Bad trade
                }
            }
            
            return true;
        });

        const movesToConsider = safeMoves.length > 0 ? safeMoves : legalMoves;

        // 2. Opening phase (first 15 moves): Focus on development
        if (moveCount < 15) {
            console.log('🏰 Opening phase - focusing on development');
            
            // Prefer development moves
            const developmentMoves = movesToConsider.filter(move => {
                return (move.piece === 'n' || move.piece === 'b') && 
                       !['a1', 'a8', 'h1', 'h8'].includes(move.from);
            });
            
            if (developmentMoves.length > 0) {
                const selected = developmentMoves[Math.floor(Math.random() * developmentMoves.length)];
                console.log(`🎯 Playing development: ${selected.san}`);
                return selected;
            }
            
            // Castle if possible
            const castlingMoves = movesToConsider.filter(move => 
                move.san === 'O-O' || move.san === 'O-O-O'
            );
            if (castlingMoves.length > 0) {
                console.log(`🎯 Playing castling: ${castlingMoves[0].san}`);
                return castlingMoves[0];
            }
            
            // Central pawn moves
            const centralPawnMoves = movesToConsider.filter(move => 
                move.piece === 'p' && ['d4', 'e4', 'd5', 'e5', 'c4', 'f4'].includes(move.san)
            );
            if (centralPawnMoves.length > 0) {
                const selected = centralPawnMoves[Math.floor(Math.random() * centralPawnMoves.length)];
                console.log(`🎯 Playing central pawn: ${selected.san}`);
                return selected;
            }
        }

        // 3. Post-opening: Tactical play with good captures  
        console.log('⚔️ Post-opening phase - looking for good moves');
        
        // Good captures (win material)
        const goodCaptures = movesToConsider.filter(move => {
            if (!move.captured) return false;
            
            const ourPieceValue = pieceValues[move.piece] || 0;
            const capturedPieceValue = pieceValues[move.captured] || 0;
            
            // Only good trades
            return capturedPieceValue >= ourPieceValue;
        });
        
        if (goodCaptures.length > 0) {
            // Sort by material gain
            goodCaptures.sort((a, b) => {
                const gainA = pieceValues[a.captured] - pieceValues[a.piece];
                const gainB = pieceValues[b.captured] - pieceValues[b.piece];
                return gainB - gainA;
            });
            
            console.log(`🎯 Playing good capture: ${goodCaptures[0].san} (gain: ${pieceValues[goodCaptures[0].captured] - pieceValues[goodCaptures[0].piece]})`);
            return goodCaptures[0];
        }
        
        // Checks (if not hanging pieces)
        const checkMoves = movesToConsider.filter(move => move.san.includes('+'));
        if (checkMoves.length > 0) {
            const selected = checkMoves[Math.floor(Math.random() * checkMoves.length)];
            console.log(`🎯 Playing check: ${selected.san}`);
            return selected;
        }
        
        // Improve piece positions
        const improvementMoves = movesToConsider.filter(move => {
            // Prefer moves that don't retreat
            const isRetreat = move.to.charCodeAt(1) < move.from.charCodeAt(1) && chess.turn() === 'w';
            const isAdvance = move.to.charCodeAt(1) > move.from.charCodeAt(1) && chess.turn() === 'b';
            return !isRetreat && !isAdvance;
        });
        
        const finalMoves = improvementMoves.length > 0 ? improvementMoves : movesToConsider;
        const selected = finalMoves[Math.floor(Math.random() * finalMoves.length)];
        console.log(`🎯 Playing positional move: ${selected.san}`);
        return selected;
    }

    private handleGameEnd(gameId: string, status: string, chess: Chess): void {
        console.log('');
        console.log('🏁 GAME ENDED!');
        console.log(`🎲 Result: ${status}`);
        console.log(`🔗 View game: https://lichess.org/${gameId}`);
        
        // Get game result details
        if (chess.isCheckmate()) {
            const winner = chess.turn() === 'w' ? 'Black' : 'White';
            console.log(`♔ Checkmate! ${winner} wins!`);
        } else if (chess.isStalemate()) {
            console.log(`🤝 Stalemate! Game is a draw.`);
        } else if (chess.isInsufficientMaterial()) {
            console.log(`🤝 Draw by insufficient material.`);
        } else if (chess.isThreefoldRepetition()) {
            console.log(`🤝 Draw by threefold repetition.`);
        } else {
            console.log(`🏁 Game ended: ${status}`);
        }
        
        // Clean up
        this.activeGames.delete(gameId);
        console.log('✅ Game cleaned up.');
        console.log('👀 Ready for next challenge...');
        console.log('');
    }

    private async handleGameFinish(game: any): Promise<void> {
        console.log('');
        console.log('🏆 Game finished event received!');
        console.log(`🔗 View: https://lichess.org/${game.id}`);
        
        // Clean up if not already done
        if (this.activeGames.has(game.id)) {
            this.activeGames.delete(game.id);
            console.log('✅ Final cleanup completed.');
        }
        
        console.log('👀 Ready for next challenge...');
        console.log('');
    }

    // Cleanup method for graceful shutdown
    cleanup(): void {
        console.log('🧹 Cleaning up engines...');
        // Stockfish temporarily disabled
        // if (this.stockfishEngine) {
        //     this.stockfishEngine.quit();
        // }
    }
}

async function main(): Promise<void> {
    const apiToken = process.env.LICHESS_API_TOKEN;
    const botUsername = process.env.BOT_USERNAME;

    if (!apiToken || !botUsername) {
        console.error('❌ Missing configuration in .env file');
        process.exit(1);
    }

    const bot = new SimpleWorkingBot(apiToken, botUsername);
    
    process.on('SIGINT', () => {
        console.log('\n🛑 Bot stopping...');
        bot.cleanup();
        process.exit(0);
    });
    
    await bot.startBot();
}


if (require.main === module) {
    main();
}