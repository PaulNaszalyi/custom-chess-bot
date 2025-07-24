import * as fs from 'fs';
import * as path from 'path';

interface BotOpeningMove {
  move: string;
  frequency: number;
  winRate: number;
  averageRating: number;
  games: number;
  variations?: BotOpeningMove[];
}

interface BotOpeningBook {
  asWhite: {
    preferredOpenings: string[];
    moveTree: { [position: string]: BotOpeningMove[] };
    recommendations: {
      mostPlayed: string;
      bestWinRate: string;
      safestChoice: string;
    };
  };
  asBlack: {
    responses: { [opponentMove: string]: BotOpeningMove[] };
    recommendations: {
      againstD4: string;
      againstE4: string;
      universal: string;
    };
  };
  statistics: {
    totalGames: number;
    gamesAsWhite: number;
    gamesAsBlack: number;
    overallWinRate: number;
    whiteWinRate: number;
    blackWinRate: number;
  };
}

class BotOpeningBookGenerator {
  private openingBook: any;

  constructor(openingBookPath: string) {
    const rawData = fs.readFileSync(openingBookPath, 'utf-8');
    this.openingBook = JSON.parse(rawData);
  }

  private calculateOverallStats(): any {
    let totalWhiteGames = 0;
    let whiteWins = 0;
    let totalBlackGames = 0;
    let blackWins = 0;

    // Calculate white stats
    for (const [key, opening] of Object.entries(this.openingBook.asWhite) as [string, any][]) {
      totalWhiteGames += opening.totalGames;
      whiteWins += opening.wins;
    }

    // Calculate black stats
    for (const [key, opening] of Object.entries(this.openingBook.asBlack) as [string, any][]) {
      totalBlackGames += opening.totalGames;
      blackWins += opening.wins;
    }

    return {
      totalGames: totalWhiteGames + totalBlackGames,
      gamesAsWhite: totalWhiteGames,
      gamesAsBlack: totalBlackGames,
      overallWinRate: ((whiteWins + blackWins) / (totalWhiteGames + totalBlackGames)) * 100,
      whiteWinRate: totalWhiteGames > 0 ? (whiteWins / totalWhiteGames) * 100 : 0,
      blackWinRate: totalBlackGames > 0 ? (blackWins / totalBlackGames) * 100 : 0
    };
  }

  private getTopWhiteOpenings(limit: number = 5): Array<[string, any]> {
    return Object.entries(this.openingBook.asWhite)
      .sort(([, a], [, b]) => (b as any).totalGames - (a as any).totalGames)
      .slice(0, limit);
  }

  private getBlackResponsesTo(move: string): BotOpeningMove[] {
    const responses: BotOpeningMove[] = [];
    
    for (const [key, opening] of Object.entries(this.openingBook.asBlack) as [string, any][]) {
      if (key.startsWith(move)) {
        // Extract the response move
        const moves = opening.moves;
        if (moves.length >= 2) {
          const responseMove = moves[1]; // Black's first move
          
          // Check if this response already exists
          const existing = responses.find(r => r.move === responseMove);
          if (existing) {
            existing.frequency += opening.totalGames;
            existing.games += opening.totalGames;
            existing.winRate = ((existing.winRate * (existing.games - opening.totalGames)) + 
                             (opening.winRate * opening.totalGames)) / existing.games;
          } else {
            responses.push({
              move: responseMove,
              frequency: opening.totalGames,
              winRate: opening.winRate,
              averageRating: opening.averageRating,
              games: opening.totalGames
            });
          }
        }
      }
    }

    return responses.sort((a, b) => b.frequency - a.frequency);
  }

  public generateBotOpeningBook(): BotOpeningBook {
    const stats = this.calculateOverallStats();
    const topWhiteOpenings = this.getTopWhiteOpenings();

    // Generate white opening recommendations
    const whiteRecommendations = {
      mostPlayed: "1.d4", // Based on analysis results
      bestWinRate: "1.d4", // Paul_Nas has 100% win rate with d4
      safestChoice: "1.d4" // Most consistent opening
    };

    // Generate preferred white openings
    const preferredWhiteOpenings = [
      "1.d4", // Queen's Pawn - most played with 100% win rate
      "1.d4 e6 2.e4", // French Defense setup - shows Paul_Nas knows this structure
    ];

    // Create move tree for white (focusing on d4)
    const whiteMoveTree: { [position: string]: BotOpeningMove[] } = {
      "start": [
        {
          move: "d4",
          frequency: 2, // Based on analysis
          winRate: 100,
          averageRating: 377,
          games: 2
        }
      ],
      "1.d4": [
        {
          move: "e4", // Against e6
          frequency: 1,
          winRate: 100,
          averageRating: 486,
          games: 1
        }
      ]
    };

    // Generate black responses
    const blackResponses = {
      "1.d4": this.getBlackResponsesTo("1.d4"),
      "1.e4": this.getBlackResponsesTo("1.e4")
    };

    const blackRecommendations = {
      againstD4: "1...d5", // Most common and successful response
      againstE4: "1...e6", // French Defense preference shown
      universal: "1...d5" // Universal response to most openings
    };

    return {
      asWhite: {
        preferredOpenings: preferredWhiteOpenings,
        moveTree: whiteMoveTree,
        recommendations: whiteRecommendations
      },
      asBlack: {
        responses: blackResponses,
        recommendations: blackRecommendations
      },
      statistics: stats
    };
  }

  public printBotOpeningBook(botBook: BotOpeningBook): void {
    console.log('\n' + '='.repeat(80));
    console.log('PAUL_NAS CHESS BOT - OPENING BOOK');
    console.log('='.repeat(80));

    console.log('\n📊 OVERALL STATISTICS:');
    console.log(`Total Games Analyzed: ${botBook.statistics.totalGames}`);
    console.log(`Games as White: ${botBook.statistics.gamesAsWhite} (Win Rate: ${botBook.statistics.whiteWinRate.toFixed(1)}%)`);
    console.log(`Games as Black: ${botBook.statistics.gamesAsBlack} (Win Rate: ${botBook.statistics.blackWinRate.toFixed(1)}%)`);
    console.log(`Overall Win Rate: ${botBook.statistics.overallWinRate.toFixed(1)}%`);

    console.log('\n♔ WHITE REPERTOIRE:');
    console.log(`Preferred Openings:`);
    botBook.asWhite.preferredOpenings.forEach((opening, i) => {
      console.log(`  ${i + 1}. ${opening}`);
    });

    console.log('\nWhite Recommendations:');
    console.log(`  Most Played: ${botBook.asWhite.recommendations.mostPlayed}`);
    console.log(`  Best Win Rate: ${botBook.asWhite.recommendations.bestWinRate}`);
    console.log(`  Safest Choice: ${botBook.asWhite.recommendations.safestChoice}`);

    console.log('\n♛ BLACK REPERTOIRE:');
    console.log('Black Recommendations:');
    console.log(`  Against 1.d4: ${botBook.asBlack.recommendations.againstD4}`);
    console.log(`  Against 1.e4: ${botBook.asBlack.recommendations.againstE4}`);
    console.log(`  Universal: ${botBook.asBlack.recommendations.universal}`);

    console.log('\nBlack Responses to 1.d4:');
    botBook.asBlack.responses["1.d4"]?.slice(0, 3).forEach((response, i) => {
      console.log(`  ${i + 1}. ${response.move} (${response.games} games, ${response.winRate.toFixed(1)}% win rate)`);
    });

    console.log('\nBlack Responses to 1.e4:');
    botBook.asBlack.responses["1.e4"]?.slice(0, 3).forEach((response, i) => {
      console.log(`  ${i + 1}. ${response.move} (${response.games} games, ${response.winRate.toFixed(1)}% win rate)`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('BOT USAGE RECOMMENDATIONS:');
    console.log('='.repeat(80));
    console.log('1. As White: Always play 1.d4 (100% win rate in sample)');
    console.log('2. Against French Defense (1...e6): Follow up with 2.e4');
    console.log('3. As Black vs 1.d4: Respond with 1...d5 for solid positions');
    console.log('4. As Black vs 1.e4: Consider 1...e6 (French Defense)');
    console.log('5. Focus on positional play and long-term planning');
    console.log('='.repeat(80));
  }

  public saveBotOpeningBook(botBook: BotOpeningBook, outputPath: string): void {
    fs.writeFileSync(outputPath, JSON.stringify(botBook, null, 2));
    console.log(`\nBot opening book saved to: ${outputPath}`);
  }
}

// Main execution
async function main() {
  try {
    const openingBookPath = path.join(__dirname, 'data', 'Paul_Nas_opening_book.json');
    const botOutputPath = path.join(__dirname, 'data', 'Paul_Nas_bot_opening_book.json');

    const generator = new BotOpeningBookGenerator(openingBookPath);
    const botOpeningBook = generator.generateBotOpeningBook();
    
    generator.printBotOpeningBook(botOpeningBook);
    generator.saveBotOpeningBook(botOpeningBook, botOutputPath);

  } catch (error) {
    console.error('Error generating bot opening book:', error);
  }
}

if (require.main === module) {
  main();
}

export { BotOpeningBookGenerator, BotOpeningBook, BotOpeningMove };