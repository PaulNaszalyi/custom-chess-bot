import { ChessComExtractor } from "./src/data/chess-com-extractor";
import { LichessExtractor } from "./src/data/lichess-extractor";
import { CombinedExtractor } from "./src/data/combined-extractor";
import { AnalysisPipeline } from "./src/analysis/analysis-pipeline";

const USERNAME = "Paul_Nas";
const LICHESS_USERNAME = "paul_nas"; // Update this to your actual Lichess username

async function main() {
    try {
        console.log(`🚀 Starting Phase 1+: Combined data collection for ${USERNAME}...\n`);
        
        // Use combined extractor to get data from both platforms
        const combinedExtractor = new CombinedExtractor(USERNAME, {
            chessComUsername: USERNAME,
            lichessUsername: LICHESS_USERNAME
        });
        
        // Fetch data from both Chess.com and Lichess
        await combinedExtractor.fetchAllData({
            chessComArchives: 3,    // Limit Chess.com to last 3 archives for demo
            lichessMaxGames: 50     // Limit Lichess to last 50 games for demo
        });
        
        // Print combined summary
        combinedExtractor.printCombinedSummary();
        
        // Save combined data
        combinedExtractor.saveToFile();
        
        console.log('\n✅ Phase 1+ complete: Combined data collection finished!');
        
        // Phase 1.5: Enhanced Analysis Pipeline with Combined Data
        console.log('\n🔍 Starting enhanced analysis pipeline with combined data...');
        
        const unifiedData = combinedExtractor.getUnifiedData();
        
        // Convert unified games to format compatible with existing pipeline
        const compatibleGames = unifiedData.games.map(game => ({
            ...game,
            uuid: game.gameId,
            url: game.url || '',
            time_control: game.timeControl,
            time_class: game.timeClass || '',
            rated: game.rated,
            end_time: game.endTime ? game.endTime / 1000 : 0,
            eco: game.opening?.eco,
            opening: game.opening?.name,
            white: {
                username: game.playerColor === 'white' ? USERNAME : 'opponent',
                rating: game.playerColor === 'white' ? game.playerRating : game.opponentRating,
                result: game.gameResult === 'win' && game.playerColor === 'white' ? 'win' : 
                       game.gameResult === 'loss' && game.playerColor === 'white' ? 'lose' :
                       game.gameResult === 'draw' ? 'draw' : 'unknown',
                uuid: 'white-player'
            },
            black: {
                username: game.playerColor === 'black' ? USERNAME : 'opponent',
                rating: game.playerColor === 'black' ? game.playerRating : game.opponentRating,
                result: game.gameResult === 'win' && game.playerColor === 'black' ? 'win' : 
                       game.gameResult === 'loss' && game.playerColor === 'black' ? 'lose' :
                       game.gameResult === 'draw' ? 'draw' : 'unknown',
                uuid: 'black-player'
            },
            playerColor: game.playerColor,
            playerRating: game.playerRating,
            opponentRating: game.opponentRating,
            ratingDifference: game.ratingDifference,
            gameResult: game.gameResult,
            moveCount: game.moveCount,
            gameDuration: game.gameDurationMs
        }));
        
        const pipeline = new AnalysisPipeline(compatibleGames as any, unifiedData.profile.sources.chesscom?.stats);
        
        // Generate style profile
        pipeline.printAnalysisSummary();
        
        console.log('\n🎯 Phase 1+ Complete: Combined data collection and analysis finished!');
        console.log(`\n📊 Total games analyzed: ${unifiedData.games.length}`);
        console.log(`   ♯️ Chess.com: ${combinedExtractor.getGamesBySource('chess.com').length} games`);
        console.log(`   ♔ Lichess: ${combinedExtractor.getGamesBySource('lichess').length} games`);
        
        console.log('\n📋 Next Steps:');
        console.log('  - Phase 2: Advanced pattern analysis with combined data');
        console.log('  - Phase 3: Bot engine development using unified playing style');
        console.log('  - Phase 4: Lichess bot deployment');
        
    } catch (error) {
        console.error('❌ Error during combined data collection:', error);
    }
}

main().catch(console.error);
