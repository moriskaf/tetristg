// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand(); // разворачиваем на весь экран
tg.BackButton.show(); // показываем кнопку назад (по умолчанию закрывает)

// Константы
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30; // размер клетки в пикселях

// Фигуры
const SHAPES = [
    { shape: [[1,1,1,1]], color: '#00f0f0' }, // I
    { shape: [[1,1],[1,1]], color: '#f0f000' }, // O
    { shape: [[0,1,0],[1,1,1]], color: '#a000f0' }, // T
    { shape: [[1,0,0],[1,1,1]], color: '#f0a000' }, // L
    { shape: [[0,0,1],[1,1,1]], color: '#0000f0' }, // J
    { shape: [[0,1,1],[1,1,0]], color: '#00f000' }, // S
    { shape: [[1,1,0],[0,1,1]], color: '#f00000' }  // Z
];

class Tetromino {
    constructor(shapeIndex) {
        const data = SHAPES[shapeIndex];
        this.shape = data.shape.map(row => [...row]);
        this.color = data.color;
        this.x = Math.floor((COLS - this.shape[0].length) / 2);
        this.y = 0;
    }
    rotate() {
        // Поворот матрицы
        const rotated = this.shape[0].map((_, i) => this.shape.map(row => row[i]).reverse());
        // Проверка столкновений будет позже
        return rotated;
    }
}

class Board {
    constructor() {
        this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
        this.score = 0;
        this.level = 0;
        this.lines = 0;
    }
    addPiece(piece) {
        piece.shape.forEach((row, dy) => {
            row.forEach((value, dx) => {
                if (value) {
                    const y = piece.y + dy;
                    const x = piece.x + dx;
                    if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
                        this.grid[y][x] = piece.color;
                    }
                }
            });
        });
    }
    collide(piece) {
        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[0].length; x++) {
                if (piece.shape[y][x]) {
                    const boardY = piece.y + y;
                    const boardX = piece.x + x;
                    if (boardY >= ROWS || boardX < 0 || boardX >= COLS || boardY < 0) return true;
                    if (boardY >= 0 && this.grid[boardY][boardX] !== null) return true;
                }
            }
        }
        return false;
    }
    clearLines() {
        let cleared = 0;
        for (let y = ROWS - 1; y >= 0; ) {
            if (this.grid[y].every(cell => cell !== null)) {
                // Удаляем строку
                this.grid.splice(y, 1);
                this.grid.unshift(Array(COLS).fill(null));
                cleared++;
                // остаёмся на том же индексе, т.к. строка удалена
            } else {
                y--;
            }
        }
        if (cleared > 0) {
            this.lines += cleared;
            this.score += cleared * 100 * (this.level + 1);
            this.level = Math.floor(this.lines / 10);
        }
    }
    draw(ctx) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        // Рисуем сетку
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                if (this.grid[y][x]) {
                    ctx.fillStyle = this.grid[y][x];
                    ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE-1, BLOCK_SIZE-1);
                } else {
                    ctx.strokeStyle = '#333';
                    ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE-1, BLOCK_SIZE-1);
                }
            }
        }
    }
}

class Game {
    constructor(canvas, onGameOver) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.board = new Board();
        this.piece = null;
        this.nextPiece = null;
        this.gameOver = false;
        this.paused = false;
        this.interval = null;
        this.onGameOver = onGameOver;
        this.spawnNewPiece();
    }
    spawnNewPiece() {
        if (!this.nextPiece) {
            this.nextPiece = new Tetromino(Math.floor(Math.random() * SHAPES.length));
        }
        this.piece = this.nextPiece;
        this.nextPiece = new Tetromino(Math.floor(Math.random() * SHAPES.length));
        if (this.board.collide(this.piece)) {
            this.gameOver = true;
            this.stop();
            this.onGameOver(this.board.score);
            return false;
        }
        return true;
    }
    move(dx, dy) {
        if (this.gameOver || !this.piece) return false;
        const newX = this.piece.x + dx;
        const newY = this.piece.y + dy;
        const oldX = this.piece.x;
        const oldY = this.piece.y;
        this.piece.x = newX;
        this.piece.y = newY;
        if (this.board.collide(this.piece)) {
            this.piece.x = oldX;
            this.piece.y = oldY;
            if (dy === 1) { // движение вниз привело к столкновению -> фиксируем
                this.lockPiece();
            }
            return false;
        }
        return true;
    }
    rotate() {
        if (this.gameOver || !this.piece) return;
        const rotated = this.piece.rotate();
        const oldShape = this.piece.shape;
        this.piece.shape = rotated;
        if (this.board.collide(this.piece)) {
            this.piece.shape = oldShape;
        }
    }
    lockPiece() {
        this.board.addPiece(this.piece);
        this.board.clearLines();
        if (!this.spawnNewPiece()) {
            // game over
        }
    }
    drop() {
        while (this.move(0, 1)) {}
    }
    start(intervalTime = 500) {
        this.interval = setInterval(() => {
            if (!this.paused && !this.gameOver) {
                this.move(0, 1);
                this.draw();
            }
        }, intervalTime);
    }
    stop() {
        if (this.interval) clearInterval(this.interval);
    }
    draw() {
        this.board.draw(this.ctx);
        if (this.piece) {
            this.piece.shape.forEach((row, dy) => {
                row.forEach((value, dx) => {
                    if (value) {
                        this.ctx.fillStyle = this.piece.color;
                        this.ctx.fillRect((this.piece.x + dx) * BLOCK_SIZE, (this.piece.y + dy) * BLOCK_SIZE, BLOCK_SIZE-1, BLOCK_SIZE-1);
                    }
                });
            });
        }
        document.getElementById('score').textContent = this.board.score;
        document.getElementById('level').textContent = this.board.level;
    }
}