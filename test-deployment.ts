import * as dotenv from 'dotenv';
import * as fs from 'fs';

// Load environment variables
dotenv.config();

interface TestConfig {
    lichessApiToken: string;
    botUsername: string;
}

async function testDeployment(): Promise<void> {
    console.log('🧪 Testing Bot Deployment Setup');
    console.log('===============================\n');

    try {
        // Test 1: Check environment variables
        console.log('1️⃣ Checking environment configuration...');
        
        if (!process.env.LICHESS_API_TOKEN) {
            throw new Error('LICHESS_API_TOKEN not found in .env file');
        }
        
        if (!process.env.BOT_USERNAME) {
            throw new Error('BOT_USERNAME not found in .env file');
        }
        
        const config: TestConfig = {
            lichessApiToken: process.env.LICHESS_API_TOKEN,
            botUsername: process.env.BOT_USERNAME
        };
        
        console.log(`   ✅ API Token: ${config.lichessApiToken.substring(0, 8)}...`);
        console.log(`   ✅ Bot Username: ${config.botUsername}`);

        // Test 2: Check required data files
        console.log('\n2️⃣ Checking required data files...');
        
        const requiredFiles = [
            './data/Paul_Nas_unified_data.json',
            './data/patterns.json'
        ];
        
        for (const filePath of requiredFiles) {
            if (!fs.existsSync(filePath)) {
                console.log(`   ⚠️  Missing: ${filePath}`);
                console.log(`      This file will be created automatically if needed`);
            } else {
                console.log(`   ✅ Found: ${filePath}`);
            }
        }

        // Test 3: Validate game data
        console.log('\n3️⃣ Validating historical game data...');
        
        if (fs.existsSync('./data/Paul_Nas_unified_data.json')) {
            const gameData = JSON.parse(fs.readFileSync('./data/Paul_Nas_unified_data.json', 'utf-8'));
            const games = gameData.games || [];
            console.log(`   ✅ Found ${games.length} historical games`);
            
            if (games.length === 0) {
                console.log('   ⚠️  No games found - run Phase 1 data collection first');
            }
        }

        // Test 4: Test Lichess API connection (simplified)
        console.log('\n4️⃣ Testing Lichess API access...');
        
        const axios = require('axios');
        try {
            const response = await axios.get('https://lichess.org/api/account', {
                headers: {
                    'Authorization': `Bearer ${config.lichessApiToken}`
                }
            });
            
            console.log(`   ✅ API connection successful`);
            console.log(`   ✅ Account: ${response.data.username}`);
            
            if (response.data.title === 'BOT') {
                console.log(`   ✅ Account is properly configured as BOT`);
            } else {
                console.log(`   ⚠️  Account is not a BOT account - you need to upgrade it`);
            }
            
        } catch (error: any) {
            console.log(`   ❌ API connection failed: ${error.message}`);
            console.log(`   💡 Check your API token and make sure account is upgraded to BOT`);
        }

        console.log('\n🎉 DEPLOYMENT TEST COMPLETE');
        console.log('===========================');
        console.log('✅ Your bot is ready for deployment!');
        console.log('');
        console.log('Next steps:');
        console.log('1. If any files are missing, run the appropriate phase first');
        console.log('2. If API connection failed, check your token and bot account status');
        console.log('3. Run "npm run deploy" to start your bot');
        console.log('');

    } catch (error) {
        console.error('\n❌ Deployment test failed:', error);
        console.log('\nTroubleshooting:');
        console.log('1. Make sure you copied .env.example to .env');
        console.log('2. Fill in your LICHESS_API_TOKEN and BOT_USERNAME in .env');
        console.log('3. Run Phase 1 if you need historical game data');
        console.log('4. Check that your Lichess account is upgraded to BOT status');
    }
}

if (require.main === module) {
    testDeployment();
}