import { EventEmitter } from 'events';
import { BotDecisionEngine, BotConfiguration, GameState } from './bot-decision-engine';
import { PositionEvaluator } from './position-evaluator';
import { ChessPositionManager } from './chess-position-manager';
import { UnifiedGameData } from '../data/combined-extractor';

export interface UCIEngine extends EventEmitter {
    // UCI Protocol Commands
    uci(): void;
    isready(): void;
    ucinewgame(): void;
    position(fen: string, moves?: string[]): void;
    go(options: GoOptions): void;
    stop(): void;
    quit(): void;
    setoption(name: string, value: string): void;
}

export interface GoOptions {
    searchmoves?: string[];
    ponder?: boolean;
    wtime?: number;
    btime?: number;
    winc?: number;
    binc?: number;
    movestogo?: number;
    depth?: number;
    nodes?: number;
    mate?: number;
    movetime?: number;
    infinite?: boolean;
}

export interface UCIInfo {
    depth?: number;
    seldepth?: number;
    time?: number;
    nodes?: number;
    pv?: string[];
    multipv?: number;
    score?: {
        cp?: number;
        mate?: number;
        lowerbound?: boolean;
        upperbound?: boolean;
    };
    currmove?: string;
    currmovenumber?: number;
    hashfull?: number;
    nps?: number;
    tbhits?: number;
    sbhits?: number;
    cpuload?: number;
    string?: string;
    refutation?: string[];
    currline?: string[];
}

export interface UCIOption {
    name: string;
    type: 'check' | 'spin' | 'combo' | 'button' | 'string';
    default?: string | number | boolean;
    min?: number;
    max?: number;
    var?: string[];
}

export class PersonalityChessEngine extends EventEmitter implements UCIEngine {
    private decisionEngine: BotDecisionEngine;
    private positionEvaluator: PositionEvaluator;
    private positionManager: ChessPositionManager;
    private isThinking: boolean = false;
    private searchStartTime: number = 0;
    
    // UCI Options
    private options: Map<string, UCIOption> = new Map();
    private optionValues: Map<string, string | number | boolean> = new Map();

    constructor(games: UnifiedGameData[], config: BotConfiguration) {
        super();
        this.decisionEngine = new BotDecisionEngine(games, config);
        this.positionEvaluator = new PositionEvaluator();
        this.positionManager = new ChessPositionManager();
        
        this.initializeUCIOptions();
        this.setupEngineEventHandlers();
    }

    private initializeUCIOptions(): void {
        // Standard UCI options for personality engine
        this.options.set('Hash', {
            name: 'Hash',
            type: 'spin',
            default: 128,
            min: 1,
            max: 2048
        });

        this.options.set('Threads', {
            name: 'Threads',
            type: 'spin',
            default: 1,
            min: 1,
            max: 8
        });

        this.options.set('Ponder', {
            name: 'Ponder',
            type: 'check',
            default: false
        });

        // Custom personality options
        this.options.set('StyleMimicry', {
            name: 'StyleMimicry',
            type: 'spin',
            default: 85,
            min: 0,
            max: 100
        });

        this.options.set('AdaptabilityLevel', {
            name: 'AdaptabilityLevel',
            type: 'combo',
            default: 'moderate',
            var: ['strict', 'moderate', 'flexible']
        });

        this.options.set('EmergencyOverride', {
            name: 'EmergencyOverride',
            type: 'check',
            default: true
        });

        this.options.set('TimeManagement', {
            name: 'TimeManagement',
            type: 'combo',
            default: 'balanced',
            var: ['conservative', 'balanced', 'aggressive']
        });

        this.options.set('RiskTolerance', {
            name: 'RiskTolerance',
            type: 'spin',
            default: 50,
            min: 0,
            max: 100
        });

        this.options.set('DebugMode', {
            name: 'DebugMode',
            type: 'check',
            default: false
        });

        // Set default values
        this.options.forEach((option, name) => {
            this.optionValues.set(name, option.default!);
        });
    }

    private setupEngineEventHandlers(): void {
        // Handle any engine-specific events here
        this.on('error', (error) => {
            console.error('UCI Engine Error:', error);
        });
    }

    // UCI Protocol Implementation
    public uci(): void {
        this.emit('output', 'id name PersonalityChessEngine v1.0');
        this.emit('output', 'id author Claude AI & Paul_Nas Analysis');
        
        // Send all available options
        this.options.forEach((option) => {
            let optionStr = `option name ${option.name} type ${option.type}`;
            
            if (option.default !== undefined) {
                optionStr += ` default ${option.default}`;
            }
            if (option.min !== undefined) {
                optionStr += ` min ${option.min}`;
            }
            if (option.max !== undefined) {
                optionStr += ` max ${option.max}`;
            }
            if (option.var) {
                option.var.forEach(v => {
                    optionStr += ` var ${v}`;
                });
            }
            
            this.emit('output', optionStr);
        });
        
        this.emit('output', 'uciok');
    }

    public isready(): void {
        // Ensure engine is ready for commands
        if (!this.isThinking) {
            this.emit('output', 'readyok');
        } else {
            // If thinking, wait a moment and try again
            setTimeout(() => this.isready(), 10);
        }
    }

    public ucinewgame(): void {
        // Reset for new game
        this.positionManager = new ChessPositionManager();
        this.isThinking = false;
        
        // Reset any game-specific state in decision engine
        // this.decisionEngine.resetForNewGame();
    }

    public position(fen: string, moves: string[] = []): void {
        this.positionManager.loadPosition(fen);
        
        // Apply moves
        for (const move of moves) {
            this.positionManager.makeMove(move);
        }
        
        // Update internal position representation
        this.updateInternalPosition();
    }

    public async go(options: GoOptions): Promise<void> {
        if (this.isThinking) {
            return; // Already thinking
        }

        this.isThinking = true;
        this.searchStartTime = Date.now();
        
        try {
            const bestMove = await this.findBestMove(options);
            const searchTime = Date.now() - this.searchStartTime;
            
            // Send final info
            this.emit('output', `info time ${searchTime} nodes 1000 nps ${Math.round(1000000/searchTime)}`);
            this.emit('output', `bestmove ${bestMove}`);
            
        } catch (error) {
            console.error('Error in go command:', error);
            this.emit('output', 'bestmove 0000'); // Null move
        } finally {
            this.isThinking = false;
        }
    }

    public stop(): void {
        this.isThinking = false;
        // Force immediate best move if we have one
        if (this.searchStartTime > 0) {
            const searchTime = Date.now() - this.searchStartTime;
            this.emit('output', `info time ${searchTime} nodes 500`);
            this.emit('output', 'bestmove e2e4'); // Default move
        }
    }

    public quit(): void {
        this.isThinking = false;
        this.removeAllListeners();
    }

    public setoption(name: string, value: string): void {
        const option = this.options.get(name);
        if (!option) {
            return; // Unknown option
        }

        let parsedValue: string | number | boolean = value;

        // Parse value based on option type
        switch (option.type) {
            case 'check':
                parsedValue = value.toLowerCase() === 'true';
                break;
            case 'spin':
                parsedValue = parseInt(value);
                if (option.min !== undefined && parsedValue < option.min) {
                    parsedValue = option.min;
                }
                if (option.max !== undefined && parsedValue > option.max) {
                    parsedValue = option.max;
                }
                break;
            case 'combo':
                if (option.var && !option.var.includes(value)) {
                    return; // Invalid combo value
                }
                parsedValue = value;
                break;
            case 'string':
                parsedValue = value;
                break;
        }

        this.optionValues.set(name, parsedValue);
        this.applyOptionChange(name, parsedValue);
    }

    private applyOptionChange(name: string, value: string | number | boolean): void {
        // Apply the option change to the engine behavior
        switch (name) {
            case 'DebugMode':
                // Update decision engine debug mode
                const config = this.getUpdatedConfiguration();
                this.decisionEngine.updateConfiguration(config);
                break;
            case 'AdaptabilityLevel':
                this.decisionEngine.updateConfiguration({
                    adaptabilityLevel: value as 'strict' | 'moderate' | 'flexible'
                });
                break;
            case 'EmergencyOverride':
                this.decisionEngine.updateConfiguration({
                    emergencyOverride: value as boolean
                });
                break;
            case 'TimeManagement':
                this.decisionEngine.updateConfiguration({
                    timeManagementStyle: value as 'conservative' | 'balanced' | 'aggressive'
                });
                break;
            case 'RiskTolerance':
                this.decisionEngine.updateConfiguration({
                    riskTolerance: value as number
                });
                break;
        }
    }

    private getUpdatedConfiguration(): Partial<BotConfiguration> {
        return {
            debugMode: this.optionValues.get('DebugMode') as boolean,
            adaptabilityLevel: this.optionValues.get('AdaptabilityLevel') as 'strict' | 'moderate' | 'flexible',
            emergencyOverride: this.optionValues.get('EmergencyOverride') as boolean,
            timeManagementStyle: this.optionValues.get('TimeManagement') as 'conservative' | 'balanced' | 'aggressive',
            riskTolerance: this.optionValues.get('RiskTolerance') as number
        };
    }

    private async findBestMove(options: GoOptions): Promise<string> {
        // Convert current position to GameState for decision engine
        const gameState = this.createGameStateFromPosition(options);
        
        // Send periodic info during search
        this.sendSearchInfo(gameState);
        
        // Get move decision from personality engine
        const decision = await this.decisionEngine.makeMove(gameState);
        
        // Send final search info
        this.sendFinalSearchInfo(decision, gameState);
        
        return decision.selectedMove;
    }

    private createGameStateFromPosition(options: GoOptions): GameState {
        // Get position analysis from chess position manager
        const analysis = this.positionManager.analyzePosition();
        const activeColor = this.positionManager.getTurn() === 'w' ? 'white' : 'black';
        
        // Get available moves in UCI format
        const availableMoves = analysis.legalMoves.map(move => 
            ChessPositionManager.convertMoveToUCI(move)
        );
        
        // Evaluate current position
        const evaluation = this.positionEvaluator.evaluatePosition(
            this.positionManager.getFEN(),
            this.positionManager.getMoveHistory().map(m => m.san),
            activeColor
        );

        return {
            position: this.positionManager.getFEN(),
            moveHistory: this.positionManager.getMoveHistory().map(m => m.san),
            currentPlayer: activeColor,
            gamePhase: analysis.gamePhase,
            timeRemaining: {
                white: options.wtime || 300000, // Default 5 minutes
                black: options.btime || 300000
            },
            evaluation: evaluation.totalScore,
            threats: analysis.threats,
            opportunities: analysis.tacticalMotifs.concat(analysis.positionalFeatures),
            availableMoves
        };
    }

    // This method is no longer needed as we use the position manager

    private sendSearchInfo(gameState: GameState): void {
        const elapsedTime = Date.now() - this.searchStartTime;
        
        // Send basic search info
        const info: UCIInfo = {
            depth: 1,
            time: elapsedTime,
            nodes: 100,
            score: { cp: gameState.evaluation },
            nps: Math.round(100000 / Math.max(elapsedTime, 1))
        };

        this.emit('output', this.formatInfoString(info));
    }

    private sendFinalSearchInfo(decision: any, gameState: GameState): void {
        const elapsedTime = Date.now() - this.searchStartTime;
        
        const info: UCIInfo = {
            depth: 1,
            time: elapsedTime,
            nodes: gameState.availableMoves.length * 100,
            pv: [decision.selectedMove],
            score: { cp: gameState.evaluation },
            nps: Math.round(gameState.availableMoves.length * 100000 / Math.max(elapsedTime, 1))
        };

        this.emit('output', this.formatInfoString(info));

        // Send reasoning as string info if debug mode is on
        if (this.optionValues.get('DebugMode')) {
            this.emit('output', `info string Confidence: ${decision.confidence}%`);
            this.emit('output', `info string Style Alignment: ${decision.styleAlignment}%`);
            this.emit('output', `info string Risk: ${decision.riskAssessment}`);
            
            if (decision.reasoning.length > 0) {
                this.emit('output', `info string Reason: ${decision.reasoning[0]}`);
            }
        }
    }

    private formatInfoString(info: UCIInfo): string {
        let infoStr = 'info';
        
        if (info.depth !== undefined) infoStr += ` depth ${info.depth}`;
        if (info.seldepth !== undefined) infoStr += ` seldepth ${info.seldepth}`;
        if (info.time !== undefined) infoStr += ` time ${info.time}`;
        if (info.nodes !== undefined) infoStr += ` nodes ${info.nodes}`;
        if (info.pv) infoStr += ` pv ${info.pv.join(' ')}`;
        if (info.multipv !== undefined) infoStr += ` multipv ${info.multipv}`;
        
        if (info.score) {
            infoStr += ' score';
            if (info.score.cp !== undefined) infoStr += ` cp ${info.score.cp}`;
            if (info.score.mate !== undefined) infoStr += ` mate ${info.score.mate}`;
            if (info.score.lowerbound) infoStr += ' lowerbound';
            if (info.score.upperbound) infoStr += ' upperbound';
        }
        
        if (info.currmove) infoStr += ` currmove ${info.currmove}`;
        if (info.currmovenumber !== undefined) infoStr += ` currmovenumber ${info.currmovenumber}`;
        if (info.hashfull !== undefined) infoStr += ` hashfull ${info.hashfull}`;
        if (info.nps !== undefined) infoStr += ` nps ${info.nps}`;
        if (info.tbhits !== undefined) infoStr += ` tbhits ${info.tbhits}`;
        if (info.sbhits !== undefined) infoStr += ` sbhits ${info.sbhits}`;
        if (info.cpuload !== undefined) infoStr += ` cpuload ${info.cpuload}`;
        if (info.string) infoStr += ` string ${info.string}`;
        if (info.refutation) infoStr += ` refutation ${info.refutation.join(' ')}`;
        if (info.currline) infoStr += ` currline ${info.currline.join(' ')}`;
        
        return infoStr;
    }

    private updateInternalPosition(): void {
        // Update any internal state based on new position
        // This is where you'd update opening book position, endgame tablebase lookups, etc.
    }

    // Public methods for external control
    public getEngineInfo(): { name: string; version: string; author: string } {
        return {
            name: 'PersonalityChessEngine',
            version: '1.0',
            author: 'Claude AI & Paul_Nas Analysis'
        };
    }

    public getCurrentPosition(): string {
        return this.positionManager.getFEN();
    }

    public getMoveHistory(): string[] {
        return this.positionManager.getMoveHistory().map(m => m.san);
    }

    public isCurrentlyThinking(): boolean {
        return this.isThinking;
    }

    public getAvailableOptions(): Map<string, UCIOption> {
        return new Map(this.options);
    }

    public getCurrentOptionValues(): Map<string, string | number | boolean> {
        return new Map(this.optionValues);
    }

    // Method to start UCI communication loop
    public startUCILoop(): void {
        process.stdin.setEncoding('utf8');
        process.stdin.on('readable', () => {
            let chunk;
            while (null !== (chunk = process.stdin.read())) {
                const commands = chunk.toString().trim().split('\n');
                for (const command of commands) {
                    this.handleUCICommand(command.trim());
                }
            }
        });

        // Handle output events
        this.on('output', (message: string) => {
            console.log(message);
        });
    }

    private handleUCICommand(command: string): void {
        const parts = command.split(' ');
        const cmd = parts[0];

        try {
            switch (cmd) {
                case 'uci':
                    this.uci();
                    break;
                
                case 'isready':
                    this.isready();
                    break;
                
                case 'ucinewgame':
                    this.ucinewgame();
                    break;
                
                case 'position':
                    this.handlePositionCommand(parts.slice(1));
                    break;
                
                case 'go':
                    this.handleGoCommand(parts.slice(1));
                    break;
                
                case 'stop':
                    this.stop();
                    break;
                
                case 'quit':
                    this.quit();
                    process.exit(0);
                    break;
                
                case 'setoption':
                    this.handleSetOptionCommand(parts.slice(1));
                    break;
                
                default:
                    // Unknown command - ignore
                    break;
            }
        } catch (error) {
            console.error(`Error handling UCI command "${command}":`, error);
        }
    }

    private handlePositionCommand(args: string[]): void {
        if (args[0] === 'startpos') {
            const movesIndex = args.indexOf('moves');
            const moves = movesIndex !== -1 ? args.slice(movesIndex + 1) : [];
            this.position('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', moves);
        } else if (args[0] === 'fen') {
            const movesIndex = args.indexOf('moves');
            const fenEnd = movesIndex !== -1 ? movesIndex : args.length;
            const fen = args.slice(1, fenEnd).join(' ');
            const moves = movesIndex !== -1 ? args.slice(movesIndex + 1) : [];
            this.position(fen, moves);
        }
    }

    private handleGoCommand(args: string[]): void {
        const options: GoOptions = {};
        
        for (let i = 0; i < args.length; i += 2) {
            const key = args[i];
            const value = args[i + 1];
            
            switch (key) {
                case 'wtime':
                    options.wtime = parseInt(value);
                    break;
                case 'btime':
                    options.btime = parseInt(value);
                    break;
                case 'winc':
                    options.winc = parseInt(value);
                    break;
                case 'binc':
                    options.binc = parseInt(value);
                    break;
                case 'movestogo':
                    options.movestogo = parseInt(value);
                    break;
                case 'depth':
                    options.depth = parseInt(value);
                    break;
                case 'nodes':
                    options.nodes = parseInt(value);
                    break;
                case 'mate':
                    options.mate = parseInt(value);
                    break;
                case 'movetime':
                    options.movetime = parseInt(value);
                    break;
                case 'infinite':
                    options.infinite = true;
                    i--; // No value for infinite
                    break;
                case 'ponder':
                    options.ponder = true;
                    i--; // No value for ponder
                    break;
            }
        }
        
        this.go(options);
    }

    private handleSetOptionCommand(args: string[]): void {
        // Format: setoption name <optionname> value <optionvalue>
        const nameIndex = args.indexOf('name');
        const valueIndex = args.indexOf('value');
        
        if (nameIndex !== -1 && valueIndex !== -1) {
            const name = args.slice(nameIndex + 1, valueIndex).join(' ');
            const value = args.slice(valueIndex + 1).join(' ');
            this.setoption(name, value);
        }
    }
}