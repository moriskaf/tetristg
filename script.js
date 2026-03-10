// ---------- В класс Board добавляем ----------
class Board {
    constructor() {
        // ... существующие поля
        this.linesToAnimate = [];
        this.animationTimer = 0;
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
            this.animationTimer = 10; // 10 кадров анимации
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

        // Анимация удаления линий
        if (this.animationTimer > 0) {
            ctx.globalAlpha = 0.3 * (this.animationTimer / 10);
            ctx.fillStyle = '#ffffff';
            this.linesToAnimate.forEach(y => {
                ctx.fillRect(0, y * BLOCK_SIZE, ctx.canvas.width, BLOCK_SIZE-1);
            });
            ctx.globalAlpha = 1.0;
            this.animationTimer--;
        } else {
            this.linesToAnimate = [];
        }
    }
}

// ---------- В класс Game добавляем ----------
class Game {
    constructor(canvas, nextCanvas, onGameOver) {
        // ... существующие поля
        this.lockEffect = 0; // для анимации установки
    }

    lockPiece() {
        this.board.addPiece(this.piece);
        this.board.clearLines();
        this.lockEffect = 5; // 5 кадров эффекта
        if (this.interval) {
            this.stop();
            this.start(this.getIntervalTime());
        }
        if (!this.spawnNewPiece()) return;
    }

    drawGhost() {
        const originalX = this.piece.x;
        const originalY = this.piece.y;
        // Опускаем фигуру до столкновения
        while (!this.board.collide(this.piece)) {
            this.piece.y++;
        }
        this.piece.y--;

        ctx.globalAlpha = 0.3;
        this.piece.shape.forEach((row, dy) => {
            row.forEach((value, dx) => {
                if (value) {
                    ctx.fillStyle = this.piece.color;
                    ctx.fillRect((this.piece.x + dx) * BLOCK_SIZE, (this.piece.y + dy) * BLOCK_SIZE, BLOCK_SIZE-1, BLOCK_SIZE-1);
                }
            });
        });
        ctx.globalAlpha = 1.0;

        this.piece.x = originalX;
        this.piece.y = originalY;
    }

    draw() {
        this.board.draw(this.ctx); // теперь Board.draw сам рисует поле и анимации

        // Тень (проекция)
        this.drawGhost();

        // Свечение активной фигуры
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = this.piece.color + '80';

        // Эффект установки (масштабирование)
        if (this.lockEffect > 0) {
            const scale = 1 + 0.1 * (this.lockEffect / 5); // от 1.1 до 1
            this.ctx.translate(this.piece.x * BLOCK_SIZE + this.piece.shape[0].length * BLOCK_SIZE / 2,
                               this.piece.y * BLOCK_SIZE + this.piece.shape.length * BLOCK_SIZE / 2);
            this.ctx.scale(scale, scale);
            this.ctx.translate(-(this.piece.x * BLOCK_SIZE + this.piece.shape[0].length * BLOCK_SIZE / 2),
                               -(this.piece.y * BLOCK_SIZE + this.piece.shape.length * BLOCK_SIZE / 2));
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

        // Отрисовка следующей фигуры
        this.drawNext();

        document.getElementById('score').textContent = this.board.score;
        document.getElementById('level').textContent = this.board.level;
    }
}