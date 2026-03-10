// Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();

if (tg.BackButton && tg.BackButton.show) {
    tg.BackButton.show();
    tg.BackButton.onClick(() => tg.close());
}

// Цвета темы
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
    { shape: [[1,1,1,1]], color: '#00f0f0' },
    { shape: [[1,1],[1,1]], color: '#f0f000' },
    { shape: [[0,1,0],[1,1,1]], color: '#a000f0' },
    { shape: [[1,0,0],[1,1,1]], color: '#f0a000' },
    { shape: [[0,0,1],[1,1,1]], color: '#0000f0' },
    { shape: [[0,1,1],[1,1,0]], color: '#00f000' },
    { shape: [[1,1,0],[0,1,1]], color: '#f00000' }
];

// ---------- КЛАСС TETROMINO ----------
class Tetromino {
    constructor(shapeIndex) {
        const data = SHAPES[shapeIndex];
        this.shape = data.shape.map(row => [...row]);
        this.color = data.color;
        this.x = Math.floor((COLS - this.shape[0].length) / 2);
        this.y = 0;
    }
    rotate() {
        return this.shape[0].map((_, i) => this.shape.map(row => row[i]).reverse());
    }
}

// ---------- КЛАСС BOARD (эффект «бум» за 3 кадра) ----------
class Board {
    constructor() {
        this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
        this.score = 0;
        this.level = 0;
        this.lines = 0;
        this.linesToAnimate = [];
        this.animationTimer = 0;
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
                this.linesToAnimate.push(y);
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
            // Очень быстрая анимация: всего 3 кадра
            this.animationTimer = 3;
        }
    }
    draw(ctx) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        // Отрисовка всех клеток
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

        // Эффект исчезновения (3 кадра)
        if (this.animationTimer > 0) {
            const step = 3 - this.animationTimer; // 0,1,2
            if (step === 0) {
                // Кадр 1: ярко-белый
                ctx.globalAlpha = 1;
                ctx.fillStyle = '#ffffff';
            } else if (step === 1) {
                // Кадр 2: оранжевый полупрозрачный
                ctx.globalAlpha = 0.7;
                ctx.fillStyle = '#ffaa00';
            } else {
                // Кадр 3: прозрачный (почти незаметно, но для завершения)
                ctx.globalAlpha = 0;
            }
            this.linesToAnimate.forEach(y => {
                ctx.fillRect(0, y * BLOCK_SIZE, ctx.canvas.width, BLOCK_SIZE-1);
            });
            ctx.globalAlpha = 1;
            this.animationTimer--;
            if (this.animationTimer === 0) {
                this.linesToAnimate = [];
            }
        }
    }
}

// ---------- КЛАСС GAME (с эффектами, без тени) ----------
class Game {
    static shapeBag = [];
    static bagIndex = 0;

    static getNextShapeIndex() {
        if (Game.shapeBag.length === 0 || Game.bagIndex >= Game.shapeBag.length) {
            Game.shapeBag = [0,1,2,3,4,5,6];
            for (let i = Game.shapeBag.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [Game.shapeBag[i], Game.shapeBag[j]] = [Game.shapeBag[j], Game.shapeBag[i]];
            }
            Game.bagIndex = 0;
        }
        return Game.shapeBag[Game.bagIndex++];
    }

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
        this.lockEffect = 0;
        this.spawnNewPiece();
    }

    getIntervalTime() {
        return Math.max(100, 500 - this.board.level * 30);
    }

    spawnNewPiece() {
        if (!this.nextPiece) {
            this.nextPiece = new Tetromino(Game.getNextShapeIndex());
        }
        this.piece = this.nextPiece;
        this.nextPiece = new Tetromino(Game.getNextShapeIndex());
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
        if (this.gameOver || !this.piece || this.paused) return false;
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
        if (this.gameOver || !this.piece || this.paused) return;
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
        this.lockEffect = 5;
        if (this.interval) {
            this.stop();
            this.start(this.getIntervalTime());
        }
        if (!this.spawnNewPiece()) return;
    }

    drop() {
        if (this.gameOver || this.paused) return;
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

    pause() {
        if (this.gameOver) return;
        this.paused = true;
        this.stop();
    }

    resume() {
        if (this.gameOver) return;
        this.paused = false;
        this.start(this.getIntervalTime());
    }

    draw() {
        this.board.draw(this.ctx);

        // Свечение активной фигуры
        if (this.piece && !this.gameOver) {
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = this.piece.color + '80';

            // Эффект установки (масштабирование)
            if (this.lockEffect > 0) {
                const scale = 1 + 0.1 * (this.lockEffect / 5);
                this.ctx.translate(
                    (this.piece.x + this.piece.shape[0].length / 2) * BLOCK_SIZE,
                    (this.piece.y + this.piece.shape.length / 2) * BLOCK_SIZE
                );
                this.ctx.scale(scale, scale);
                this.ctx.translate(
                    -(this.piece.x + this.piece.shape[0].length / 2) * BLOCK_SIZE,
                    -(this.piece.y + this.piece.shape.length / 2) * BLOCK_SIZE
                );
            }

            // Отрисовка активной фигуры
            this.piece.shape.forEach((row, dy) => {
                row.forEach((value, dx) => {
                    if (value) {
                        this.ctx.fillStyle = this.piece.color;
                        this.ctx.fillRect((this.piece.x + dx) * BLOCK_SIZE, (this.piece.y + dy) * BLOCK_SIZE, BLOCK_SIZE-1, BLOCK_SIZE-1);
                    }
                });
            });

            // Сбрасываем трансформации и тени
            if (this.lockEffect > 0) {
                this.ctx.setTransform(1, 0, 0, 1, 0, 0);
                this.lockEffect--;
            }
            this.ctx.shadowBlur = 0;
            this.ctx.shadowColor = 'transparent';
        }

        // Отрисовка следующей фигуры
        this.drawNext();
        document.getElementById('score').textContent = this.board.score;
        document.getElementById('level').textContent = this.board.level;
    }

    drawNext() {
        this.nextCtx.clearRect(0, 0, 100, 100);
        if (this.nextPiece) {
            const shape = this.nextPiece.shape;
            const color = this.nextPiece.color;
            const blockSize = 20;
            const cols = shape[0].length;
            const rows = shape.length;
            const offsetX = (100 - cols * blockSize) / 2;
            const offsetY = (100 - rows * blockSize) / 2;
            shape.forEach((row, dy) => {
                row.forEach((value, dx) => {
                    if (value) {
                        this.nextCtx.fillStyle = color;
                        this.nextCtx.fillRect(offsetX + dx * blockSize, offsetY + dy * blockSize, blockSize-1, blockSize-1);
                    }
                });
            });
        }
    }

    continueAfterAd() {
        if (this.boardSnapshot) {
            this.board.grid = this.boardSnapshot.map(row => [...row]);
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

// --- Реклама (заглушка) ---
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

// --- Инициализация ---
let currentGame;
const menu = document.getElementById('menu');
const gameWrapper = document.getElementById('game-wrapper');
const canvas = document.getElementById('board');
const nextCanvas = document.getElementById('nextCanvas');

// Кнопка "Играть" в меню (PLAY)
document.getElementById('play-button').addEventListener('click', () => {
    menu.classList.add('hidden');
    gameWrapper.classList.remove('hidden');
    startNewGame(canvas, nextCanvas);
});

// Кнопка "Пауза"
const pauseButton = document.getElementById('pause-button');
const pauseMenu = document.getElementById('pause-menu');
const resumeButton = document.getElementById('resume-button');
const exitToMenu = document.getElementById('exit-to-menu');

pauseButton.addEventListener('click', () => {
    if (currentGame && !currentGame.gameOver && !currentGame.paused) {
        currentGame.pause();
        pauseMenu.classList.remove('hidden');
    }
});

resumeButton.addEventListener('click', () => {
    if (currentGame) {
        currentGame.resume();
        pauseMenu.classList.add('hidden');
    }
});

exitToMenu.addEventListener('click', () => {
    if (currentGame) {
        currentGame.stop();
        currentGame = null;
    }
    gameWrapper.classList.add('hidden');
    menu.classList.remove('hidden');
    pauseMenu.classList.add('hidden');
});

// --- Кнопки управления ---
document.getElementById('move-left').addEventListener('click', () => {
    if (currentGame && !currentGame.gameOver && !currentGame.paused && !gameWrapper.classList.contains('hidden')) {
        currentGame.move(-1, 0);
        currentGame.draw();
    }
});
document.getElementById('move-right').addEventListener('click', () => {
    if (currentGame && !currentGame.gameOver && !currentGame.paused && !gameWrapper.classList.contains('hidden')) {
        currentGame.move(1, 0);
        currentGame.draw();
    }
});
document.getElementById('rotate').addEventListener('click', () => {
    if (currentGame && !currentGame.gameOver && !currentGame.paused && !gameWrapper.classList.contains('hidden')) {
        currentGame.rotate();
        currentGame.draw();
    }
});
document.getElementById('soft-drop').addEventListener('click', () => {
    if (currentGame && !currentGame.gameOver && !currentGame.paused && !gameWrapper.classList.contains('hidden')) {
        currentGame.move(0, 1);
        currentGame.draw();
    }
});

// --- Обработка клавиатуры (опционально) ---
document.addEventListener('keydown', (e) => {
    if (!currentGame || currentGame.gameOver || gameWrapper.classList.contains('hidden')) return;
    if (currentGame.paused) return;
    switch(e.key) {
        case 'ArrowLeft': currentGame.move(-1, 0); break;
        case 'ArrowRight': currentGame.move(1, 0); break;
        case 'ArrowDown': currentGame.move(0, 1); break;
        case 'ArrowUp': currentGame.rotate(); break;
        case ' ': currentGame.drop(); e.preventDefault(); break;
    }
    currentGame.draw();
});

// --- Запрет скролла при касаниях холста ---
canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
}, { passive: false });

// --- Модалка Game Over ---
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

// --- Предзагрузка рекламы ---
loadRewardedAd();

function startNewGame(canvas, nextCanvas) {
    if (currentGame) currentGame.stop();
    // Сбрасываем мешок для новой игры
    Game.shapeBag = [];
    Game.bagIndex = 0;
    currentGame = new Game(canvas, nextCanvas, (score) => {
        document.getElementById('final-score').textContent = score;
        document.getElementById('game-over').classList.remove('hidden');
    });
    currentGame.start(currentGame.getIntervalTime());
    currentGame.draw();
}