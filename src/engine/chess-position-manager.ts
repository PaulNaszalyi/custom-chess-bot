import { Chess, Move, Square } from 'chess.js';
import { PositionEvaluation } from './position-evaluator';

export interface EnhancedMove extends Move {
    evaluation?: number;
    category?: 'tactical' | 'positional' | 'defensive' | 'aggressive' | 'quiet' | 'forcing';
    risk?: number;
    timeRecommended?: number;
}

export interface PositionAnalysis {
    legalMoves: EnhancedMove[];
    gamePhase: 'opening' | 'middlegame' | 'endgame';
    material: {
        white: number;
        black: number;
        balance: number;
    };
    pieceCount: {
        total: number;
        white: number;
        black: number;
        majorPieces: number;
        minorPieces: number;
        pawns: number;
    };
    castlingRights: {
        white: { kingside: boolean; queenside: boolean };
        black: { kingside: boolean; queenside: boolean };
    };
    checks: {
        inCheck: boolean;
        checkmate: boolean;
        stalemate: boolean;
    };
    threats: string[];
    tacticalMotifs: string[];
    positionalFeatures: string[];
}

export class ChessPositionManager {
    private chess: Chess;
    private moveHistory: Move[] = [];
    
    // Piece values for material calculation
    private readonly pieceValues = {
        p: 100,  // pawn
        n: 320,  // knight
        b: 330,  // bishop
        r: 500,  // rook
        q: 900,  // queen
        k: 0     // king (positional value, not material)
    };

    constructor(fen?: string) {
        this.chess = fen ? new Chess(fen) : new Chess();
    }

    // Core chess operations
    public loadPosition(fen: string): boolean {
        try {
            this.chess.load(fen);
            this.moveHistory = [];
            return true;
        } catch (error) {
            console.error('Invalid FEN:', fen, error);
            return false;
        }
    }

    public makeMove(move: string | Move): Move | null {
        try {
            const madeMove = this.chess.move(move);
            if (madeMove) {
                this.moveHistory.push(madeMove);
            }
            return madeMove;
        } catch (error) {
            console.error('Invalid move:', move, error);
            return null;
        }
    }

    public undoMove(): Move | null {
        const undoneMove = this.chess.undo();
        if (undoneMove && this.moveHistory.length > 0) {
            this.moveHistory.pop();
        }
        return undoneMove;
    }

    public getLegalMoves(): EnhancedMove[] {
        const moves = this.chess.moves({ verbose: true });
        return moves.map(move => this.enhanceMove(move));
    }

    public getLegalMovesForSquare(square: Square): EnhancedMove[] {
        const moves = this.chess.moves({ square, verbose: true });
        return moves.map(move => this.enhanceMove(move));
    }

    public isMoveLegal(move: string): boolean {
        const moves = this.chess.moves();
        return moves.includes(move);
    }

    // Position analysis
    public analyzePosition(): PositionAnalysis {
        const legalMoves = this.getLegalMoves();
        const gamePhase = this.determineGamePhase();
        const material = this.calculateMaterial();
        const pieceCount = this.countPieces();
        const castlingRights = this.getCastlingRights();
        const checks = this.getCheckStatus();
        const threats = this.identifyThreats();
        const tacticalMotifs = this.identifyTacticalMotifs();
        const positionalFeatures = this.identifyPositionalFeatures();

        return {
            legalMoves,
            gamePhase,
            material,
            pieceCount,
            castlingRights,
            checks,
            threats,
            tacticalMotifs,
            positionalFeatures
        };
    }

    private enhanceMove(move: Move): EnhancedMove {
        const enhancedMove: EnhancedMove = { ...move };
        
        // Categorize move
        enhancedMove.category = this.categorizeMove(move);
        
        // Calculate risk (simplified)
        enhancedMove.risk = this.calculateMoveRisk(move);
        
        // Recommend thinking time based on complexity
        enhancedMove.timeRecommended = this.recommendThinkingTime(move);
        
        return enhancedMove;
    }

    private categorizeMove(move: Move): EnhancedMove['category'] {
        // Tactical moves
        if (move.flags.includes('c') || move.flags.includes('e')) { // capture or en passant
            return 'tactical';
        }
        
        if (move.flags.includes('q') || move.flags.includes('k')) { // castling
            return 'positional';
        }
        
        if (move.flags.includes('p')) { // promotion
            return 'tactical';
        }
        
        // Check if move gives check
        this.makeMove(move);
        const givesCheck = this.chess.inCheck();
        this.undoMove();
        
        if (givesCheck) {
            return 'forcing';
        }
        
        // Check if move is defensive (blocks threats, improves king safety)
        if (this.isDefensiveMove(move)) {
            return 'defensive';
        }
        
        // Check if move is aggressive (attacks opponent pieces/king)
        if (this.isAggressiveMove(move)) {
            return 'aggressive';
        }
        
        return 'quiet';
    }

    private calculateMoveRisk(move: Move): number {
        let risk = 0;
        
        // Captures can be risky if we're trading up
        if (move.captured) {
            const capturedValue = this.pieceValues[move.captured as keyof typeof this.pieceValues];
            const movingValue = this.pieceValues[move.piece as keyof typeof this.pieceValues];
            
            if (movingValue > capturedValue) {
                risk += 30; // Trading down is risky
            }
        }
        
        // Moving valuable pieces into danger
        if (move.piece === 'q') {
            risk += 15; // Queen moves have inherent risk
        }
        
        // King moves (except castling)
        if (move.piece === 'k' && !move.flags.includes('k') && !move.flags.includes('q')) {
            risk += 20;
        }
        
        // Check if move exposes pieces to attack
        this.makeMove(move);
        const exposedPieces = this.countExposedPieces();
        this.undoMove();
        
        risk += exposedPieces * 10;
        
        return Math.min(100, risk);
    }

    private recommendThinkingTime(move: Move): number {
        let baseTime = 5; // Base 5 seconds
        
        // Captures need more calculation
        if (move.captured) {
            baseTime += 10;
        }
        
        // Checks need verification
        this.makeMove(move);
        const givesCheck = this.chess.inCheck();
        this.undoMove();
        
        if (givesCheck) {
            baseTime += 15;
        }
        
        // Promotions need careful consideration
        if (move.flags.includes('p')) {
            baseTime += 20;
        }
        
        // Complex positions need more time
        const legalMoves = this.chess.moves();
        if (legalMoves.length > 30) {
            baseTime += 10;
        }
        
        return Math.max(3, Math.min(60, baseTime));
    }

    private determineGamePhase(): 'opening' | 'middlegame' | 'endgame' {
        const moveCount = this.moveHistory.length;
        const pieceCount = this.countPieces();
        
        // Opening: First 20 moves or still developing
        if (moveCount < 20) {
            return 'opening';
        }
        
        // Endgame: Few pieces left
        if (pieceCount.total <= 12 || 
            (pieceCount.majorPieces <= 4 && pieceCount.total <= 16)) {
            return 'endgame';
        }
        
        return 'middlegame';
    }

    private calculateMaterial(): PositionAnalysis['material'] {
        let whiteMaterial = 0;
        let blackMaterial = 0;
        
        const board = this.chess.board().flat();
        
        for (const square of board) {
            if (square) {
                const pieceValue = this.pieceValues[square.type as keyof typeof this.pieceValues];
                if (square.color === 'w') {
                    whiteMaterial += pieceValue;
                } else {
                    blackMaterial += pieceValue;
                }
            }
        }
        
        return {
            white: whiteMaterial,
            black: blackMaterial,
            balance: whiteMaterial - blackMaterial
        };
    }

    private countPieces(): PositionAnalysis['pieceCount'] {
        let total = 0;
        let white = 0;
        let black = 0;
        let majorPieces = 0;
        let minorPieces = 0;
        let pawns = 0;
        
        const board = this.chess.board().flat();
        
        for (const square of board) {
            if (square) {
                total++;
                if (square.color === 'w') white++;
                else black++;
                
                switch (square.type) {
                    case 'p':
                        pawns++;
                        break;
                    case 'r':
                    case 'q':
                        majorPieces++;
                        break;
                    case 'n':
                    case 'b':
                        minorPieces++;
                        break;
                }
            }
        }
        
        return { total, white, black, majorPieces, minorPieces, pawns };
    }

    private getCastlingRights(): PositionAnalysis['castlingRights'] {
        const fen = this.chess.fen();
        const castling = fen.split(' ')[2];
        
        return {
            white: {
                kingside: castling.includes('K'),
                queenside: castling.includes('Q')
            },
            black: {
                kingside: castling.includes('k'),
                queenside: castling.includes('q')
            }
        };
    }

    private getCheckStatus(): PositionAnalysis['checks'] {
        return {
            inCheck: this.chess.inCheck(),
            checkmate: this.chess.isCheckmate(),
            stalemate: this.chess.isStalemate()
        };
    }

    private identifyThreats(): string[] {
        const threats: string[] = [];
        
        if (this.chess.inCheck()) {
            threats.push('King in check');
        }
        
        // Look for hanging pieces
        const hangingPieces = this.findHangingPieces();
        if (hangingPieces.length > 0) {
            threats.push(`${hangingPieces.length} hanging pieces`);
        }
        
        // Look for pieces that can be captured by lower value pieces
        const underAttack = this.findPiecesUnderAttack();
        if (underAttack.length > 0) {
            threats.push(`${underAttack.length} pieces under attack`);
        }
        
        return threats;
    }

    private identifyTacticalMotifs(): string[] {
        const motifs: string[] = [];
        
        // Look for forks
        const forks = this.findForks();
        if (forks.length > 0) {
            motifs.push(`${forks.length} fork opportunities`);
        }
        
        // Look for pins
        const pins = this.findPins();
        if (pins.length > 0) {
            motifs.push(`${pins.length} pin opportunities`);
        }
        
        // Look for skewers
        const skewers = this.findSkewers();
        if (skewers.length > 0) {
            motifs.push(`${skewers.length} skewer opportunities`);
        }
        
        return motifs;
    }

    private identifyPositionalFeatures(): string[] {
        const features: string[] = [];
        
        // Center control
        const centerControl = this.evaluateCenterControl();
        if (Math.abs(centerControl) > 1) {
            const controller = centerControl > 0 ? 'White' : 'Black';
            features.push(`${controller} controls center`);
        }
        
        // King safety
        const kingSafety = this.evaluateKingSafety();
        if (kingSafety.white < -50) {
            features.push('White king exposed');
        }
        if (kingSafety.black < -50) {
            features.push('Black king exposed');
        }
        
        // Pawn structure
        const pawnStructure = this.evaluatePawnStructure();
        if (pawnStructure.weaknesses.length > 0) {
            features.push(`Pawn weaknesses: ${pawnStructure.weaknesses.join(', ')}`);
        }
        
        return features;
    }

    // Helper methods for tactical and positional analysis
    private findHangingPieces(): Square[] {
        // Simplified implementation - in reality would need full attack maps
        const hangingPieces: Square[] = [];
        const board = this.chess.board();
        
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const piece = board[rank][file];
                if (piece && piece.color === this.chess.turn()) {
                    const square = String.fromCharCode(97 + file) + (8 - rank) as Square;
                    if (this.isPieceHanging(square)) {
                        hangingPieces.push(square);
                    }
                }
            }
        }
        
        return hangingPieces;
    }

    private isPieceHanging(square: Square): boolean {
        // Simplified check - piece is hanging if it can be captured and isn't defended
        const attackers = this.getAttackers(square, this.chess.turn() === 'w' ? 'b' : 'w');
        const defenders = this.getAttackers(square, this.chess.turn());
        
        return attackers.length > 0 && defenders.length === 0;
    }

    private getAttackers(square: Square, color: 'w' | 'b'): Square[] {
        // This is a simplified implementation
        // In a full implementation, you'd analyze all pieces of the given color
        // that can attack the target square
        return [];
    }

    private findPiecesUnderAttack(): Square[] {
        // Similar to hanging pieces but includes defended pieces that are attacked
        const underAttack: Square[] = [];
        const board = this.chess.board();
        
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const piece = board[rank][file];
                if (piece && piece.color === this.chess.turn()) {
                    const square = String.fromCharCode(97 + file) + (8 - rank) as Square;
                    const attackers = this.getAttackers(square, this.chess.turn() === 'w' ? 'b' : 'w');
                    if (attackers.length > 0) {
                        underAttack.push(square);
                    }
                }
            }
        }
        
        return underAttack;
    }

    private findForks(): string[] {
        // Look for moves that attack multiple pieces simultaneously
        const forks: string[] = [];
        const moves = this.chess.moves({ verbose: true });
        
        for (const move of moves) {
            this.makeMove(move);
            const attackedSquares = this.getSquaresAttackedBy(move.to);
            let attackedPieces = 0;
            
            for (const square of attackedSquares) {
                const piece = this.chess.get(square);
                if (piece && piece.color !== this.chess.turn()) {
                    attackedPieces++;
                }
            }
            
            if (attackedPieces >= 2) {
                forks.push(move.san);
            }
            
            this.undoMove();
        }
        
        return forks;
    }

    private getSquaresAttackedBy(square: Square): Square[] {
        // Get all squares attacked by the piece on the given square
        // This is simplified - a full implementation would calculate actual attack patterns
        return [];
    }

    private findPins(): string[] {
        // Look for pinned pieces (pieces that cannot move without exposing their king)
        return [];
    }

    private findSkewers(): string[] {
        // Look for skewer opportunities
        return [];
    }

    private evaluateCenterControl(): number {
        // Simplified center control evaluation
        const centerSquares: Square[] = ['d4', 'd5', 'e4', 'e5'];
        let whiteControl = 0;
        let blackControl = 0;
        
        for (const square of centerSquares) {
            const piece = this.chess.get(square);
            if (piece) {
                if (piece.color === 'w') whiteControl++;
                else blackControl++;
            }
        }
        
        return whiteControl - blackControl;
    }

    private evaluateKingSafety(): { white: number; black: number } {
        // Simplified king safety evaluation
        return { white: 0, black: 0 };
    }

    private evaluatePawnStructure(): { weaknesses: string[] } {
        // Simplified pawn structure evaluation
        return { weaknesses: [] };
    }

    private countExposedPieces(): number {
        // Count pieces that are under attack after the current position
        return 0;
    }

    private isDefensiveMove(move: Move): boolean {
        // Check if move is defensive in nature
        return move.to.includes('1') || move.to.includes('2') || 
               move.to.includes('7') || move.to.includes('8');
    }

    private isAggressiveMove(move: Move): boolean {
        // Check if move is aggressive
        return move.to.includes('6') || move.to.includes('7') || 
               move.to.includes('3') || move.to.includes('2');
    }

    // Getters
    public getFEN(): string {
        return this.chess.fen();
    }

    public getPGN(): string {
        return this.chess.pgn();
    }

    public getTurn(): 'w' | 'b' {
        return this.chess.turn();
    }

    public getMoveHistory(): Move[] {
        return [...this.moveHistory];
    }

    public isGameOver(): boolean {
        return this.chess.isGameOver();
    }

    public getGameOverReason(): string | null {
        if (this.chess.isCheckmate()) return 'checkmate';
        if (this.chess.isStalemate()) return 'stalemate';
        if (this.chess.isDraw()) return 'draw';
        if (this.chess.isThreefoldRepetition()) return 'threefold repetition';
        if (this.chess.isInsufficientMaterial()) return 'insufficient material';
        return null;
    }

    public getBoard(): (ReturnType<Chess['get']> | null)[][] {
        return this.chess.board();
    }

    public validateMove(move: string): boolean {
        try {
            const testChess = new Chess(this.chess.fen());
            testChess.move(move);
            return true;
        } catch {
            return false;
        }
    }

    // Static utility methods
    public static isValidFEN(fen: string): boolean {
        try {
            new Chess(fen);
            return true;
        } catch {
            return false;
        }
    }

    public static convertMoveToUCI(move: Move): string {
        return move.from + move.to + (move.promotion || '');
    }

    public static convertMoveFromUCI(uciMove: string, chess: Chess): Move | null {
        try {
            const from = uciMove.slice(0, 2) as Square;
            const to = uciMove.slice(2, 4) as Square;
            const promotion = uciMove.slice(4) as 'q' | 'r' | 'b' | 'n' | undefined;
            
            return chess.move({ from, to, promotion });
        } catch {
            return null;
        }
    }
}