import { UnifiedGameData } from '../data/combined-extractor';
import { TacticalAnalyzer, TacticalProfile } from './tactical-analyzer';
import { AdvancedPatternRecognizer, PlayerStyleProfile } from './pattern-recognizer';

export interface PlatformComparison {
    platform: 'chess.com' | 'lichess';
    gameCount: number;
    winRate: number;
    averageRating: number;
    ratingRange: { min: number; max: number };
    averageGameLength: number;
    preferredTimeControls: Array<{ timeControl: string; frequency: number }>;
    tacticalProfile: TacticalProfile;
    styleProfile: PlayerStyleProfile;
    uniquePatterns: string[];
    commonMistakes: string[];
}

export interface CrossPlatformInsights {
    platformComparisons: PlatformComparison[];
    overallTrends: {
        consistencyAcrossPlatforms: number; // 0-100
        adaptabilityScore: number; // How well player adapts to different platforms
        strengthVariation: number; // Difference in playing strength between platforms
        preferredPlatform: 'chess.com' | 'lichess' | 'neutral';
    };
    
    tacticalDifferences: {
        chessComStrengths: string[];
        lichessStrengths: string[];
        universalStrengths: string[];
        chessComWeaknesses: string[];
        lichessWeaknesses: string[];
        universalWeaknesses: string[];
    };
    
    strategicDifferences: {
        openingVariation: number; // How much opening repertoire varies between platforms
        middlegameApproach: 'consistent' | 'platform-specific' | 'varied';
        endgamePerformance: {
            chessComEndgameSkill: number;
            lichessEndgameSkill: number;
            difference: number;
        };
    };
    
    recommendations: Array<{
        category: 'improvement' | 'consistency' | 'specialization';
        priority: 'high' | 'medium' | 'low';
        description: string;
        platform: 'chess.com' | 'lichess' | 'both';
        actionItems: string[];
    }>;
    
    synergies: Array<{
        description: string;
        benefit: string;
        howToLeverage: string[];
    }>;
}

export class CrossPlatformAnalyzer {
    private allGames: UnifiedGameData[];
    private chessComGames: UnifiedGameData[];
    private lichessGames: UnifiedGameData[];

    constructor(games: UnifiedGameData[]) {
        this.allGames = games;
        this.chessComGames = games.filter(g => g.source === 'chess.com');
        this.lichessGames = games.filter(g => g.source === 'lichess');
    }

    public analyzeCrossPlatform(): CrossPlatformInsights {
        const chessComAnalysis = this.analyzePlatform('chess.com', this.chessComGames);
        const lichessAnalysis = this.analyzePlatform('lichess', this.lichessGames);
        
        return {
            platformComparisons: [chessComAnalysis, lichessAnalysis],
            overallTrends: this.analyzeOverallTrends(chessComAnalysis, lichessAnalysis),
            tacticalDifferences: this.analyzeTacticalDifferences(chessComAnalysis, lichessAnalysis),
            strategicDifferences: this.analyzeStrategicDifferences(chessComAnalysis, lichessAnalysis),
            recommendations: this.generateRecommendations(chessComAnalysis, lichessAnalysis),
            synergies: this.identifySynergies(chessComAnalysis, lichessAnalysis)
        };
    }

    private analyzePlatform(platform: 'chess.com' | 'lichess', games: UnifiedGameData[]): PlatformComparison {
        if (games.length === 0) {
            return this.createEmptyPlatformComparison(platform);
        }

        const tacticalAnalyzer = new TacticalAnalyzer(games);
        const patternRecognizer = new AdvancedPatternRecognizer(games);
        
        const tacticalProfile = tacticalAnalyzer.analyzeTacticalProfile();
        const styleProfile = patternRecognizer.buildPlayerStyleProfile();
        
        const wins = games.filter(g => g.gameResult === 'win').length;
        const ratings = games.map(g => g.playerRating || 1200);
        
        return {
            platform,
            gameCount: games.length,
            winRate: (wins / games.length) * 100,
            averageRating: ratings.reduce((sum, r) => sum + r, 0) / ratings.length,
            ratingRange: {
                min: Math.min(...ratings),
                max: Math.max(...ratings)
            },
            averageGameLength: games.reduce((sum, g) => sum + g.moves.length, 0) / games.length,
            preferredTimeControls: this.analyzeTimeControls(games),
            tacticalProfile,
            styleProfile,
            uniquePatterns: this.identifyUniquePatterns(games, platform),
            commonMistakes: this.identifyCommonMistakes(games)
        };
    }

    private createEmptyPlatformComparison(platform: 'chess.com' | 'lichess'): PlatformComparison {
        return {
            platform,
            gameCount: 0,
            winRate: 0,
            averageRating: 1500,
            ratingRange: { min: 1500, max: 1500 },
            averageGameLength: 0,
            preferredTimeControls: [],
            tacticalProfile: this.createEmptyTacticalProfile(),
            styleProfile: this.createEmptyStyleProfile(),
            uniquePatterns: [],
            commonMistakes: []
        };
    }

    private createEmptyTacticalProfile(): TacticalProfile {
        return {
            patterns: { preferred: [], avoided: [], missed: [] },
            statistics: {
                aggressiveness: 0,
                riskTaking: 0,
                tacticalAwareness: 0,
                calculationDepth: 0,
                patternRecognition: 0
            },
            tendencies: {
                sacrificeWillingness: 0,
                exchangePreference: 'balanced',
                attackingStyle: 'mixed',
                defensiveApproach: 'solid'
            },
            strengths: [],
            weaknesses: [],
            recommendations: []
        };
    }

    private createEmptyStyleProfile(): PlayerStyleProfile {
        return {
            playingStrength: 1500,
            consistency: 50,
            improvementRate: 0,
            preferences: {
                openings: {
                    asWhite: [],
                    asBlack: []
                },
                pieceActivity: {
                    knightVsBishop: 'balanced',
                    rookActivity: 'balanced',
                    queenDevelopment: 'situational'
                },
                pawnStructure: {
                    preferredFormations: [],
                    pawnStormTendency: 50,
                    pawnSacrificeTendency: 25
                }
            },
            weaknesses: {
                timeManagement: 50,
                tacticalBlindness: [],
                endgameSkill: 50,
                blunderPatterns: []
            },
            evolution: {
                ratingProgression: [],
                skillDevelopment: [],
                recentTrends: []
            }
        };
    }

    private analyzeTimeControls(games: UnifiedGameData[]): Array<{ timeControl: string; frequency: number }> {
        const timeControlCounts = new Map<string, number>();
        
        games.forEach(game => {
            const timeControl = game.timeControl || 'unknown';
            timeControlCounts.set(timeControl, (timeControlCounts.get(timeControl) || 0) + 1);
        });

        return Array.from(timeControlCounts.entries())
            .map(([timeControl, count]) => ({
                timeControl,
                frequency: (count / games.length) * 100
            }))
            .sort((a, b) => b.frequency - a.frequency);
    }

    private identifyUniquePatterns(games: UnifiedGameData[], platform: 'chess.com' | 'lichess'): string[] {
        const patterns: string[] = [];
        
        // Platform-specific pattern identification
        if (platform === 'chess.com') {
            // Analyze patterns more common on Chess.com
            const quickGames = games.filter(g => (g.timeControl || '').includes('600'));
            if (quickGames.length > games.length * 0.7) {
                patterns.push('Quick Time Control Adaptation');
            }
            
            const highAccuracyGames = games.filter(g => g.moves.length > 30);
            if (highAccuracyGames.length > games.length * 0.6) {
                patterns.push('Extended Game Stamina');
            }
        } else {
            // Lichess-specific patterns
            if (games.some(g => g.gameResult === 'win' && g.moves.length < 20)) {
                patterns.push('Quick Victory Tactics');
            }
        }

        return patterns;
    }

    private identifyCommonMistakes(games: UnifiedGameData[]): string[] {
        const mistakes: string[] = [];
        const losses = games.filter(g => g.gameResult === 'loss');
        
        if (losses.length > 0) {
            // Analyze common patterns in losses
            const shortLosses = losses.filter(g => g.moves.length < 25);
            if (shortLosses.length > losses.length * 0.3) {
                mistakes.push('Opening Phase Blunders');
            }

            const longLosses = losses.filter(g => g.moves.length > 50);
            if (longLosses.length > losses.length * 0.3) {
                mistakes.push('Endgame Technique Errors');
            }
        }

        return mistakes;
    }

    private analyzeOverallTrends(chessComAnalysis: PlatformComparison, lichessAnalysis: PlatformComparison): CrossPlatformInsights['overallTrends'] {
        const ratingDiff = Math.abs(chessComAnalysis.averageRating - lichessAnalysis.averageRating);
        const winRateDiff = Math.abs(chessComAnalysis.winRate - lichessAnalysis.winRate);
        
        const consistencyScore = Math.max(0, 100 - (ratingDiff / 10) - (winRateDiff * 2));
        
        let preferredPlatform: 'chess.com' | 'lichess' | 'neutral';
        if (chessComAnalysis.winRate > lichessAnalysis.winRate + 10) {
            preferredPlatform = 'chess.com';
        } else if (lichessAnalysis.winRate > chessComAnalysis.winRate + 10) {
            preferredPlatform = 'lichess';
        } else {
            preferredPlatform = 'neutral';
        }

        return {
            consistencyAcrossPlatforms: Math.round(consistencyScore),
            adaptabilityScore: Math.max(60, 100 - ratingDiff / 5),
            strengthVariation: ratingDiff,
            preferredPlatform
        };
    }

    private analyzeTacticalDifferences(chessComAnalysis: PlatformComparison, lichessAnalysis: PlatformComparison): CrossPlatformInsights['tacticalDifferences'] {
        const chessComStrengths = chessComAnalysis.tacticalProfile.strengths;
        const lichessStrengths = lichessAnalysis.tacticalProfile.strengths;
        const chessComWeaknesses = chessComAnalysis.tacticalProfile.weaknesses;
        const lichessWeaknesses = lichessAnalysis.tacticalProfile.weaknesses;

        return {
            chessComStrengths: chessComStrengths.filter(s => !lichessStrengths.includes(s)),
            lichessStrengths: lichessStrengths.filter(s => !chessComStrengths.includes(s)),
            universalStrengths: chessComStrengths.filter(s => lichessStrengths.includes(s)),
            chessComWeaknesses: chessComWeaknesses.filter(w => !lichessWeaknesses.includes(w)),
            lichessWeaknesses: lichessWeaknesses.filter(w => !chessComWeaknesses.includes(w)),
            universalWeaknesses: chessComWeaknesses.filter(w => lichessWeaknesses.includes(w))
        };
    }

    private analyzeStrategicDifferences(chessComAnalysis: PlatformComparison, lichessAnalysis: PlatformComparison): CrossPlatformInsights['strategicDifferences'] {
        const chessComOpenings = chessComAnalysis.styleProfile.preferences.openings;
        const lichessOpenings = lichessAnalysis.styleProfile.preferences.openings;
        
        // Calculate opening variation
        const chessComOpeningNames = [...chessComOpenings.asWhite, ...chessComOpenings.asBlack].map(o => o.name);
        const lichessOpeningNames = [...lichessOpenings.asWhite, ...lichessOpenings.asBlack].map(o => o.name);
        
        const commonOpenings = chessComOpeningNames.filter(name => lichessOpeningNames.includes(name));
        const totalUniqueOpenings = new Set([...chessComOpeningNames, ...lichessOpeningNames]).size;
        
        const openingVariation = totalUniqueOpenings > 0 ? 
            ((totalUniqueOpenings - commonOpenings.length) / totalUniqueOpenings) * 100 : 0;

        return {
            openingVariation: Math.round(openingVariation),
            middlegameApproach: this.determineMiddlegameApproach(chessComAnalysis, lichessAnalysis),
            endgamePerformance: {
                chessComEndgameSkill: chessComAnalysis.styleProfile.weaknesses.endgameSkill,
                lichessEndgameSkill: lichessAnalysis.styleProfile.weaknesses.endgameSkill,
                difference: Math.abs(chessComAnalysis.styleProfile.weaknesses.endgameSkill - 
                                   lichessAnalysis.styleProfile.weaknesses.endgameSkill)
            }
        };
    }

    private determineMiddlegameApproach(chessComAnalysis: PlatformComparison, lichessAnalysis: PlatformComparison): 'consistent' | 'platform-specific' | 'varied' {
        const chessComStats = chessComAnalysis.tacticalProfile.statistics;
        const lichessStats = lichessAnalysis.tacticalProfile.statistics;
        
        const aggressivenessDiff = Math.abs(chessComStats.aggressiveness - lichessStats.aggressiveness);
        const riskTakingDiff = Math.abs(chessComStats.riskTaking - lichessStats.riskTaking);
        
        const avgDiff = (aggressivenessDiff + riskTakingDiff) / 2;
        
        if (avgDiff < 15) return 'consistent';
        if (avgDiff < 30) return 'platform-specific';
        return 'varied';
    }

    private generateRecommendations(chessComAnalysis: PlatformComparison, lichessAnalysis: PlatformComparison): CrossPlatformInsights['recommendations'] {
        const recommendations: CrossPlatformInsights['recommendations'] = [];

        // Compare performance and suggest improvements
        if (chessComAnalysis.winRate > lichessAnalysis.winRate + 15) {
            recommendations.push({
                category: 'improvement',
                priority: 'high',
                description: 'Focus on improving Lichess performance by applying Chess.com strategies',
                platform: 'lichess',
                actionItems: [
                    'Analyze successful Chess.com games for pattern application',
                    'Practice time controls more common on Lichess',
                    'Focus on tactical training for Lichess-style games'
                ]
            });
        }

        if (lichessAnalysis.winRate > chessComAnalysis.winRate + 15) {
            recommendations.push({
                category: 'improvement',
                priority: 'high',
                description: 'Apply successful Lichess strategies to Chess.com games',
                platform: 'chess.com',
                actionItems: [
                    'Transfer Lichess tactical patterns to Chess.com',
                    'Adapt to Chess.com interface and time controls',
                    'Study Chess.com-specific opening theory'
                ]
            });
        }

        // Consistency recommendations
        const ratingDiff = Math.abs(chessComAnalysis.averageRating - lichessAnalysis.averageRating);
        if (ratingDiff > 100) {
            recommendations.push({
                category: 'consistency',
                priority: 'medium',
                description: 'Work on maintaining consistent playing strength across platforms',
                platform: 'both',
                actionItems: [
                    'Practice similar time controls on both platforms',
                    'Develop platform-agnostic opening repertoire',
                    'Focus on fundamental tactical patterns'
                ]
            });
        }

        // Specialization recommendations
        const strongerPlatform = chessComAnalysis.winRate > lichessAnalysis.winRate ? 'chess.com' : 'lichess';
        recommendations.push({
            category: 'specialization',
            priority: 'low',
            description: `Consider specializing in ${strongerPlatform} to maximize rating gains`,
            platform: strongerPlatform,
            actionItems: [
                `Focus majority of practice time on ${strongerPlatform}`,
                `Study ${strongerPlatform}-specific strategies and meta`,
                `Participate in ${strongerPlatform} tournaments and events`
            ]
        });

        return recommendations.sort((a, b) => {
            const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }

    private identifySynergies(chessComAnalysis: PlatformComparison, lichessAnalysis: PlatformComparison): CrossPlatformInsights['synergies'] {
        const synergies: CrossPlatformInsights['synergies'] = [];

        // Universal strengths
        const universalStrengths = chessComAnalysis.tacticalProfile.strengths.filter(s => 
            lichessAnalysis.tacticalProfile.strengths.includes(s)
        );

        if (universalStrengths.length > 0) {
            synergies.push({
                description: 'Strong tactical awareness across both platforms',
                benefit: 'Consistent performance and reliable tactical foundation',
                howToLeverage: [
                    'Build upon universal tactical strengths',
                    'Use consistent tactical patterns as confidence foundation',
                    'Apply successful tactics from one platform to the other'
                ]
            });
        }

        // Complementary skills
        const chessComUnique = chessComAnalysis.tacticalProfile.strengths.filter(s => 
            !lichessAnalysis.tacticalProfile.strengths.includes(s)
        );
        const lichessUnique = lichessAnalysis.tacticalProfile.strengths.filter(s => 
            !chessComAnalysis.tacticalProfile.strengths.includes(s)
        );

        if (chessComUnique.length > 0 && lichessUnique.length > 0) {
            synergies.push({
                description: 'Complementary skills across platforms create well-rounded player',
                benefit: 'Diverse tactical toolkit and adaptability',
                howToLeverage: [
                    'Cross-train platform-specific skills',
                    'Combine Chess.com and Lichess strengths for tournament play',
                    'Use platform variety to identify and fill skill gaps'
                ]
            });
        }

        return synergies;
    }

    public printCrossPlatformAnalysis(): void {
        const insights = this.analyzeCrossPlatform();

        console.log('\n🌐 CROSS-PLATFORM ANALYSIS');
        console.log('===========================');

        console.log('\n📊 PLATFORM COMPARISON:');
        insights.platformComparisons.forEach(platform => {
            console.log(`\n${platform.platform.toUpperCase()}:`);
            console.log(`  Games: ${platform.gameCount}`);
            console.log(`  Win Rate: ${platform.winRate.toFixed(1)}%`);
            console.log(`  Avg Rating: ${Math.round(platform.averageRating)}`);
            console.log(`  Rating Range: ${platform.ratingRange.min} - ${platform.ratingRange.max}`);
            console.log(`  Avg Game Length: ${Math.round(platform.averageGameLength)} moves`);
            console.log(`  Unique Patterns: ${platform.uniquePatterns.join(', ') || 'None identified'}`);
        });

        console.log('\n🎯 OVERALL TRENDS:');
        console.log(`⚖️ Consistency: ${insights.overallTrends.consistencyAcrossPlatforms}%`);
        console.log(`🔄 Adaptability: ${insights.overallTrends.adaptabilityScore}%`);
        console.log(`📈 Strength Variation: ${insights.overallTrends.strengthVariation.toFixed(0)} points`);
        console.log(`🏆 Preferred Platform: ${insights.overallTrends.preferredPlatform}`);

        console.log('\n⚔️ TACTICAL DIFFERENCES:');
        if (insights.tacticalDifferences.universalStrengths.length > 0) {
            console.log(`  Universal Strengths: ${insights.tacticalDifferences.universalStrengths.join(', ')}`);
        }
        if (insights.tacticalDifferences.chessComStrengths.length > 0) {
            console.log(`  Chess.com Only: ${insights.tacticalDifferences.chessComStrengths.join(', ')}`);
        }
        if (insights.tacticalDifferences.lichessStrengths.length > 0) {
            console.log(`  Lichess Only: ${insights.tacticalDifferences.lichessStrengths.join(', ')}`);
        }

        console.log('\n📈 TOP RECOMMENDATIONS:');
        insights.recommendations.slice(0, 3).forEach((rec, i) => {
            const priorityIcon = rec.priority === 'high' ? '🔥' : rec.priority === 'medium' ? '⚡' : '💡';
            console.log(`  ${i + 1}. ${priorityIcon} ${rec.category.toUpperCase()} (${rec.platform})`);
            console.log(`      ${rec.description}`);
        });

        console.log('\n🔄 SYNERGIES:');
        insights.synergies.forEach((synergy, i) => {
            console.log(`  ${i + 1}. ${synergy.description}`);
            console.log(`      Benefit: ${synergy.benefit}`);
        });
    }

    public getCrossPlatformInsights(): CrossPlatformInsights {
        return this.analyzeCrossPlatform();
    }
}