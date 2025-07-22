import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { PlayerProfile, PlayerStats, EnhancedGameData } from './chess-com-extractor';

export interface StoredPlayerData {
    username: string;
    lastUpdated: number;
    profile?: PlayerProfile;
    stats?: PlayerStats;
    games: EnhancedGameData[];
    archives: string[];
    metadata: {
        totalGames: number;
        dateRange: {
            earliest?: number;
            latest?: number;
        };
        timeControls: string[];
        averageRating: number;
        winRate: number;
    };
}

export class DataStorage {
    private dataDir: string;
    private username: string;

    constructor(username: string, dataDir: string = 'data') {
        this.username = username;
        this.dataDir = dataDir;
        this.ensureDataDirectory();
    }

    private ensureDataDirectory(): void {
        if (!existsSync(this.dataDir)) {
            mkdirSync(this.dataDir, { recursive: true });
            console.log(`📁 Created data directory: ${this.dataDir}`);
        }
    }

    private getFilePath(filename: string): string {
        return join(this.dataDir, filename);
    }

    private calculateMetadata(games: EnhancedGameData[]): StoredPlayerData['metadata'] {
        if (games.length === 0) {
            return {
                totalGames: 0,
                dateRange: {},
                timeControls: [],
                averageRating: 0,
                winRate: 0
            };
        }

        const endTimes = games.map(g => g.end_time).filter(Boolean).sort();
        const timeControls = [...new Set(games.map(g => g.time_control))];
        const totalRating = games.reduce((sum, game) => sum + game.playerRating, 0);
        const wins = games.filter(g => g.gameResult === 'win').length;

        return {
            totalGames: games.length,
            dateRange: {
                earliest: endTimes[0],
                latest: endTimes[endTimes.length - 1]
            },
            timeControls,
            averageRating: Math.round(totalRating / games.length),
            winRate: Math.round((wins / games.length) * 100 * 10) / 10
        };
    }

    savePlayerData(
        profile?: PlayerProfile,
        stats?: PlayerStats,
        games: EnhancedGameData[] = [],
        archives: string[] = []
    ): void {
        const data: StoredPlayerData = {
            username: this.username,
            lastUpdated: Date.now(),
            profile,
            stats,
            games,
            archives,
            metadata: this.calculateMetadata(games)
        };

        const filename = `${this.username}_complete_data.json`;
        const filepath = this.getFilePath(filename);

        try {
            writeFileSync(filepath, JSON.stringify(data, null, 2));
            console.log(`💾 Player data saved to ${filepath}`);
            console.log(`📊 Metadata: ${data.metadata.totalGames} games, ${data.metadata.winRate}% win rate`);
        } catch (error) {
            console.error(`❌ Failed to save player data:`, error);
            throw error;
        }
    }

    loadPlayerData(): StoredPlayerData | null {
        const filename = `${this.username}_complete_data.json`;
        const filepath = this.getFilePath(filename);

        try {
            if (!existsSync(filepath)) {
                console.log(`📂 No existing data found for ${this.username}`);
                return null;
            }

            const data = JSON.parse(readFileSync(filepath, 'utf8'));
            console.log(`📥 Loaded data for ${this.username}: ${data.metadata.totalGames} games`);
            return data;
        } catch (error) {
            console.error(`❌ Failed to load player data:`, error);
            return null;
        }
    }

    saveGamesOnly(games: EnhancedGameData[]): void {
        const filename = `${this.username}_games_only.json`;
        const filepath = this.getFilePath(filename);

        const gamesData = {
            username: this.username,
            lastUpdated: Date.now(),
            games,
            metadata: this.calculateMetadata(games)
        };

        try {
            writeFileSync(filepath, JSON.stringify(gamesData, null, 2));
            console.log(`🎮 Games data saved to ${filepath}`);
        } catch (error) {
            console.error(`❌ Failed to save games data:`, error);
            throw error;
        }
    }

    exportToPGN(): void {
        const data = this.loadPlayerData();
        if (!data || data.games.length === 0) {
            console.log(`❌ No games found to export for ${this.username}`);
            return;
        }

        const filename = `${this.username}_games.pgn`;
        const filepath = this.getFilePath(filename);

        try {
            const pgnContent = data.games.map(game => game.pgn).join('\n\n');
            writeFileSync(filepath, pgnContent);
            console.log(`📄 Exported ${data.games.length} games to ${filepath}`);
        } catch (error) {
            console.error(`❌ Failed to export PGN:`, error);
            throw error;
        }
    }

    getDataSummary(): void {
        const data = this.loadPlayerData();
        if (!data) {
            console.log(`❌ No data found for ${this.username}`);
            return;
        }

        console.log('\n📈 DATA STORAGE SUMMARY');
        console.log('=======================');
        console.log(`👤 Username: ${data.username}`);
        console.log(`📅 Last Updated: ${new Date(data.lastUpdated).toLocaleString()}`);
        console.log(`🎮 Total Games: ${data.metadata.totalGames}`);
        console.log(`⭐ Average Rating: ${data.metadata.averageRating}`);
        console.log(`🏆 Win Rate: ${data.metadata.winRate}%`);
        console.log(`⏱️ Time Controls: ${data.metadata.timeControls.join(', ')}`);
        
        if (data.metadata.dateRange.earliest && data.metadata.dateRange.latest) {
            const earliest = new Date(data.metadata.dateRange.earliest * 1000);
            const latest = new Date(data.metadata.dateRange.latest * 1000);
            console.log(`📊 Date Range: ${earliest.toDateString()} - ${latest.toDateString()}`);
        }

        console.log(`📁 Data Location: ${this.dataDir}/`);
    }

    cleanOldData(daysOld: number = 7): void {
        const data = this.loadPlayerData();
        if (!data) return;

        const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
        
        if (data.lastUpdated < cutoffTime) {
            const filename = `${this.username}_complete_data.json`;
            const backupName = `${this.username}_backup_${data.lastUpdated}.json`;
            
            console.log(`🔄 Data is ${daysOld}+ days old, creating backup: ${backupName}`);
            writeFileSync(this.getFilePath(backupName), JSON.stringify(data, null, 2));
        }
    }
}