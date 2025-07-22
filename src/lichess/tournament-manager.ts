import { LichessBotClient } from './lichess-bot-client';
import { BotController } from './bot-controller';
import { EventEmitter } from 'events';

export interface Tournament {
    id: string;
    name: string;
    status: 'created' | 'started' | 'finished';
    variant: string;
    speed: string;
    perf: {
        icon: string;
        name: string;
    };
    clock: {
        limit: number;
        increment: number;
    };
    minutes: number;
    createdBy: string;
    system: 'arena' | 'swiss';
    secondsToStart: number;
    nbPlayers: number;
    rated: boolean;
    fullName: string;
    private?: boolean;
    hasMaxRating?: boolean;
    maxRating?: {
        rating: number;
        perf: string;
    };
    minRating?: {
        rating: number;
        perf: string;
    };
    position?: {
        eco: string;
        fen: string;
        name: string;
    };
}

export interface TournamentStanding {
    rank: number;
    score: number;
    rating: number;
    username: string;
    title?: string;
    performance?: number;
    team?: string;
}

export interface TournamentResults {
    tournament: Tournament;
    standing: TournamentStanding;
    gamesPlayed: number;
    wins: number;
    draws: number;
    losses: number;
    performance: number;
    ratingChange: number;
    achievements: string[];
}

export interface ChallengeFilter {
    minRating: number;
    maxRating: number;
    timeControls: string[];
    variants: string[];
    rated: boolean;
    maxConcurrentChallenges: number;
    avoidPlayers: string[]; // Players to avoid challenging
    preferredPlayers: string[]; // Players to prioritize
    cooldownPeriod: number; // Minutes between challenges to same player
}

export interface ChallengeQueue {
    targetUsername: string;
    priority: number; // 1-10, higher is more priority
    timeControl: string;
    rated: boolean;
    message?: string;
    scheduledTime?: Date;
    attempts: number;
    lastAttempt?: Date;
    reason: string; // Why we want to challenge this player
}

export interface TournamentPreferences {
    autoJoin: boolean;
    ratingRange: {
        min: number;
        max: number;
    };
    timeControls: string[];
    variants: string[];
    maxTournamentsPerDay: number;
    avoidArena: boolean; // Prefer swiss tournaments
    requireRated: boolean;
    minParticipants: number;
    maxDuration: number; // Maximum tournament duration in minutes
}

export class TournamentManager extends EventEmitter {
    private lichessClient: LichessBotClient;
    private botController: BotController;
    private challengeQueue: ChallengeQueue[] = [];
    private challengeHistory: Map<string, Date[]> = new Map();
    private activeTournaments: Map<string, Tournament> = new Map();
    private challengeFilter: ChallengeFilter;
    private tournamentPreferences: TournamentPreferences;
    private isManagingChallenges: boolean = false;
    private challengeInterval: NodeJS.Timeout | null = null;

    constructor(
        lichessClient: LichessBotClient, 
        botController: BotController,
        challengeFilter: ChallengeFilter,
        tournamentPreferences: TournamentPreferences
    ) {
        super();
        this.lichessClient = lichessClient;
        this.botController = botController;
        this.challengeFilter = challengeFilter;
        this.tournamentPreferences = tournamentPreferences;
        
        this.setupEventHandlers();
    }

    private setupEventHandlers(): void {
        // Tournament events would be handled here
        // Note: Lichess bot API has limited tournament functionality
        
        this.lichessClient.on('challengeReceived', (challenge) => {
            this.evaluateIncomingChallenge(challenge);
        });

        this.lichessClient.on('gameFinished', (game) => {
            this.updateChallengeHistory(game);
        });
    }

    // Challenge Management
    public startChallengeManagement(): void {
        if (this.isManagingChallenges) {
            console.log('Challenge management already running');
            return;
        }

        console.log('🎯 Starting challenge management...');
        this.isManagingChallenges = true;
        
        // Process challenge queue every 30 seconds
        this.challengeInterval = setInterval(() => {
            this.processChallengeQueue();
        }, 30000);

        // Initial queue processing
        this.processChallengeQueue();
        
        this.emit('challengeManagementStarted');
    }

    public stopChallengeManagement(): void {
        if (!this.isManagingChallenges) return;

        console.log('🛑 Stopping challenge management...');
        this.isManagingChallenges = false;
        
        if (this.challengeInterval) {
            clearInterval(this.challengeInterval);
            this.challengeInterval = null;
        }
        
        this.emit('challengeManagementStopped');
    }

    public addChallengeToQueue(challenge: Partial<ChallengeQueue>): void {
        if (!challenge.targetUsername) {
            throw new Error('Target username is required');
        }

        // Check if player is in avoid list
        if (this.challengeFilter.avoidPlayers.includes(challenge.targetUsername)) {
            console.log(`❌ Player ${challenge.targetUsername} is in avoid list`);
            return;
        }

        // Check cooldown
        if (!this.canChallengePlayer(challenge.targetUsername)) {
            console.log(`⏳ Player ${challenge.targetUsername} is in cooldown period`);
            return;
        }

        const queueEntry: ChallengeQueue = {
            targetUsername: challenge.targetUsername,
            priority: challenge.priority || 5,
            timeControl: challenge.timeControl || '10+0',
            rated: challenge.rated !== undefined ? challenge.rated : true,
            message: challenge.message,
            scheduledTime: challenge.scheduledTime,
            attempts: 0,
            reason: challenge.reason || 'Practice game'
        };

        // Check if already in queue
        const existing = this.challengeQueue.find(c => c.targetUsername === queueEntry.targetUsername);
        if (existing) {
            console.log(`⚠️ ${queueEntry.targetUsername} already in challenge queue`);
            return;
        }

        this.challengeQueue.push(queueEntry);
        
        // Sort by priority
        this.challengeQueue.sort((a, b) => {
            if (a.priority !== b.priority) return b.priority - a.priority;
            // If same priority, prioritize preferred players
            const aPreferred = this.challengeFilter.preferredPlayers.includes(a.targetUsername);
            const bPreferred = this.challengeFilter.preferredPlayers.includes(b.targetUsername);
            if (aPreferred && !bPreferred) return -1;
            if (!aPreferred && bPreferred) return 1;
            return 0;
        });

        console.log(`➕ Added ${queueEntry.targetUsername} to challenge queue (priority: ${queueEntry.priority})`);
        this.emit('challengeQueued', queueEntry);
    }

    private async processChallengeQueue(): Promise<void> {
        if (this.challengeQueue.length === 0) return;
        
        const activeGames = this.botController.getActiveSessions().length;
        if (activeGames >= this.challengeFilter.maxConcurrentChallenges) {
            console.log(`⏸️ At maximum concurrent games (${activeGames}/${this.challengeFilter.maxConcurrentChallenges})`);
            return;
        }

        // Find next challenge to process
        const now = new Date();
        const nextChallenge = this.challengeQueue.find(challenge => {
            if (challenge.scheduledTime && challenge.scheduledTime > now) {
                return false; // Not time yet
            }
            return this.canChallengePlayer(challenge.targetUsername);
        });

        if (!nextChallenge) {
            console.log('⏳ No challenges ready to process');
            return;
        }

        try {
            await this.sendChallenge(nextChallenge);
        } catch (error) {
            console.error(`❌ Failed to send challenge to ${nextChallenge.targetUsername}:`, error);
            nextChallenge.attempts++;
            
            // Remove from queue if too many attempts
            if (nextChallenge.attempts >= 3) {
                this.challengeQueue = this.challengeQueue.filter(c => c !== nextChallenge);
                console.log(`🗑️ Removed ${nextChallenge.targetUsername} from queue after ${nextChallenge.attempts} attempts`);
            }
        }
    }

    private async sendChallenge(challenge: ChallengeQueue): Promise<void> {
        const [timeLimit, increment] = challenge.timeControl.split('+').map(Number);
        
        const challengeOptions = {
            rated: challenge.rated,
            timeLimit,
            increment: increment || 0,
            variant: 'standard' as const,
            color: 'random' as const,
            message: challenge.message
        };

        console.log(`🎯 Challenging ${challenge.targetUsername} (${challenge.timeControl}, ${challenge.rated ? 'rated' : 'casual'})`);
        
        await this.lichessClient.challengeUser(challenge.targetUsername, challengeOptions);
        
        // Update challenge tracking
        challenge.attempts++;
        challenge.lastAttempt = new Date();
        
        this.recordChallengeAttempt(challenge.targetUsername);
        
        // Remove from queue
        this.challengeQueue = this.challengeQueue.filter(c => c !== challenge);
        
        this.emit('challengeSent', challenge);
    }

    private canChallengePlayer(username: string): boolean {
        const history = this.challengeHistory.get(username);
        if (!history) return true;

        const cooldownMs = this.challengeFilter.cooldownPeriod * 60 * 1000;
        const lastChallenge = Math.max(...history.map(date => date.getTime()));
        
        return Date.now() - lastChallenge > cooldownMs;
    }

    private recordChallengeAttempt(username: string): void {
        if (!this.challengeHistory.has(username)) {
            this.challengeHistory.set(username, []);
        }
        
        const history = this.challengeHistory.get(username)!;
        history.push(new Date());
        
        // Keep only last 10 attempts
        if (history.length > 10) {
            history.shift();
        }
    }

    private evaluateIncomingChallenge(challenge: any): void {
        // Enhanced challenge evaluation beyond the basic Lichess client
        console.log(`🎯 Evaluating challenge from ${challenge.challenger.name}`);
        
        const reasons: string[] = [];
        let shouldAccept = true;
        
        // Rating checks
        if (challenge.challenger.rating < this.challengeFilter.minRating) {
            shouldAccept = false;
            reasons.push(`Rating too low (${challenge.challenger.rating} < ${this.challengeFilter.minRating})`);
        }
        
        if (challenge.challenger.rating > this.challengeFilter.maxRating) {
            shouldAccept = false;
            reasons.push(`Rating too high (${challenge.challenger.rating} > ${this.challengeFilter.maxRating})`);
        }
        
        // Time control checks
        const timeControlStr = `${Math.round(challenge.timeControl.limit / 60)}+${challenge.timeControl.increment}`;
        if (!this.challengeFilter.timeControls.includes(timeControlStr)) {
            shouldAccept = false;
            reasons.push(`Time control not supported (${timeControlStr})`);
        }
        
        // Variant checks
        if (!this.challengeFilter.variants.includes(challenge.variant.key)) {
            shouldAccept = false;
            reasons.push(`Variant not supported (${challenge.variant.key})`);
        }
        
        // Rated/unrated preference
        if (this.challengeFilter.rated && !challenge.rated) {
            shouldAccept = false;
            reasons.push('Only accepting rated games');
        }
        
        // Check avoid list
        if (this.challengeFilter.avoidPlayers.includes(challenge.challenger.name)) {
            shouldAccept = false;
            reasons.push('Player is in avoid list');
        }
        
        // Prioritize preferred players
        if (this.challengeFilter.preferredPlayers.includes(challenge.challenger.name)) {
            shouldAccept = true;
            reasons.push('Player is in preferred list');
        }

        console.log(`${shouldAccept ? '✅' : '❌'} Challenge decision: ${shouldAccept ? 'ACCEPT' : 'DECLINE'}`);
        if (reasons.length > 0) {
            console.log(`   Reasons: ${reasons.join(', ')}`);
        }
        
        this.emit('challengeEvaluated', {
            challenge,
            decision: shouldAccept,
            reasons
        });
    }

    private updateChallengeHistory(game: any): void {
        // Update our records after a game finishes
        const opponentName = game.opponent?.username;
        if (opponentName) {
            this.recordChallengeAttempt(opponentName);
        }
    }

    // Tournament Management (Limited by Lichess Bot API)
    public async joinTournament(tournamentId: string): Promise<void> {
        try {
            // Note: Lichess Bot API has limited tournament support
            // This would need to be implemented based on available endpoints
            console.log(`🏆 Attempting to join tournament ${tournamentId}`);
            
            // For now, this is a placeholder
            // await this.lichessClient.joinTournament(tournamentId);
            
            console.log(`✅ Joined tournament ${tournamentId}`);
            this.emit('tournamentJoined', tournamentId);
            
        } catch (error) {
            console.error(`❌ Failed to join tournament ${tournamentId}:`, error);
            this.emit('tournamentJoinError', { tournamentId, error });
        }
    }

    public async leaveTournament(tournamentId: string): Promise<void> {
        try {
            // Note: Limited tournament API support
            console.log(`🚪 Leaving tournament ${tournamentId}`);
            
            // await this.lichessClient.leaveTournament(tournamentId);
            
            this.activeTournaments.delete(tournamentId);
            console.log(`✅ Left tournament ${tournamentId}`);
            this.emit('tournamentLeft', tournamentId);
            
        } catch (error) {
            console.error(`❌ Failed to leave tournament ${tournamentId}:`, error);
        }
    }

    // Challenge Strategy Methods
    public generateChallengeTargets(count: number = 10): ChallengeQueue[] {
        const targets: ChallengeQueue[] = [];
        
        // Strategy 1: Target players in our rating range who we haven't played recently
        const ratingMin = this.challengeFilter.minRating;
        const ratingMax = this.challengeFilter.maxRating;
        
        // This would need to be implemented with actual player data
        // For now, create example targets
        for (let i = 0; i < count; i++) {
            const estimatedRating = ratingMin + Math.random() * (ratingMax - ratingMin);
            const priority = Math.random() < 0.3 ? 7 : 5; // 30% chance of high priority
            
            targets.push({
                targetUsername: `player_${i}_${Math.floor(estimatedRating)}`,
                priority,
                timeControl: this.selectOptimalTimeControl(),
                rated: this.challengeFilter.rated,
                reason: 'Skill development match',
                attempts: 0
            });
        }
        
        return targets;
    }

    private selectOptimalTimeControl(): string {
        const supported = this.challengeFilter.timeControls;
        if (supported.length === 0) return '10+0';
        
        // Prefer longer time controls for learning
        const preferred = ['15+10', '10+5', '10+0', '5+3'];
        for (const tc of preferred) {
            if (supported.includes(tc)) {
                return tc;
            }
        }
        
        return supported[0];
    }

    public bulkAddChallenges(targets: string[], reason: string = 'Practice'): void {
        targets.forEach((username, index) => {
            this.addChallengeToQueue({
                targetUsername: username,
                priority: 5,
                timeControl: this.selectOptimalTimeControl(),
                rated: this.challengeFilter.rated,
                reason,
                scheduledTime: new Date(Date.now() + index * 60000) // Spread out by 1 minute
            });
        });
        
        console.log(`📋 Added ${targets.length} challenges to queue`);
    }

    // Configuration Management
    public updateChallengeFilter(updates: Partial<ChallengeFilter>): void {
        this.challengeFilter = { ...this.challengeFilter, ...updates };
        console.log('🔧 Updated challenge filter');
        this.emit('filterUpdated', this.challengeFilter);
    }

    public updateTournamentPreferences(updates: Partial<TournamentPreferences>): void {
        this.tournamentPreferences = { ...this.tournamentPreferences, ...updates };
        console.log('🏆 Updated tournament preferences');
        this.emit('preferencesUpdated', this.tournamentPreferences);
    }

    // Status and Reporting
    public printStatus(): void {
        console.log('\n🎯 TOURNAMENT MANAGER STATUS');
        console.log('============================');
        
        console.log(`Challenge Management: ${this.isManagingChallenges ? '✅ Active' : '❌ Inactive'}`);
        console.log(`Challenge Queue: ${this.challengeQueue.length} pending`);
        console.log(`Challenge History: ${this.challengeHistory.size} players tracked`);
        console.log(`Active Tournaments: ${this.activeTournaments.size}`);
        
        console.log('\n⚙️ Challenge Filter:');
        console.log(`  Rating Range: ${this.challengeFilter.minRating} - ${this.challengeFilter.maxRating}`);
        console.log(`  Time Controls: ${this.challengeFilter.timeControls.join(', ')}`);
        console.log(`  Variants: ${this.challengeFilter.variants.join(', ')}`);
        console.log(`  Rated Only: ${this.challengeFilter.rated ? '✅' : '❌'}`);
        console.log(`  Max Concurrent: ${this.challengeFilter.maxConcurrentChallenges}`);
        console.log(`  Cooldown: ${this.challengeFilter.cooldownPeriod} minutes`);
        
        if (this.challengeQueue.length > 0) {
            console.log('\n📋 Challenge Queue:');
            this.challengeQueue.slice(0, 5).forEach((challenge, i) => {
                console.log(`  ${i + 1}. ${challenge.targetUsername} (priority: ${challenge.priority}) - ${challenge.reason}`);
            });
            
            if (this.challengeQueue.length > 5) {
                console.log(`  ... and ${this.challengeQueue.length - 5} more`);
            }
        }
        
        if (this.challengeFilter.preferredPlayers.length > 0) {
            console.log(`\n⭐ Preferred Players: ${this.challengeFilter.preferredPlayers.join(', ')}`);
        }
        
        if (this.challengeFilter.avoidPlayers.length > 0) {
            console.log(`\n🚫 Avoided Players: ${this.challengeFilter.avoidPlayers.join(', ')}`);
        }
    }

    public getChallengeQueue(): ChallengeQueue[] {
        return [...this.challengeQueue];
    }

    public getChallengeHistory(): Map<string, Date[]> {
        return new Map(this.challengeHistory);
    }

    public getActiveTournaments(): Tournament[] {
        return Array.from(this.activeTournaments.values());
    }

    public getChallengeFilter(): ChallengeFilter {
        return { ...this.challengeFilter };
    }

    public getTournamentPreferences(): TournamentPreferences {
        return { ...this.tournamentPreferences };
    }

    // Cleanup
    public cleanup(): void {
        this.stopChallengeManagement();
        this.challengeQueue = [];
        this.challengeHistory.clear();
        this.activeTournaments.clear();
        this.removeAllListeners();
        
        console.log('🧹 Tournament manager cleaned up');
    }
}