// Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();

// --- Переменные темы и сложности ---
let currentTheme = 'system';
let currentDifficulty = 'normal';

// Загрузка настроек из localStorage
function loadSettings() {
    const savedTheme = localStorage.getItem('tetris_theme');
    const savedDifficulty = localStorage.getItem('tetris_difficulty');
    if (savedTheme) currentTheme = savedTheme;
    if (savedDifficulty) currentDifficulty = savedDifficulty;
    applyTheme();
}
function applyTheme() {
    const body = document.body;
    if (currentTheme === 'light') {
        body.classList.add('light-theme');
        // Принудительно задаём цвета через CSS-переменные (они уже есть в классе)
    } else if (currentTheme === 'dark') {
        body.classList.remove('light-theme');
    } else { // system
        body.classList.remove('light-theme');
        // Цвета из Telegram уже установлены в начале
    }
}

// Сохранение настроек
function saveSettings(theme, difficulty) {
    currentTheme = theme;
    currentDifficulty = difficulty;
    localStorage.setItem('tetris_theme', theme);
    localStorage.setItem('tetris_difficulty', difficulty);
    applyTheme();
}

// --- Виброотклик ---
function vibrate(pattern = 10) {
    if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(pattern);
    }
}

// Константы игры
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

// ---------- КЛАСС ЧАСТИЦЫ ----------
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 1) * 3;
        this.size = Math.random() * 4 + 2;
        this.color = color;
        this.alpha = 1;
        this.life = 1;
        this.decay = 0.02 + Math.random() * 0.03;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.2;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.1;
        this.vx *= 0.99;
        this.vy *= 0.99;
        this.life -= this.decay;
        this.alpha = this.life;
        this.rotation += this.rotationSpeed;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
        ctx.restore();
    }
}

// ---------- КЛАСС BOARD ----------
class Board {
    constructor(difficulty) {
        this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
        this.score = 0;
        this.level = 0;
        this.lines = 0;
        this.particles = [];
        this.difficulty = difficulty || 'normal';
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
    addGarbageLine() {
        if (this.difficulty !== 'hard') return;
        if (Math.random() > 0.2) return;
        this.grid.shift();
        const garbageRow = Array(COLS).fill(null);
        for (let x = 0; x < COLS; x++) {
            if (Math.random() > 0.3) {
                garbageRow[x] = '#555';
            }
        }
        this.grid.push(garbageRow);
    }
    clearLines() {
        let cleared = 0;
        for (let y = ROWS - 1; y >= 0; ) {
            if (this.grid[y].every(cell => cell !== null)) {
                for (let x = 0; x < COLS; x++) {
                    const color = this.grid[y][x];
                    for (let i = 0; i < 5; i++) {
                        const px = x * BLOCK_SIZE + BLOCK_SIZE/2 + (Math.random() - 0.5) * 10;
                        const py = y * BLOCK_SIZE + BLOCK_SIZE/2 + (Math.random() - 0.5) * 10;
                        this.particles.push(new Particle(px, py, color));
                    }
                }
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
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.draw(ctx);
            if (p.life <= 0 || p.y > ctx.canvas.height + 50) {
                this.particles.splice(i, 1);
            }
        }
    }
}

// ---------- КЛАСС GAME ----------
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

    constructor(canvas, nextCanvas, onGameOver, difficulty) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.nextCanvas = nextCanvas;
        this.nextCtx = nextCanvas.getContext('2d');
        this.board = new Board(difficulty);
        this.piece = null;
        this.nextPiece = null;
        this.gameOver = false;
        this.paused = false;
        this.interval = null;
        this.onGameOver = onGameOver;
        this.boardSnapshot = null;
        this.lockEffect = 0;
        this.animationFrame = null;
        this.difficulty = difficulty;
        this.spawnNewPiece();
        this.startAnimationLoop();
    }

    startAnimationLoop() {
        const loop = () => {
            if (!this.paused && !this.gameOver) {
                this.board.particles.forEach(p => p.update());
            }
            this.draw();
            this.animationFrame = requestAnimationFrame(loop);
        };
        this.animationFrame = requestAnimationFrame(loop);
    }

    getIntervalTime() {
        const baseSpeed = { easy: 600, normal: 500, hard: 400 }[this.difficulty] || 500;
        return Math.max(100, baseSpeed - this.board.level * 30);
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
        if (this.difficulty === 'hard') {
            this.board.addGarbageLine();
        }
        this.lockEffect = 5;
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = setInterval(() => {
                if (!this.paused && !this.gameOver) {
                    this.move(0, 1);
                }
            }, this.getIntervalTime());
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
            }
        }, intervalTime);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    pause() {
        if (this.gameOver) return;
        this.paused = true;
        if (this.interval) clearInterval(this.interval);
    }

    resume() {
        if (this.gameOver) return;
        this.paused = false;
        this.start(this.getIntervalTime());
    }

    draw() {
        this.board.draw(this.ctx);

        if (this.piece && !this.gameOver) {
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = this.piece.color + '80';

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

            this.piece.shape.forEach((row, dy) => {
                row.forEach((value, dx) => {
                    if (value) {
                        this.ctx.fillStyle = this.piece.color;
                        this.ctx.fillRect((this.piece.x + dx) * BLOCK_SIZE, (this.piece.y + dy) * BLOCK_SIZE, BLOCK_SIZE-1, BLOCK_SIZE-1);
                    }
                });
            });

            if (this.lockEffect > 0) {
                this.ctx.setTransform(1, 0, 0, 1, 0, 0);
                this.lockEffect--;
            }
            this.ctx.shadowBlur = 0;
            this.ctx.shadowColor = 'transparent';
        }

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

// Загружаем настройки
loadSettings();

// Кнопка PLAY
document.getElementById('play-button').addEventListener('click', () => {
    menu.classList.add('hidden');
    gameWrapper.classList.remove('hidden');
    startNewGame(canvas, nextCanvas, currentDifficulty);
    vibrate(20);
});

// Кнопка Settings
document.getElementById('settings-button').addEventListener('click', () => {
    document.getElementById('settings-modal').classList.remove('hidden');
    const theme = currentTheme;
    document.querySelectorAll('.theme-buttons button').forEach(btn => btn.classList.remove('active'));
    if (theme === 'light') document.getElementById('theme-light').classList.add('active');
    else if (theme === 'dark') document.getElementById('theme-dark').classList.add('active');
    else document.getElementById('theme-system').classList.add('active');
    document.getElementById('difficulty-select').value = currentDifficulty;
});

// Настройки темы
document.getElementById('theme-light').addEventListener('click', () => {
    document.querySelectorAll('.theme-buttons button').forEach(btn => btn.classList.remove('active'));
    document.getElementById('theme-light').classList.add('active');
});
document.getElementById('theme-dark').addEventListener('click', () => {
    document.querySelectorAll('.theme-buttons button').forEach(btn => btn.classList.remove('active'));
    document.getElementById('theme-dark').classList.add('active');
});
document.getElementById('theme-system').addEventListener('click', () => {
    document.querySelectorAll('.theme-buttons button').forEach(btn => btn.classList.remove('active'));
    document.getElementById('theme-system').classList.add('active');
});

// Сохранение настроек
document.getElementById('save-settings').addEventListener('click', () => {
    let theme = 'system';
    if (document.getElementById('theme-light').classList.contains('active')) theme = 'light';
    else if (document.getElementById('theme-dark').classList.contains('active')) theme = 'dark';
    const difficulty = document.getElementById('difficulty-select').value;
    saveSettings(theme, difficulty);
    document.getElementById('settings-modal').classList.add('hidden');
    vibrate(10);
});

// Кнопка паузы
const pauseButton = document.getElementById('pause-button');
const pauseMenu = document.getElementById('pause-menu');
const resumeButton = document.getElementById('resume-button');
const exitToMenu = document.getElementById('exit-to-menu');

pauseButton.addEventListener('click', () => {
    if (currentGame && !currentGame.gameOver && !currentGame.paused) {
        currentGame.pause();
        pauseMenu.classList.remove('hidden');
        vibrate(10);
    }
});

resumeButton.addEventListener('click', () => {
    if (currentGame) {
        currentGame.resume();
        pauseMenu.classList.add('hidden');
        vibrate(10);
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
    vibrate(10);
});

// Кнопки управления
document.getElementById('move-left').addEventListener('click', () => {
    if (currentGame && !currentGame.gameOver && !currentGame.paused && !gameWrapper.classList.contains('hidden')) {
        currentGame.move(-1, 0);
        currentGame.draw();
        vibrate(5);
    }
});
document.getElementById('move-right').addEventListener('click', () => {
    if (currentGame && !currentGame.gameOver && !currentGame.paused && !gameWrapper.classList.contains('hidden')) {
        currentGame.move(1, 0);
        currentGame.draw();
        vibrate(5);
    }
});
document.getElementById('rotate').addEventListener('click', () => {
    if (currentGame && !currentGame.gameOver && !currentGame.paused && !gameWrapper.classList.contains('hidden')) {
        currentGame.rotate();
        currentGame.draw();
        vibrate(5);
    }
});
document.getElementById('soft-drop').addEventListener('click', () => {
    if (currentGame && !currentGame.gameOver && !currentGame.paused && !gameWrapper.classList.contains('hidden')) {
        currentGame.move(0, 1);
        currentGame.draw();
        vibrate(5);
    }
});

// Клавиатура (опционально)
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

// Запрет скролла на canvas
canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

// Модалки Game Over
document.getElementById('watch-ad').addEventListener('click', () => {
    vibrate(15);
    showRewardedAd(() => {
        document.getElementById('game-over').classList.add('hidden');
        if (currentGame) currentGame.continueAfterAd();
    });
});
document.getElementById('restart').addEventListener('click', () => {
    vibrate(15);
    document.getElementById('game-over').classList.add('hidden');
    startNewGame(canvas, nextCanvas, currentDifficulty);
});

// Закрытие модалок по клику вне
document.querySelectorAll('.overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.add('hidden');
        }
    });
});

// Предзагрузка рекламы
loadRewardedAd();

// Функция старта новой игры
function startNewGame(canvas, nextCanvas, difficulty) {
    if (currentGame) {
        currentGame.stop();
        currentGame = null;
    }
    Game.shapeBag = [];
    Game.bagIndex = 0;
    currentGame = new Game(canvas, nextCanvas, (score) => {
        document.getElementById('final-score').textContent = score;
        document.getElementById('game-over').classList.remove('hidden');
    }, difficulty);
    currentGame.start(currentGame.getIntervalTime());
    currentGame.draw();
}