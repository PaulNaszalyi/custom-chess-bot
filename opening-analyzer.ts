import * as fs from 'fs';
import * as path from 'path';

interface GameData {
  source: string;
  gameId: string;
  url: string;
  pgn: string;
  moves: string[];
  moveCount: number;
  playerColor: 'white' | 'black';
  playerRating: number;
  opponentRating: number;
  ratingDifference: number;
  gameResult: 'win' | 'loss' | 'draw';
  timeControl: string;
  timeClass: string;
  rated: boolean;
  startTime: number;
  endTime: number;
  opening?: {
    eco?: string;
    name?: string;
  };
}

interface UnifiedData {
  profile: any;
  games: GameData[];
  summary: any;
}

interface OpeningSequence {
  moves: string[];
  movesString: string;
  games: GameData[];
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  averageRating: number;
  eco?: string;
  name?: string;
}

interface OpeningBook {
  asWhite: { [key: string]: OpeningSequence };
  asBlack: { [key: string]: OpeningSequence };
  summary: {
    totalGamesAsWhite: number;
    totalGamesAsBlack: number;
    mostPlayedAsWhite: string;
    mostPlayedAsBlack: string;
    bestWinRateAsWhite: string;
    bestWinRateAsBlack: string;
  };
}

class OpeningAnalyzer {
  private data: UnifiedData;

  constructor(dataPath: string) {
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    this.data = JSON.parse(rawData);
  }

  private extractOpeningMoves(moves: string[], maxMoves: number = 12): string[] {
    return moves.slice(0, Math.min(maxMoves, moves.length));
  }

  private movesToString(moves: string[]): string {
    const pairs: string[] = [];
    for (let i = 0; i < moves.length; i += 2) {
      const moveNumber = Math.floor(i / 2) + 1;
      const whiteMove = moves[i];
      const blackMove = moves[i + 1] || '';
      
      if (blackMove) {
        pairs.push(`${moveNumber}.${whiteMove} ${blackMove}`);
      } else {
        pairs.push(`${moveNumber}.${whiteMove}`);
      }
    }
    return pairs.join(' ');
  }

  private analyzeOpenings(games: GameData[], maxMoves: number = 12): { [key: string]: OpeningSequence } {
    const openings: { [key: string]: OpeningSequence } = {};

    for (const game of games) {
      const openingMoves = this.extractOpeningMoves(game.moves, maxMoves);
      const movesString = this.movesToString(openingMoves);

      if (!openings[movesString]) {
        openings[movesString] = {
          moves: openingMoves,
          movesString,
          games: [game],
          totalGames: 1,
          wins: game.gameResult === 'win' ? 1 : 0,
          losses: game.gameResult === 'loss' ? 1 : 0,
          draws: game.gameResult === 'draw' ? 1 : 0,
          winRate: 0,
          averageRating: game.playerRating,
          eco: game.opening?.eco,
          name: game.opening?.name
        };
      } else {
        openings[movesString].games.push(game);
        openings[movesString].totalGames++;
        openings[movesString].wins += game.gameResult === 'win' ? 1 : 0;
        openings[movesString].losses += game.gameResult === 'loss' ? 1 : 0;
        openings[movesString].draws += game.gameResult === 'draw' ? 1 : 0;
        openings[movesString].averageRating = 
          (openings[movesString].averageRating * (openings[movesString].totalGames - 1) + game.playerRating) / 
          openings[movesString].totalGames;
        
        // Keep ECO/name from first occurrence if not set
        if (!openings[movesString].eco && game.opening?.eco) {
          openings[movesString].eco = game.opening.eco;
        }
        if (!openings[movesString].name && game.opening?.name) {
          openings[movesString].name = game.opening.name;
        }
      }
    }

    // Calculate win rates
    for (const key in openings) {
      const opening = openings[key];
      opening.winRate = opening.totalGames > 0 ? (opening.wins / opening.totalGames) * 100 : 0;
    }

    return openings;
  }

  private findMostPlayed(openings: { [key: string]: OpeningSequence }): string {
    let maxGames = 0;
    let mostPlayed = '';
    
    for (const [key, opening] of Object.entries(openings)) {
      if (opening.totalGames > maxGames) {
        maxGames = opening.totalGames;
        mostPlayed = key;
      }
    }
    
    return mostPlayed;
  }

  private findBestWinRate(openings: { [key: string]: OpeningSequence }): string {
    let bestWinRate = -1;
    let bestOpening = '';
    
    for (const [key, opening] of Object.entries(openings)) {
      // Only consider openings played at least 2 times to avoid statistical noise
      if (opening.totalGames >= 2 && opening.winRate > bestWinRate) {
        bestWinRate = opening.winRate;
        bestOpening = key;
      }
    }
    
    return bestOpening;
  }

  public analyzeAllOpenings(maxMoves: number = 12): OpeningBook {
    const whiteGames = this.data.games.filter(game => game.playerColor === 'white');
    const blackGames = this.data.games.filter(game => game.playerColor === 'black');

    console.log(`\n=== Opening Analysis for Paul_Nas ===`);
    console.log(`Total games: ${this.data.games.length}`);
    console.log(`Games as White: ${whiteGames.length}`);
    console.log(`Games as Black: ${blackGames.length}`);
    console.log(`Analyzing first ${maxMoves} moves...\n`);

    const whiteOpenings = this.analyzeOpenings(whiteGames, maxMoves);
    const blackOpenings = this.analyzeOpenings(blackGames, maxMoves);

    const openingBook: OpeningBook = {
      asWhite: whiteOpenings,
      asBlack: blackOpenings,
      summary: {
        totalGamesAsWhite: whiteGames.length,
        totalGamesAsBlack: blackGames.length,
        mostPlayedAsWhite: this.findMostPlayed(whiteOpenings),
        mostPlayedAsBlack: this.findMostPlayed(blackOpenings),
        bestWinRateAsWhite: this.findBestWinRate(whiteOpenings),
        bestWinRateAsBlack: this.findBestWinRate(blackOpenings)
      }
    };

    return openingBook;
  }

  public printOpeningAnalysis(openings: { [key: string]: OpeningSequence }, color: string): void {
    console.log(`\n=== ${color.toUpperCase()} OPENINGS ===`);
    
    // Sort by frequency (most played first)
    const sortedByFrequency = Object.entries(openings)
      .sort(([, a], [, b]) => b.totalGames - a.totalGames);

    console.log(`\nMost Played Openings (by frequency):`);
    sortedByFrequency.slice(0, 10).forEach(([key, opening], index) => {
      console.log(`${index + 1}. ${opening.movesString}`);
      console.log(`   Games: ${opening.totalGames} | W:${opening.wins} L:${opening.losses} D:${opening.draws} | Win Rate: ${opening.winRate.toFixed(1)}%`);
      console.log(`   Avg Rating: ${Math.round(opening.averageRating)} | ECO: ${opening.eco || 'Unknown'}`);
      console.log('');
    });

    // Sort by win rate (minimum 2 games)
    const sortedByWinRate = Object.entries(openings)
      .filter(([, opening]) => opening.totalGames >= 2)
      .sort(([, a], [, b]) => b.winRate - a.winRate);

    console.log(`\nBest Win Rate Openings (min 2 games):`);
    sortedByWinRate.slice(0, 5).forEach(([key, opening], index) => {
      console.log(`${index + 1}. ${opening.movesString}`);
      console.log(`   Games: ${opening.totalGames} | W:${opening.wins} L:${opening.losses} D:${opening.draws} | Win Rate: ${opening.winRate.toFixed(1)}%`);
      console.log(`   Avg Rating: ${Math.round(opening.averageRating)} | ECO: ${opening.eco || 'Unknown'}`);
      console.log('');
    });
  }

  public saveOpeningBook(openingBook: OpeningBook, outputPath: string): void {
    fs.writeFileSync(outputPath, JSON.stringify(openingBook, null, 2));
    console.log(`Opening book saved to: ${outputPath}`);
  }
}

// Main execution
async function main() {
  try {
    const dataPath = path.join(__dirname, 'data', 'Paul_Nas_unified_data.json');
    const outputPath = path.join(__dirname, 'data', 'Paul_Nas_opening_book.json');

    const analyzer = new OpeningAnalyzer(dataPath);
    
    // Analyze with different move depths
    console.log('Analyzing openings with different move depths...\n');
    
    // First, analyze with 10 moves
    const openingBook10 = analyzer.analyzeAllOpenings(10);
    analyzer.printOpeningAnalysis(openingBook10.asWhite, 'White');
    analyzer.printOpeningAnalysis(openingBook10.asBlack, 'Black');
    
    // Then analyze with 12 moves for more detail
    console.log('\n' + '='.repeat(60));
    console.log('DETAILED ANALYSIS (12 moves)');
    console.log('='.repeat(60));
    
    const openingBook12 = analyzer.analyzeAllOpenings(12);
    analyzer.printOpeningAnalysis(openingBook12.asWhite, 'White (12 moves)');
    analyzer.printOpeningAnalysis(openingBook12.asBlack, 'Black (12 moves)');

    // Save the 12-move analysis as the main opening book
    analyzer.saveOpeningBook(openingBook12, outputPath);

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Most played as White: ${openingBook12.summary.mostPlayedAsWhite.substring(0, 60)}...`);
    console.log(`Most played as Black: ${openingBook12.summary.mostPlayedAsBlack.substring(0, 60)}...`);
    console.log(`Best win rate as White: ${openingBook12.summary.bestWinRateAsWhite.substring(0, 60)}...`);
    console.log(`Best win rate as Black: ${openingBook12.summary.bestWinRateAsBlack.substring(0, 60)}...`);

  } catch (error) {
    console.error('Error analyzing openings:', error);
  }
}

if (require.main === module) {
  main();
}

export { OpeningAnalyzer, OpeningBook, OpeningSequence };