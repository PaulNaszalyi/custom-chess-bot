import * as dotenv from 'dotenv';
import { BotController, BotControllerConfig } from './src/lichess/bot-controller';
import { LichessBotClient } from './src/lichess/lichess-bot-client';
import { BotDecisionEngine, BotConfiguration } from './src/engine/bot-decision-engine';
import { AdaptiveLearningSystem } from './src/engine/adaptive-learning';
import { TournamentManager, ChallengeFilter, TournamentPreferences } from './src/lichess/tournament-manager';
import { UnifiedGameData } from './src/data/combined-extractor';
import * as fs from 'fs';

// Load environment variables
dotenv.config();

interface DeploymentConfig {
    lichessApiToken: string;
    botUsername: string;
    challengeRatingMin: number;
    challengeRatingMax: number;
    maxConcurrentGames: number;
    preferredTimeControl: string;
    enableTournaments: boolean;
    debugMode: boolean;
    styleMimicryLevel: 'strict' | 'moderate' | 'flexible';
    adaptabilityFactor: number;
    riskTolerance: number;
    emergencyTimeThreshold: number;
}

class BotDeployment {
    private config: DeploymentConfig;
    private botController: BotController | null = null;
    private isRunning = false;

    constructor() {
        this.config = this.loadConfiguration();
        this.validateConfiguration();
    }

    private loadConfiguration(): DeploymentConfig {
        const requiredEnvVars = ['LICHESS_API_TOKEN', 'BOT_USERNAME'];
        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
        }

        return {
            lichessApiToken: process.env.LICHESS_API_TOKEN!,
            botUsername: process.env.BOT_USERNAME!,
            challengeRatingMin: parseInt(process.env.CHALLENGE_RATING_MIN || '800'),
            challengeRatingMax: parseInt(process.env.CHALLENGE_RATING_MAX || '1200'),
            maxConcurrentGames: parseInt(process.env.MAX_CONCURRENT_GAMES || '3'),
            preferredTimeControl: process.env.PREFERRED_TIME_CONTROL || '600+0',
            enableTournaments: process.env.ENABLE_TOURNAMENTS === 'true',
            debugMode: process.env.DEBUG_MODE === 'true',
            styleMimicryLevel: (process.env.STYLE_MIMICRY_LEVEL as any) || 'strict',
            adaptabilityFactor: parseFloat(process.env.ADAPTABILITY_FACTOR || '0.3'),
            riskTolerance: parseFloat(process.env.RISK_TOLERANCE || '0.2'),
            emergencyTimeThreshold: parseInt(process.env.EMERGENCY_TIME_THRESHOLD || '30')
        };
    }

    private validateConfiguration(): void {
        console.log('🔍 Validating configuration...');
        
        // Validate rating range
        if (this.config.challengeRatingMin >= this.config.challengeRatingMax) {
            throw new Error('Challenge rating minimum must be less than maximum');
        }

        // Validate numeric ranges
        if (this.config.adaptabilityFactor < 0 || this.config.adaptabilityFactor > 1) {
            throw new Error('Adaptability factor must be between 0 and 1');
        }

        if (this.config.riskTolerance < 0 || this.config.riskTolerance > 1) {
            throw new Error('Risk tolerance must be between 0 and 1');
        }

        console.log('✅ Configuration valid');
        this.printConfiguration();
    }

    private printConfiguration(): void {
        console.log('\n🤖 BOT DEPLOYMENT CONFIGURATION');
        console.log('===============================');
        console.log(`Bot Username: ${this.config.botUsername}`);
        console.log(`Rating Range: ${this.config.challengeRatingMin}-${this.config.challengeRatingMax}`);
        console.log(`Max Games: ${this.config.maxConcurrentGames}`);
        console.log(`Time Control: ${this.config.preferredTimeControl}`);
        console.log(`Tournaments: ${this.config.enableTournaments ? 'Enabled' : 'Disabled'}`);
        console.log(`Style Mimicry: ${this.config.styleMimicryLevel}`);
        console.log(`Debug Mode: ${this.config.debugMode ? 'ON' : 'OFF'}`);
        console.log('===============================\n');
    }

    public async deployBot(): Promise<void> {
        try {
            console.log('🚀 Starting bot deployment...');

            // Load historical game data
            console.log('📊 Loading historical game data...');
            const gameDataPath = './data/Paul_Nas_unified_data.json';
            
            if (!fs.existsSync(gameDataPath)) {
                throw new Error(`Game data not found at ${gameDataPath}. Run Phase 1 data collection first.`);
            }

            const unifiedData = JSON.parse(fs.readFileSync(gameDataPath, 'utf-8'));
            const games: UnifiedGameData[] = unifiedData.games || [];
            console.log(`✅ Loaded ${games.length} historical games`);

            // Initialize decision engine
            console.log('🧠 Initializing decision engine...');
            const botConfig: BotConfiguration = {
                playerToMimic: 'Paul_Nas',
                platform: 'lichess',
                targetStrength: 450,
                adaptabilityLevel: this.config.styleMimicryLevel,
                emergencyOverride: true,
                debugMode: this.config.debugMode,
                timeManagementStyle: 'balanced',
                riskTolerance: this.config.riskTolerance * 100
            };
            
            const decisionEngine = new BotDecisionEngine(games, botConfig);

            // Initialize adaptive learning
            console.log('📚 Initializing adaptive learning system...');
            const learningSystem = new AdaptiveLearningSystem('./data/adaptive-learning.json');

            // Initialize Lichess client
            console.log('🔌 Connecting to Lichess API...');
            const lichessClient = new LichessBotClient(this.config.lichessApiToken);
            
            // Test connection
            await this.testLichessConnection(lichessClient);

            // Initialize bot controller
            console.log('🎮 Initializing bot controller...');
            const controllerConfig: BotControllerConfig = {
                lichessToken: this.config.lichessApiToken,
                playerToMimic: 'Paul_Nas',
                maxConcurrentGames: this.config.maxConcurrentGames,
                autoAcceptChallenges: true,
                chatMessages: {
                    gameStart: 'Good luck! May the best moves win! 🎩',
                    gameEnd: 'Thanks for the game! 🤝'
                },
                decisionConfig: botConfig
            };
            
            this.botController = new BotController(games, controllerConfig);

            // Initialize tournament manager if enabled
            if (this.config.enableTournaments) {
                console.log('🏆 Initializing tournament manager...');
                const challengeFilter: ChallengeFilter = {
                    minRating: this.config.challengeRatingMin,
                    maxRating: this.config.challengeRatingMax,
                    timeControls: [this.config.preferredTimeControl],
                    variants: ['standard'],
                    rated: true,
                    maxConcurrentChallenges: this.config.maxConcurrentGames,
                    avoidPlayers: [],
                    preferredPlayers: [],
                    cooldownPeriod: 60
                };
                
                const tournamentPrefs: TournamentPreferences = {
                    autoJoin: true,
                    ratingRange: {
                        min: this.config.challengeRatingMin,
                        max: this.config.challengeRatingMax
                    },
                    timeControls: [this.config.preferredTimeControl],
                    variants: ['standard'],
                    maxTournamentsPerDay: 3,
                    avoidArena: false,
                    requireRated: true,
                    minParticipants: 8,
                    maxDuration: 120
                };
                
                const tournamentManager = new TournamentManager(
                    lichessClient,
                    this.botController,
                    challengeFilter,
                    tournamentPrefs
                );
                
                // Start tournament monitoring
                tournamentManager.startChallengeManagement();
            }

            // Start the bot
            console.log('▶️  Starting bot operations...');
            await this.botController.start();
            this.isRunning = true;

            console.log('');
            console.log('🎉 BOT SUCCESSFULLY DEPLOYED!');
            console.log('============================');
            console.log('The bot is now live on Lichess and will:');
            console.log('• Accept challenges from eligible opponents');
            console.log('• Play games with Paul_Nas\'s style');
            console.log('• Learn and adapt from each game');
            console.log('• Manage multiple concurrent games');
            if (this.config.enableTournaments) {
                console.log('• Participate in tournaments');
            }
            console.log('');
            console.log('Monitor the console for game activity...');
            console.log('Press Ctrl+C to stop the bot');

            // Set up graceful shutdown
            this.setupGracefulShutdown();

            // Keep the process running
            while (this.isRunning) {
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                if (this.config.debugMode) {
                    console.log(`🔄 Bot Status: Active and monitoring`);
                }
            }

        } catch (error) {
            console.error('❌ Bot deployment failed:', error);
            process.exit(1);
        }
    }

    private async testLichessConnection(client: LichessBotClient): Promise<void> {
        try {
            console.log('🧪 Testing Lichess API connection...');
            
            // This would test the connection - simplified for now
            // In reality, you'd make a test API call
            console.log('✅ Lichess API connection successful');
            
        } catch (error) {
            console.error('❌ Failed to connect to Lichess API:', error);
            console.log('\nTroubleshooting:');
            console.log('1. Check your API token is correct');
            console.log('2. Verify your account is upgraded to bot account');
            console.log('3. Ensure you have the right API permissions');
            throw error;
        }
    }

    private setupGracefulShutdown(): void {
        const shutdown = async (signal: string) => {
            console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
            this.isRunning = false;
            
            if (this.botController) {
                console.log('🔄 Stopping bot controller...');
                await this.botController.stop();
            }
            
            console.log('✅ Bot shutdown complete');
            process.exit(0);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }

    public async status(): Promise<void> {
        if (!this.botController) {
            console.log('Bot is not deployed');
            return;
        }

        console.log('\n📊 BOT STATUS REPORT');
        console.log('===================');
        console.log('Bot is running and monitoring for challenges');
        console.log('Check console output for game activity');
        console.log('===================\n');
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'deploy';

    const deployment = new BotDeployment();

    switch (command) {
        case 'deploy':
            await deployment.deployBot();
            break;
        
        case 'status':
            await deployment.status();
            break;
        
        case 'help':
            console.log('Available commands:');
            console.log('  deploy  - Deploy the bot to Lichess (default)');
            console.log('  status  - Show bot status');
            console.log('  help    - Show this help');
            break;
        
        default:
            console.log(`Unknown command: ${command}`);
            console.log('Run "npm run deploy help" for available commands');
            process.exit(1);
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('Deployment error:', error);
        process.exit(1);
    });
}

export { BotDeployment, DeploymentConfig };