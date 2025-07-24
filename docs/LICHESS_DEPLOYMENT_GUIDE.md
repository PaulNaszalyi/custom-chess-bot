# Lichess Bot Deployment Guide

## 🚀 Step-by-Step Setup

### Step 1: Get Lichess API Token

1. **Log in to Lichess**: Go to https://lichess.org and log in to your account
2. **Navigate to API tokens**: Go to https://lichess.org/account/oauth/token
3. **Create new token**: Click "New personal access token"
4. **Set permissions**: Select these scopes:
   - ✅ `bot:play` - Play games with the bot API
   - ✅ `challenge:read` - Read incoming challenges
   - ✅ `challenge:write` - Create challenges
   - ✅ `tournament:write` - Join tournaments
5. **Name your token**: Use a descriptive name like "PaulNas-Chess-Bot"
6. **Generate token**: Click "Generate" and **COPY THE TOKEN IMMEDIATELY**
   - ⚠️ **Important**: You can only see this token once!

### Step 2: Upgrade Account to Bot Account

1. **Convert account**: Go to https://lichess.org/api#operation/botAccountUpgrade
2. **Use curl command**: Run this in your terminal:
```bash
curl -X POST https://lichess.org/api/bot/account/upgrade \
  -H "Authorization: Bearer YOUR_API_TOKEN_HERE"
```
3. **Verify conversion**: Your account should now show as a bot account

### Step 3: Configure Bot

1. **Create .env file**: Copy `.env.example` to `.env` and add your token:
```bash
cp .env.example .env
# Edit .env with your API token and bot username
```

2. **Test connection**: Verify setup works:
```bash
npm run check-setup
```

### Step 4: Deploy and Monitor

1. **Start the bot**: Run the live bot:
```bash
npm run bot
```

2. **Monitor performance**: Watch console output for challenges and games
3. **Challenge the bot**: Visit https://lichess.org/@/Paul_Nas_Bot to play against it

---

## 🤖 Bot Configuration

**Bot Profile: Paul_Nas Style Mimicry**
- **Target Rating**: 400-600 ELO
- **Playing Style**: Tactical (79% weight), Conservative risk
- **Opening Repertoire**: d4 systems, Queen's Gambit variations
- **Challenge Acceptance**: 800-1200 rated opponents
- **Time Controls**: 10+0, 15+10 preferred
- **Concurrent Games**: Up to 3 games

---

## 🛡️ Security Notes

- **Never commit your API token**: Keep it in environment variables
- **Use .env file**: Store sensitive data securely
- **Monitor usage**: Check API rate limits
- **Bot account rules**: Follow Lichess bot guidelines

---

## 📞 Support

If you encounter issues:
1. Check Lichess bot documentation: https://lichess.org/api#tag/Bot
2. Verify API token permissions
3. Monitor console output for errors
4. Check bot account status on Lichess

---

**Ready to begin? Follow Step 1 to get your API token!**