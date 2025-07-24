# 🚀 Manual Bot Deployment Guide

Since the full automated deployment has some complex dependencies, here's a simple manual approach to get your bot running on Lichess.

## Step 1: Get Your Lichess Setup Ready

### 1.1 Get API Token
1. Go to: https://lichess.org/account/oauth/token
2. Click "New personal access token"
3. Select permissions: `bot:play`, `challenge:read`, `challenge:write`, `tournament:write`
4. Name: "PaulNas-Chess-Bot"
5. **Copy the token!**

### 1.2 Upgrade to Bot Account
```bash
curl -X POST https://lichess.org/api/bot/account/upgrade \
  -H "Authorization: Bearer YOUR_API_TOKEN_HERE"
```

## Step 2: Configure Your Bot

### 2.1 Create Configuration File
```bash
cp .env.example .env
```

### 2.2 Edit `.env` File
```env
LICHESS_API_TOKEN=your_actual_token_here
BOT_USERNAME=YourLichessUsername
CHALLENGE_RATING_MIN=800
CHALLENGE_RATING_MAX=1200
MAX_CONCURRENT_GAMES=3
```

## Step 3: Test Your Setup

```bash
npm run test-deployment
```

This will check:
- ✅ Environment variables are set
- ✅ Historical game data exists
- ✅ Lichess API connection works
- ✅ Bot account is properly configured

## Step 4: Simple Bot Deployment

Since the full deployment script needs some fixes, here's a simple way to test your bot:

### 4.1 Create Simple Test Script

Create `simple-bot.ts`:
```typescript
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
```

### 4.2 Run Simple Bot
```bash
npx ts-node simple-bot.ts
```

## Step 5: Full Bot Features

Once the simple version works, the full bot includes:

- **Opening Book**: Uses your historical games for opening moves
- **Style Mimicry**: Plays with Paul_Nas's tactical style
- **Adaptive Learning**: Improves from each game
- **Challenge Management**: Automatically accepts suitable challenges
- **Tournament Participation**: Joins tournaments automatically

## Troubleshooting

### API Connection Issues
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" https://lichess.org/api/account
```

Should return your account info.

### Bot Account Status
Your account page should show "BOT" badge after upgrade.

### Missing Game Data
If you need historical game data:
```bash
npm start  # Run Phase 1 data collection
```

## Next Steps

1. **Test first**: Run `npm run test-deployment`
2. **Simple bot**: Try the simple version above
3. **Full deployment**: Once simple version works, we can fix the full deployment script

Your bot will:
- Accept challenges from 800-1200 rated players
- Play with Paul_Nas's style (79% tactical preference)
- Use opening book from your 47 analyzed games
- Learn and adapt from each game

**Ready to compete! 🏆**