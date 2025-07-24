import * as dotenv from 'dotenv';
import axios from 'axios';
import { Chess } from 'chess.js';

// Load environment variables
dotenv.config();

interface Challenge {
    id: string;
    url: string;
    status: string;
    challenger: {
        id: string;
        name: string;
        title?: string;
        rating?: number;
        provisional?: boolean;
    };
    destUser: {
        id: string;
        name: string;
        title?: string;
        rating?: number;
        provisional?: boolean;
    };
    variant: {
        key: string;
        name: string;
        short: string;
    };
    rated: boolean;
    speed: string;
    timeControl: {
        type: string;
        limit?: number;
        increment?: number;
        show?: string;
    };
    color: string;
    finalColor: string;
    perf: {
        icon: string;
        name: string;
    };
}

class RealLichessBot {
    private apiToken: string;
    private botUsername: string;
    private activeGames: Map<string, Chess> = new Map();

    constructor(apiToken: string, botUsername: string) {
        this.apiToken = apiToken;
        this.botUsername = botUsername;
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
        console.log('🤖 Starting Real Lichess Bot with Event Stream...');
        console.log(`Bot Account: ${this.botUsername}`);
        console.log('==============================================');
        
        // Test API connection
        try {
            const account = await this.makeApiRequest('/account');
            console.log(`✅ Connected as: ${account.username}`);
            console.log(`📊 Current Rating: ${account.perfs?.rapid?.rating || 'Unrated'}`);
            console.log(`🤖 Bot Status: ${account.title === 'BOT' ? 'Confirmed' : 'NOT A BOT!'}`);
        } catch (error) {
            console.error('❌ Failed to connect to Lichess API');
            return;
        }

        console.log('');
        console.log('🎯 REAL BOT IS NOW LIVE!');
        console.log('');
        console.log('📋 To challenge the bot:');
        console.log(`1. Go to: https://lichess.org/@/${this.botUsername}`);
        console.log('2. Click the settings icon (⚙️) next to the username');
        console.log('3. Select "Challenge to a game"');
        console.log('4. Choose time control and send challenge');
        console.log('');
        console.log('🔄 Starting real event stream...');
        
        // Start the actual event stream
        await this.startRealEventStream();
    }

    private async startRealEventStream(): Promise<void> {
        try {
            console.log('📡 Connecting to Lichess event stream...');

            const response = await axios({
                method: 'GET',
                url: 'https://lichess.org/api/stream/event',
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                },
                responseType: 'stream',
                timeout: 0 // No timeout for streaming
            });

            console.log('✅ Event stream connected successfully!');
            console.log('👀 Listening for challenges and games...');
            console.log('');

            response.data.on('data', (chunk: Buffer) => {
                const lines = chunk.toString().split('\n');
                
                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            const event = JSON.parse(line);
                            this.handleEvent(event);
                        } catch (error) {
                            // Skip invalid JSON lines
                        }
                    }
                }
            });

            response.data.on('error', (error: any) => {
                console.error('❌ Event stream error:', error);
                setTimeout(() => {
                    console.log('🔄 Reconnecting to event stream...');
                    this.startRealEventStream();
                }, 5000);
            });

            response.data.on('end', () => {
                console.log('⚠️ Event stream ended, reconnecting...');
                setTimeout(() => {
                    this.startRealEventStream();
                }, 1000);
            });

        } catch (error) {
            console.error('❌ Failed to start event stream:', error);
            console.log('🔄 Retrying in 5 seconds...');
            setTimeout(() => {
                this.startRealEventStream();
            }, 5000);
        }
    }

    private async handleEvent(event: any): Promise<void> {
        console.log(`📨 Event received: ${event.type}`);

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
            
            default:
                console.log(`ℹ️ Unhandled event type: ${event.type}`);
        }
    }

    private async handleChallenge(challenge: Challenge): Promise<void> {
        console.log('');
        console.log('🎯 CHALLENGE RECEIVED!');
        console.log(`👤 Challenger: ${challenge.challenger.name} (${challenge.challenger.rating || 'Unrated'})`);
        console.log(`⏱️ Time Control: ${challenge.timeControl.show || 'Unknown'}`);
        console.log(`🎮 Rated: ${challenge.rated ? 'Yes' : 'No'}`);
        console.log(`🎨 Color: ${challenge.color}`);

        // Accept ALL challenges for testing
        try {
            console.log(`✅ Accepting challenge from ${challenge.challenger.name}...`);
            await this.acceptChallenge(challenge.id);
            console.log(`🎉 Challenge accepted! Game should start soon.`);
        } catch (error) {
            console.error(`❌ Failed to accept challenge:`, error);
        }
        console.log('');
    }

    private async acceptChallenge(challengeId: string): Promise<void> {
        await this.makeApiRequest(`/challenge/${challengeId}/accept`, 'POST');
    }

    private async handleGameStart(game: any): Promise<void> {
        console.log('');
        console.log('🎮 GAME STARTED!');
        console.log(`🆔 Game ID: ${game.id}`);
        console.log(`🔗 Game URL: https://lichess.org/${game.id}`);
        console.log(`⚪ White: ${game.white?.name || 'Unknown'}`);
        console.log(`⚫ Black: ${game.black?.name || 'Unknown'}`);
        console.log('');
        
        // Initialize chess board for this game
        this.activeGames.set(game.id, new Chess());
        
        // Start game stream
        this.startGameStream(game.id);
    }

    private async startGameStream(gameId: string): Promise<void> {
        try {
            console.log(`📡 Starting game stream for ${gameId}...`);

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
            console.error(`❌ Failed to start game stream for ${gameId}:`, error);
        }
    }

    private async handleGameEvent(gameId: string, event: any): Promise<void> {
        if (event.type === 'gameFull' || event.type === 'gameState') {
            const state = event.type === 'gameFull' ? event.state : event;
            const moves = state.moves;
            
            if (moves) {
                console.log(`🎯 Current position in ${gameId}: ${moves || 'Starting position'}`);
                
                // Update our chess board
                const chess = this.activeGames.get(gameId);
                if (chess) {
                    // Reset and replay all moves
                    chess.reset();
                    if (moves) {
                        const moveList = moves.split(' ');
                        for (const move of moveList) {
                            if (move) {
                                try {
                                    chess.move(move);
                                } catch (error) {
                                    console.error(`❌ Invalid move: ${move}`);
                                }
                            }
                        }
                    }
                    
                    // Check if it's our turn
                    const gameInfo = event.type === 'gameFull' ? event : await this.getGameInfo(gameId);
                    const ourColor = gameInfo?.white?.id === this.botUsername.toLowerCase() ? 'white' : 'black';
                    const isOurTurn = (chess.turn() === 'w' && ourColor === 'white') || 
                                     (chess.turn() === 'b' && ourColor === 'black');
                    
                    if (isOurTurn && state.status === 'started') {
                        console.log(`🤔 It's our turn as ${ourColor}! Thinking...`);
                        await this.makeMove(gameId, chess);
                    }
                }
            }
        }
    }

    private async getGameInfo(gameId: string): Promise<any> {
        try {
            return await this.makeApiRequest(`/bot/game/${gameId}`);
        } catch (error) {
            console.error(`❌ Failed to get game info for ${gameId}:`, error);
            return null;
        }
    }

    private async makeMove(gameId: string, chess: Chess): Promise<void> {
        try {
            // Simple move selection - get all legal moves and pick based on Paul_Nas style
            const legalMoves = chess.moves({ verbose: true });
            
            if (legalMoves.length === 0) {
                console.log('🏁 No legal moves available');
                return;
            }

            // Paul_Nas style: prefer tactical moves, captures, and d4 opening
            let selectedMove = legalMoves[0]; // Default fallback

            // Opening preference: d4 if available
            if (chess.history().length === 0) {
                const d4Move = legalMoves.find(move => move.san === 'd4');
                if (d4Move) {
                    selectedMove = d4Move;
                    console.log('🎯 Playing Paul_Nas favorite opening: d4');
                }
            } 
            // Prefer captures (tactical style)
            else {
                const captures = legalMoves.filter(move => move.captured);
                if (captures.length > 0) {
                    selectedMove = captures[Math.floor(Math.random() * captures.length)];
                    console.log(`🎯 Playing tactical capture: ${selectedMove.san}`);
                } else {
                    // Random legal move
                    selectedMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
                    console.log(`🎯 Playing move: ${selectedMove.san}`);
                }
            }

            // Make the move
            console.log(`📤 Sending move: ${selectedMove.san} (${selectedMove.from}${selectedMove.to}${selectedMove.promotion || ''})`);
            
            await this.makeApiRequest(`/bot/game/${gameId}/move/${selectedMove.from}${selectedMove.to}${selectedMove.promotion || ''}`, 'POST');
            
            console.log(`✅ Move sent successfully!`);

        } catch (error) {
            console.error(`❌ Failed to make move in ${gameId}:`, error);
        }
    }

    private async handleGameFinish(game: any): Promise<void> {
        console.log('');
        console.log('🏁 GAME FINISHED!');
        console.log(`🆔 Game: ${game.id}`);
        console.log(`🏆 Result: ${game.status}`);
        console.log(`🔗 View game: https://lichess.org/${game.id}`);
        
        // Clean up
        this.activeGames.delete(game.id);
        console.log('');
        console.log('👀 Waiting for next challenge...');
        console.log('');
    }
}

async function main(): Promise<void> {
    const apiToken = process.env.LICHESS_API_TOKEN;
    const botUsername = process.env.BOT_USERNAME;

    if (!apiToken || !botUsername) {
        console.error('❌ Missing LICHESS_API_TOKEN or BOT_USERNAME in .env file');
        process.exit(1);
    }

    const bot = new RealLichessBot(apiToken, botUsername);
    
    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down bot...');
        console.log('✅ Bot stopped gracefully');
        process.exit(0);
    });
    
    try {
        await bot.startBot();
    } catch (error) {
        console.error('❌ Bot failed to start:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}