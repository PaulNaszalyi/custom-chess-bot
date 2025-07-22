# 🚀 Quick Start: Deploy Your Chess Bot

## Ready in 5 Minutes! ⚡

### Step 1: Get Your Lichess API Token
1. Go to: https://lichess.org/account/oauth/token
2. Click "New personal access token"
3. Select these permissions:
   - ✅ `bot:play`
   - ✅ `challenge:read` 
   - ✅ `challenge:write`
   - ✅ `tournament:write`
4. Name it "PaulNas-Chess-Bot"
5. **Copy the token immediately!** (You can only see it once)

### Step 2: Upgrade to Bot Account
Run this command with your token:
```bash
curl -X POST https://lichess.org/api/bot/account/upgrade \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Step 3: Configure the Bot
1. Copy the example config:
```bash
cp .env.example .env
```

2. Edit `.env` file and add your details:
```env
LICHESS_API_TOKEN=your_actual_token_here
BOT_USERNAME=YourLichessUsername
```

### Step 4: Launch! 🚀
```bash
npm run deploy
```

That's it! Your bot is now live on Lichess!

---

## What Happens Next?

Your bot will:
- ✅ Accept challenges from 800-1200 rated players
- ✅ Play with Paul_Nas's exact tactical style  
- ✅ Use the opening book from analyzed games
- ✅ Learn and adapt after each game
- ✅ Handle up to 3 concurrent games

## Monitor Your Bot

```bash
# Check bot status
npm run bot-status

# View console output for game activity
# Press Ctrl+C to stop the bot
```

## Troubleshooting

**Connection Issues?**
- Verify your API token is correct
- Ensure account is upgraded to bot status
- Check API permissions

**Need Help?**
- Read `LICHESS_DEPLOYMENT_GUIDE.md` for detailed instructions
- Check console output for error messages
- Review Lichess bot documentation

---

**Your Paul_Nas style bot is ready to compete! 🏆**