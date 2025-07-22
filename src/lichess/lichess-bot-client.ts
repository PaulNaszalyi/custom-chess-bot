import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { EventEmitter } from 'events';

export interface LichessGameState {
    id: string;
    variant: {
        key: string;
        name: string;
        short: string;
    };
    clock: {
        initial: number;
        increment: number;
        totalTime: number;
    };
    speed: string;
    perf: {
        name: string;
    };
    rated: boolean;
    createdAt: number;
    white: {
        id: string;
        name: string;
        title?: string;
        rating: number;
        provisional?: boolean;
    };
    black: {
        id: string;
        name: string;
        title?: string;
        rating: number;
        provisional?: boolean;
    };
    initialFen: string;
    state: {
        type: 'gameState';
        moves: string;
        wtime: number;
        btime: number;
        winc: number;
        binc: number;
        status: string;
        winner?: 'white' | 'black';
    };
}

export interface LichessGameEvent {
    type: 'gameStart' | 'gameFinish' | 'challenge' | 'challengeCanceled' | 'challengeDeclined';
    game?: {
        gameId: string;
        fullId: string;
        color: 'white' | 'black';
        fen: string;
        hasMoved: boolean;
        isMyTurn: boolean;
        lastMove?: string;
        opponent: {
            id: string;
            username: string;
            rating?: number;
        };
        perf: string;
        rated: boolean;
        secondsLeft: number;
        source: string;
        speed: string;
        variant: {
            key: string;
            name: string;
        };
    };
    challenge?: LichessChallenge;
}

export interface LichessChallenge {
    id: string;
    url: string;
    status: string;
    challenger: {
        id: string;
        name: string;
        title?: string;
        rating: number;
        provisional?: boolean;
        online?: boolean;
        lag?: number;
    };
    destUser: {
        id: string;
        name: string;
        title?: string;
        rating: number;
        provisional?: boolean;
        online?: boolean;
        lag?: number;
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
    color: 'random' | 'white' | 'black';
    perf: {
        icon: string;
        name: string;
    };
    direction: 'in' | 'out';
    initialFen?: string;
    declineReason?: string;
}

export interface BotAccount {
    id: string;
    username: string;
    online: boolean;
    playing: number;
    streaming: boolean;
    title?: string;
}

export interface GameMove {
    uci: string;
    san?: string;
}

export interface ChallengeOptions {
    rated: boolean;
    timeLimit: number; // seconds
    increment: number; // seconds
    variant: 'standard' | 'chess960' | 'kingOfTheHill' | 'threeCheck' | 'atomic' | 'antichess' | 'horde' | 'racingKings' | 'crazyhouse';
    color: 'random' | 'white' | 'black';
    message?: string;
}

export class LichessBotClient extends EventEmitter {
    private api: AxiosInstance;
    private botAccount: BotAccount | null = null;
    private activeGames: Map<string, LichessGameState> = new Map();
    private eventStream: any = null;
    private gameStreams: Map<string, any> = new Map();

    constructor(private apiToken: string) {
        super();

        this.api = axios.create({
            baseURL: 'https://lichess.org/api',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'User-Agent': 'PersonalityChessBot/1.0'
            },
            timeout: 30000
        });

        // Set up response interceptors
        this.api.interceptors.response.use(
            (response) => response,
            (error) => {
                console.error('Lichess API Error:', error.response?.data || error.message);
                this.emit('error', error);
                return Promise.reject(error);
            }
        );
    }

    // Account Management
    public async getBotAccount(): Promise<BotAccount> {
        try {
            const response = await this.api.get('/account');
            this.botAccount = response.data;
            return this.botAccount!;
        } catch (error) {
            throw new Error(`Failed to get bot account: ${error}`);
        }
    }

    public async upgradeToBotAccount(): Promise<void> {
        try {
            await this.api.post('/bot/account/upgrade');
            console.log('Account upgraded to bot account');
        } catch (error) {
            throw new Error(`Failed to upgrade to bot account: ${error}`);
        }
    }

    // Event Streaming
    public async startEventStream(): Promise<void> {
        try {
            const response = await this.api.get('/stream/event', {
                responseType: 'stream'
            });

            this.eventStream = response.data;

            this.eventStream.on('data', (chunk: Buffer) => {
                const lines = chunk.toString().split('\n');

                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            const event: LichessGameEvent = JSON.parse(line);
                            this.handleEvent(event);
                        } catch (error) {
                            console.error('Failed to parse event:', line, error);
                        }
                    }
                }
            });

            this.eventStream.on('error', (error: any) => {
                console.error('Event stream error:', error);
                this.emit('error', error);
                this.reconnectEventStream();
            });

            this.eventStream.on('end', () => {
                console.log('Event stream ended, reconnecting...');
                this.reconnectEventStream();
            });

            console.log('Event stream started');
            this.emit('streamStarted');

        } catch (error) {
            throw new Error(`Failed to start event stream: ${error}`);
        }
    }

    private reconnectEventStream(): void {
        setTimeout(() => {
            console.log('Reconnecting to event stream...');
            this.startEventStream().catch(console.error);
        }, 5000);
    }

    public stopEventStream(): void {
        if (this.eventStream) {
            this.eventStream.destroy();
            this.eventStream = null;
        }

        // Stop all game streams
        this.gameStreams.forEach(stream => stream.destroy());
        this.gameStreams.clear();
    }

    // Game Management
    public async startGameStream(gameId: string): Promise<void> {
        if (this.gameStreams.has(gameId)) {
            return; // Already streaming this game
        }

        try {
            const response = await this.api.get(`/bot/game/stream/${gameId}`, {
                responseType: 'stream'
            });

            const gameStream = response.data;
            this.gameStreams.set(gameId, gameStream);

            gameStream.on('data', (chunk: Buffer) => {
                const lines = chunk.toString().split('\n');

                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            const data = JSON.parse(line);

                            if (data.type === 'gameFull') {
                                // Initial game state
                                const gameState: LichessGameState = data;
                                this.activeGames.set(gameId, gameState);
                                this.emit('gameStart', gameState);
                            } else if (data.type === 'gameState') {
                                // Game state update
                                const existingGame = this.activeGames.get(gameId);
                                if (existingGame) {
                                    existingGame.state = data;
                                    this.emit('gameUpdate', existingGame);
                                }
                            } else if (data.type === 'chatLine') {
                                this.emit('gameChat', { gameId, chat: data });
                            }
                        } catch (error) {
                            console.error('Failed to parse game data:', line, error);
                        }
                    }
                }
            });

            gameStream.on('error', (error: any) => {
                console.error(`Game stream error for ${gameId}:`, error);
                this.emit('error', error);
                this.gameStreams.delete(gameId);
            });

            gameStream.on('end', () => {
                console.log(`Game stream ended for ${gameId}`);
                this.gameStreams.delete(gameId);
                this.activeGames.delete(gameId);
                this.emit('gameEnd', gameId);
            });

            console.log(`Game stream started for ${gameId}`);

        } catch (error) {
            throw new Error(`Failed to start game stream for ${gameId}: ${error}`);
        }
    }

    public async makeMove(gameId: string, move: GameMove): Promise<void> {
        try {
            await this.api.post(`/bot/game/${gameId}/move/${move.uci}`, {}, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            console.log(`Made move ${move.uci} in game ${gameId}`);
        } catch (error) {
            throw new Error(`Failed to make move ${move.uci} in game ${gameId}: ${error}`);
        }
    }

    public async sendGameChat(gameId: string, text: string, room: 'player' | 'spectator' = 'player'): Promise<void> {
        try {
            await this.api.post(`/bot/game/${gameId}/chat`,
                `room=${room}&text=${encodeURIComponent(text)}`,
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                }
            );
            console.log(`Sent chat message to game ${gameId}: ${text}`);
        } catch (error) {
            throw new Error(`Failed to send chat message to game ${gameId}: ${error}`);
        }
    }

    public async abortGame(gameId: string): Promise<void> {
        try {
            await this.api.post(`/bot/game/${gameId}/abort`);
            console.log(`Aborted game ${gameId}`);
        } catch (error) {
            throw new Error(`Failed to abort game ${gameId}: ${error}`);
        }
    }

    public async resignGame(gameId: string): Promise<void> {
        try {
            await this.api.post(`/bot/game/${gameId}/resign`);
            console.log(`Resigned game ${gameId}`);
        } catch (error) {
            throw new Error(`Failed to resign game ${gameId}: ${error}`);
        }
    }

    // Challenge Management
    public async acceptChallenge(challengeId: string): Promise<void> {
        try {
            await this.api.post(`/api/challenge/${challengeId}/accept`);
            console.log(`Accepted challenge ${challengeId}`);
        } catch (error) {
            throw new Error(`Failed to accept challenge ${challengeId}: ${error}`);
        }
    }

    public async declineChallenge(challengeId: string, reason?: string): Promise<void> {
        try {
            const data = reason ? { reason } : {};
            await this.api.post(`/api/challenge/${challengeId}/decline`, data);
            console.log(`Declined challenge ${challengeId}${reason ? ` (${reason})` : ''}`);
        } catch (error) {
            throw new Error(`Failed to decline challenge ${challengeId}: ${error}`);
        }
    }

    public async challengeUser(username: string, options: ChallengeOptions): Promise<{ challenge: LichessChallenge }> {
        try {
            const data = new URLSearchParams({
                rated: options.rated.toString(),
                'clock.limit': (options.timeLimit * 60).toString(), // Convert to seconds
                'clock.increment': options.increment.toString(),
                variant: options.variant,
                color: options.color
            });

            if (options.message) {
                data.append('message', options.message);
            }

            const response = await this.api.post(`/api/challenge/${username}`, data, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            return response.data;
        } catch (error) {
            throw new Error(`Failed to challenge user ${username}: ${error}`);
        }
    }

    // Event Handlers
    private handleEvent(event: LichessGameEvent): void {
        console.log('Received event:', event.type);

        switch (event.type) {
            case 'gameStart':
                if (event.game) {
                    this.startGameStream(event.game.gameId);
                }
                break;

            case 'gameFinish':
                if (event.game) {
                    this.emit('gameFinished', event.game);
                    this.activeGames.delete(event.game.gameId);
                }
                break;

            case 'challenge':
                if (event.challenge) {
                    this.emit('challengeReceived', event.challenge);
                }
                break;

            case 'challengeCanceled':
                if (event.challenge) {
                    this.emit('challengeCanceled', event.challenge);
                }
                break;

            case 'challengeDeclined':
                if (event.challenge) {
                    this.emit('challengeDeclined', event.challenge);
                }
                break;

            default:
                this.emit('unknownEvent', event);
                break;
        }

        // Emit generic event
        this.emit('event', event);
    }

    // Utility Methods
    public getActiveGames(): Map<string, LichessGameState> {
        return new Map(this.activeGames);
    }

    public getGame(gameId: string): LichessGameState | undefined {
        return this.activeGames.get(gameId);
    }

    public isInGame(gameId: string): boolean {
        return this.activeGames.has(gameId);
    }

    public isConnected(): boolean {
        return this.eventStream !== null;
    }

    // Challenge Decision Logic
    public shouldAcceptChallenge(challenge: LichessChallenge): { accept: boolean; reason?: string } {
        // Basic challenge acceptance logic - can be customized

        // Only accept standard chess
        if (challenge.variant.key !== 'standard') {
            return { accept: false, reason: 'Only standard chess supported' };
        }

        // Only accept rated games in certain rating ranges
        if (challenge.rated && challenge.challenger.rating) {
            if (challenge.challenger.rating > 2000) {
                return { accept: false, reason: 'Opponent too strong' };
            }
            if (challenge.challenger.rating < 800) {
                return { accept: false, reason: 'Rating too low' };
            }
        }

        // Only accept certain time controls
        const supportedSpeeds = ['rapid', 'blitz', 'classical'];
        if (!supportedSpeeds.includes(challenge.speed)) {
            return { accept: false, reason: 'Time control not supported' };
        }

        // Check if already in too many games
        if (this.activeGames.size >= 3) {
            return { accept: false, reason: 'Already in maximum games' };
        }

        return { accept: true };
    }

    // Statistics and Monitoring
    public async getBotStats(): Promise<any> {
        try {
            const response = await this.api.get('/account');
            return {
                account: response.data,
                activeGames: this.activeGames.size,
                isStreaming: this.eventStream !== null,
                connectedSince: new Date().toISOString()
            };
        } catch (error) {
            throw new Error(`Failed to get bot stats: ${error}`);
        }
    }

    public printStatus(): void {
        console.log('\n🤖 LICHESS BOT STATUS');
        console.log('=====================');

        if (this.botAccount) {
            console.log(`Bot: ${this.botAccount.username} (${this.botAccount.id})`);
            console.log(`Online: ${this.botAccount.online ? '✅' : '❌'}`);
            console.log(`Currently Playing: ${this.botAccount.playing} games`);
        }

        console.log(`Event Stream: ${this.isConnected() ? '✅ Connected' : '❌ Disconnected'}`);
        console.log(`Active Games: ${this.activeGames.size}`);

        if (this.activeGames.size > 0) {
            console.log('\nActive Games:');
            this.activeGames.forEach((game, gameId) => {
                const opponent = game.white.id === this.botAccount?.id ? game.black : game.white;
                console.log(`  ${gameId.slice(0, 8)}: vs ${opponent.name} (${opponent.rating})`);
            });
        }
    }

    // Cleanup
    public async disconnect(): Promise<void> {
        console.log('Disconnecting Lichess bot...');

        this.stopEventStream();

        // Resign active games
        const gameIds = Array.from(this.activeGames.keys());
        for (const gameId of gameIds) {
            try {
                await this.resignGame(gameId);
            } catch (error) {
                console.error(`Failed to resign game ${gameId}:`, error);
            }
        }

        this.removeAllListeners();
        console.log('Lichess bot disconnected');
    }
}
