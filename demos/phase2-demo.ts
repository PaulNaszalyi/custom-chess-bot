import fs from 'fs';
import { UnifiedGameData } from './src/data/combined-extractor';
import { AdvancedPatternRecognizer } from './src/analysis/pattern-recognizer';
import { CrossPlatformAnalyzer } from './src/analysis/cross-platform-analyzer';
import { StyleMimicryEngine } from './src/analysis/style-mimicry';
import { BotDecisionEngine, BotConfiguration, GameState } from './src/engine/bot-decision-engine';
import { PositionEvaluator } from './src/engine/position-evaluator';

async function runPhase2Demo() {
    console.log('🚀 PHASE 2 CHESS BOT DEMO');
    console.log('========================');
    console.log('Advanced Pattern Recognition & Bot Decision Engine');
    
    // Load unified game data
    console.log('\n📂 Loading game data...');
    const dataPath = './data/Paul_Nas_unified_data.json';
    
    if (!fs.existsSync(dataPath)) {
        console.error(`❌ Data file not found: ${dataPath}`);
        console.log('Please run Phase 1 data collection first.');
        return;
    }
    
    const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    const games: UnifiedGameData[] = rawData.games || [];
    
    if (games.length === 0) {
        console.error('❌ No games found in data file.');
        return;
    }
    
    console.log(`✅ Loaded ${games.length} games for analysis`);

    // Initialize analyzers
    console.log('\n🔍 Phase 2.1: Advanced Pattern Recognition');
    console.log('==========================================');
    
    const patternRecognizer = new AdvancedPatternRecognizer(games);
    const patterns = patternRecognizer.analyzeAdvancedPatterns();
    const styleProfile = patternRecognizer.buildPlayerStyleProfile();
    
    console.log(`✅ Identified ${patterns.size} advanced patterns`);
    console.log(`📊 Playing Strength: ${styleProfile.playingStrength}`);
    console.log(`🎯 Playing Style: ${styleProfile.preferences.openings.asWhite[0]?.name || 'Various'}`);
    console.log(`📈 Consistency: ${styleProfile.consistency}%`);
    console.log(`⚡ Improvement Rate: ${styleProfile.improvementRate > 0 ? '+' : ''}${styleProfile.improvementRate} points`);

    // Cross-platform analysis
    console.log('\n🌐 Phase 2.2: Cross-Platform Analysis');
    console.log('=====================================');
    
    const crossPlatformAnalyzer = new CrossPlatformAnalyzer(games);
    crossPlatformAnalyzer.printCrossPlatformAnalysis();
    const crossPlatformInsights = crossPlatformAnalyzer.getCrossPlatformInsights();

    // Style mimicry engine
    console.log('\n🎭 Phase 2.3: Style Mimicry Engine');
    console.log('==================================');
    
    const styleMimicryEngine = new StyleMimicryEngine(games, patterns, styleProfile, crossPlatformInsights);
    const mimicryProfile = styleMimicryEngine.buildMimicryProfile();
    
    console.log(`🤖 Bot Identity: ${mimicryProfile.playerIdentity.playingStyle} player`);
    console.log(`⚔️ Tactical Weight: ${mimicryProfile.decisionFactors.tacticalWeight}%`);
    console.log(`🏰 Positional Weight: ${mimicryProfile.decisionFactors.positionalWeight}%`);
    console.log(`🎲 Risk Tolerance: ${mimicryProfile.decisionFactors.riskTolerance}%`);
    
    console.log(`\n🚫 Avoidance Patterns:`);
    mimicryProfile.avoidancePatterns.blunderTypes.slice(0, 3).forEach((blunder, i) => {
        console.log(`  ${i + 1}. ${blunder.pattern} (${blunder.avoidanceStrength}% avoidance)`);
    });

    // Bot decision engine
    console.log('\n🤖 Phase 2.4: Bot Decision Engine');
    console.log('=================================');
    
    const botConfig: BotConfiguration = {
        playerToMimic: 'Paul_Nas',
        platform: 'chess.com',
        targetStrength: styleProfile.playingStrength,
        adaptabilityLevel: 'moderate',
        emergencyOverride: true,
        debugMode: true,
        timeManagementStyle: 'balanced',
        riskTolerance: mimicryProfile.decisionFactors.riskTolerance
    };
    
    const decisionEngine = new BotDecisionEngine(games, botConfig);
    decisionEngine.printEngineStatus();

    // Position evaluation system
    console.log('\n📊 Phase 2.5: Position Evaluation System');
    console.log('========================================');
    
    const positionEvaluator = new PositionEvaluator();
    
    // Demo position evaluation
    console.log('\n🎯 Sample Position Evaluation:');
    const samplePosition = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    const evaluation = positionEvaluator.evaluatePosition(samplePosition, ['e4'], 'white');
    
    console.log(`Score: ${evaluation.totalScore > 0 ? '+' : ''}${evaluation.totalScore / 100} pawns`);
    console.log(`Game Phase: ${evaluation.gamePhase}`);
    console.log(`Confidence: ${evaluation.confidence}%`);
    if (evaluation.explanation.length > 0) {
        console.log(`Explanation: ${evaluation.explanation[0]}`);
    }

    // Demo move evaluation
    console.log('\n♟️ Sample Move Scoring:');
    const sampleMoves = ['Nf3', 'd4', 'Bc4', 'Qh5'];
    const moveScores = positionEvaluator.compareMoves(sampleMoves, samplePosition, ['e4'], 'white');
    
    moveScores.slice(0, 3).forEach((moveScore, i) => {
        console.log(`  ${i + 1}. ${moveScore.move}: ${moveScore.improvementScore > 0 ? '+' : ''}${Math.round(moveScore.improvementScore)} cp`);
        console.log(`     Category: ${moveScore.category}, Risk: ${moveScore.risk}%, Time: ${moveScore.timeRecommended}s`);
    });

    // Simulate a game decision
    console.log('\n🎮 Phase 2.6: Game Decision Simulation');
    console.log('=====================================');
    
    const gameState: GameState = {
        position: samplePosition,
        moveHistory: ['e4'],
        currentPlayer: 'black',
        gamePhase: 'opening',
        timeRemaining: { white: 600, black: 600 },
        evaluation: -25, // Slightly worse for black after e4
        threats: [],
        opportunities: ['Center control', 'Development'],
        availableMoves: ['e5', 'd6', 'Nf6', 'c5', 'e6']
    };

    try {
        const decision = await decisionEngine.makeMove(gameState);
        
        console.log(`🎯 Selected Move: ${decision.selectedMove}`);
        console.log(`🎪 Confidence: ${decision.confidence}%`);
        console.log(`⏱️ Thinking Time: ${decision.timeToThink}s`);
        console.log(`⚠️ Risk Level: ${decision.riskAssessment}`);
        console.log(`🎭 Style Alignment: ${decision.styleAlignment}%`);
        
        console.log('\n💭 Bot Reasoning:');
        decision.reasoning.slice(0, 3).forEach((reason, i) => {
            console.log(`  ${i + 1}. ${reason}`);
        });
        
        if (decision.alternativeMoves.length > 0) {
            console.log('\n🔄 Alternative Moves:');
            decision.alternativeMoves.forEach((alt, i) => {
                console.log(`  ${i + 1}. ${alt.move} (${alt.score}%): ${alt.reason}`);
            });
        }

        if (decision.emergencyOverride?.activated) {
            console.log(`\n⚡ Emergency Override: ${decision.emergencyOverride.reason}`);
        }

    } catch (error) {
        console.error('❌ Error in decision making:', error);
    }

    // Performance summary
    console.log('\n📈 Phase 2 Implementation Summary');
    console.log('=================================');
    
    console.log('✅ Advanced Pattern Recognition System');
    console.log('  - Multi-category pattern analysis (tactical, positional, strategic)');
    console.log('  - Cross-game pattern correlation and confidence scoring');
    console.log('  - Player style profiling with evolution tracking');
    
    console.log('\n✅ Cross-Platform Analysis Engine');
    console.log('  - Chess.com vs Lichess performance comparison');
    console.log('  - Platform-specific adaptation recommendations');
    console.log('  - Tactical and strategic difference identification');
    
    console.log('\n✅ Style Mimicry Algorithms');
    console.log('  - Detailed player decision factor modeling');
    console.log('  - Move preference mapping by game phase');
    console.log('  - Avoidance pattern and emergency protocol systems');
    
    console.log('\n✅ Unified Bot Decision Engine');
    console.log('  - Intelligent move selection with style mimicry');
    console.log('  - Configurable adaptability and emergency overrides');
    console.log('  - Performance tracking and continuous adaptation');
    
    console.log('\n✅ Advanced Position Evaluation');
    console.log('  - Multi-factor position assessment');
    console.log('  - Move scoring with tactical and positional merit');
    console.log('  - Risk assessment and complexity analysis');

    console.log('\n🎯 Next Steps: Phase 3 - Bot Intelligence Development');
    console.log('- Implement UCI-compatible chess engine interface');
    console.log('- Add real chess position parsing and move generation');  
    console.log('- Integrate with actual chess evaluation engines');
    console.log('- Build comprehensive opening book from analyzed games');
    console.log('- Develop adaptive learning from bot\'s own game results');

    console.log('\n✨ Phase 2 Complete! Advanced analysis systems ready for bot deployment.');
}

// Run the demo
if (require.main === module) {
    runPhase2Demo().catch(console.error);
}

export { runPhase2Demo };