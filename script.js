// Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();

// Проверка поддержки BackButton (для версий Telegram < 6.1 она отсутствует)
if (tg.BackButton && tg.BackButton.show) {
    tg.BackButton.show();
    tg.BackButton.onClick(() => tg.close());
}

// Цвета темы Telegram
document.body.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#111');
document.body.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#fff');
document.body.style.setProperty('--tg-theme-hint-color', tg.themeParams.hint_color || '#555');
document.body.style.setProperty('--tg-theme-button-color', tg.themeParams.button_color || '#4CAF50');
document.body.style.setProperty('--tg-theme-button-text-color', tg.themeParams.button_text_color || '#fff');

// Константы
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;

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

// --- Класс Tetromino ---
class Tetromino {
    constructor(shapeIndex) {
        const data = SHAPES[shapeIndex];
        this.shape = data.shape.map(row => [...row]);
        this.color = data.color;
        this.x = Math.floor((COLS - this.shape[0].length) / 2);
        this.y = 0;
    }
    rotate() {
        // Поворот матрицы на 90 градусов по часовой стрелке
        const rotated = this.shape[0].map((_, i) => this.shape.map(row => row[i]).reverse());
        return rotated;
    }
}

// --- Класс Board (игровое поле) ---
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
                this.grid.splice(y, 1);
                this.grid.unshift(Array(COLS).fill(null));
                cleared++;
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

// --- Класс Game (основная логика) ---
class Game {
    constructor(canvas, nextCanvas, onGameOver) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.nextCanvas = nextCanvas;
        this.nextCtx = nextCanvas.getContext('2d');
        this.board = new Board();
        this.piece = null;
        this.nextPiece = null;
        this.gameOver = false;
        this.paused = false;
        this.interval = null;
        this.onGameOver = onGameOver;
        this.boardSnapshot = null;
        this.spawnNewPiece();
    }

    getIntervalTime() {
        return Math.max(100, 500 - this.board.level * 30);
    }

    spawnNewPiece() {
        if (!this.nextPiece) {
            this.nextPiece = new Tetromino(Math.floor(Math.random() * SHAPES.length));
        }
        this.piece = this.nextPiece;
        this.nextPiece = new Tetromino(Math.floor(Math.random() * SHAPES.length));
        if (this.board.collide(this.piece)) {
            this.boardSnapshot = this.board.grid.map(row => [...row]);
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
            if (dy === 1) this.lockPiece();
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
        if (this.interval) {
            this.stop();
            this.start(this.getIntervalTime());
        }
        if (!this.spawnNewPiece()) return;
    }

    drop() {
        while (this.move(0, 1)) {}
    }

    start(intervalTime) {
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
        // Отрисовка следующей фигуры
        this.nextCtx.clearRect(0, 0, 120, 120);
        if (this.nextPiece) {
            const shape = this.nextPiece.shape;
            const color = this.nextPiece.color;
            const blockSize = 20;
            const offsetX = (120 - shape[0].length * blockSize) / 2;
            const offsetY = (120 - shape.length * blockSize) / 2;
            shape.forEach((row, dy) => {
                row.forEach((value, dx) => {
                    if (value) {
                        this.nextCtx.fillStyle = color;
                        this.nextCtx.fillRect(offsetX + dx * blockSize, offsetY + dy * blockSize, blockSize-1, blockSize-1);
                    }
                });
            });
        }
        document.getElementById('score').textContent = this.board.score;
        document.getElementById('level').textContent = this.board.level;
    }

    continueAfterAd() {
        if (this.boardSnapshot) {
            this.board.grid = this.boardSnapshot.map(row => [...row]);
            // Удаляем одну заполненную строку сверху (чтобы освободить место)
            for (let y = 0; y < ROWS; y++) {
                if (this.board.grid[y].every(cell => cell !== null)) {
                    this.board.grid.splice(y, 1);
                    this.board.grid.unshift(Array(COLS).fill(null));
                    break;
                }
            }
            this.boardSnapshot = null;
        }
        this.gameOver = false;
        this.spawnNewPiece();
        this.start(this.getIntervalTime());
        this.draw();
    }
}

// --- Реклама (заглушка, позже заменим на AdsGram) ---
let adReady = false;
function loadRewardedAd() {
    console.log('AdsGram: загрузка...');
    setTimeout(() => {
        adReady = true;
        console.log('AdsGram: реклама готова');
    }, 2000);
}
function showRewardedAd(callback) {
    if (!adReady) {
        alert('Реклама ещё не готова, попробуйте позже');
        return;
    }
    console.log('AdsGram: показ...');
    setTimeout(() => {
        console.log('AdsGram: награда');
        adReady = false;
        callback();
        loadRewardedAd();
    }, 3000);
}

// --- Инициализация игры ---
let currentGame;

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('board');
    const nextCanvas = document.getElementById('nextCanvas');
    startNewGame(canvas, nextCanvas);

    document.getElementById('new-game').addEventListener('click', () => {
        startNewGame(canvas, nextCanvas);
    });

    // Клавиатура
    document.addEventListener('keydown', (e) => {
        if (!currentGame || currentGame.gameOver) return;
        switch(e.key) {
            case 'ArrowLeft': currentGame.move(-1, 0); break;
            case 'ArrowRight': currentGame.move(1, 0); break;
            case 'ArrowDown': currentGame.move(0, 1); break;
            case 'ArrowUp': currentGame.rotate(); break;
            case ' ': currentGame.drop(); e.preventDefault(); break;
        }
        currentGame.draw();
    });

    // Свайпы
    setupSwipeControls(currentGame);

    // Модалка Game Over
    document.getElementById('watch-ad').addEventListener('click', () => {
        showRewardedAd(() => {
            document.getElementById('game-over').classList.add('hidden');
            if (currentGame) currentGame.continueAfterAd();
        });
    });
    document.getElementById('restart').addEventListener('click', () => {
        document.getElementById('game-over').classList.add('hidden');
        startNewGame(canvas, nextCanvas);
    });

    loadRewardedAd(); // предзагрузка
});

function startNewGame(canvas, nextCanvas) {
    if (currentGame) currentGame.stop();
    currentGame = new Game(canvas, nextCanvas, (score) => {
        document.getElementById('final-score').textContent = score;
        document.getElementById('game-over').classList.remove('hidden');
    });
    currentGame.start(currentGame.getIntervalTime());
    currentGame.draw();
}

function setupSwipeControls(game) {
    let touchStartX = 0, touchStartY = 0;
    const minSwipe = 30;
    document.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    });
    document.addEventListener('touchend', (e) => {
        if (!game || game.gameOver) return;
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const dx = touchEndX - touchStartX;
        const dy = touchEndY - touchStartY;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > minSwipe) {
            if (dx > 0) game.move(1, 0);
            else game.move(-1, 0);
        } else if (Math.abs(dy) > minSwipe) {
            if (dy > 0) game.move(0, 1);
            else game.rotate();
        }
        game.draw();
    });
}