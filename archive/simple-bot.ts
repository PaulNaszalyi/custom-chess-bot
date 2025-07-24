import * as dotenv from 'dotenv';
import { LichessBotClient } from './src/lichess/lichess-bot-client';

dotenv.config();

async function runSimpleBot() {
    const token = process.env.LICHESS_API_TOKEN!;
    const client = new LichessBotClient(token);

    console.log('🤖 Starting simple bot...');

    // Start listening for events
    await client.startEventStream();

    console.log('✅ Bot is now listening for challenges!');
    console.log('Go to Lichess and send a challenge to test');
}

runSimpleBot().catch(console.error);
