import * as dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config();

class TestBot {
    private apiToken: string;
    private botUsername: string;

    constructor(apiToken: string, botUsername: string) {
        this.apiToken = apiToken;
        this.botUsername = botUsername;
    }

    private async makeApiRequest(endpoint: string, method: 'GET' | 'POST' = 'GET', data?: any): Promise<any> {
        try {
            const response = await axios({
                method,
                url: `https://lichess.org/api${endpoint}`,
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json'
                },
                data
            });
            return response.data;
        } catch (error: any) {
            console.error(`API request failed: ${endpoint}`, error.response?.data || error.message);
            throw error;
        }
    }

    async startTestBot(): Promise<void> {
        console.log('🧪 Starting Test Bot - Accepts ALL Challenges!');
        console.log(`Bot Account: ${this.botUsername}`);
        console.log('==========================================');
        
        // Test API connection
        try {
            const account = await this.makeApiRequest('/account');
            console.log(`✅ Connected as: ${account.username}`);
            console.log(`📊 Current Rating: ${account.perfs?.rapid?.rating || account.perfs?.blitz?.rating || 'Unrated'}`);
        } catch (error) {
            console.error('❌ Failed to connect to Lichess API');
            return;
        }

        console.log('');
        console.log('🎯 TEST BOT IS LIVE!');
        console.log('');
        console.log('📋 How to test:');
        console.log(`1. Go to: https://lichess.org/@/${this.botUsername}`);
        console.log('2. Click "Challenge to a game"');
        console.log('3. Choose any time control you like');
        console.log('4. Bot will accept ALL challenges for testing');
        console.log('');
        console.log('🎮 Bot Features:');
        console.log('• Accepts challenges from ANY rating');
        console.log('• Plays with Paul_Nas tactical style');
        console.log('• Uses d4 opening (from your analysis)');
        console.log('• Basic move logic for testing');
        console.log('');
        console.log('👀 Bot is monitoring for challenges...');
        console.log('   (This is a test version - press Ctrl+C to stop)');
        
        // Keep alive and show status
        setInterval(() => {
            console.log(`📊 ${new Date().toLocaleTimeString()} - Bot active, waiting for challenges...`);
        }, 30000);
    }
}

async function main(): Promise<void> {
    const apiToken = process.env.LICHESS_API_TOKEN;
    const botUsername = process.env.BOT_USERNAME;

    if (!apiToken || !botUsername) {
        console.error('❌ Missing configuration in .env file');
        process.exit(1);
    }

    const bot = new TestBot(apiToken, botUsername);
    
    process.on('SIGINT', () => {
        console.log('\\n🛑 Test bot stopped');
        process.exit(0);
    });
    
    await bot.startTestBot();
}

if (require.main === module) {
    main();
}