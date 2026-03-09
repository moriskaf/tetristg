// Глобальные переменные
let currentGame;
let adReady = false; // флаг, загружена ли реклама

// Инициализация после загрузки страницы
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('board');
    startNewGame(canvas);

    // Кнопка новой игры
    document.getElementById('new-game').addEventListener('click', () => {
        startNewGame(canvas);
    });

    // Обработка клавиш
    document.addEventListener('keydown', (e) => {
        if (!currentGame || currentGame.gameOver) return;
        switch(e.key) {
            case 'ArrowLeft':  currentGame.move(-1, 0); break;
            case 'ArrowRight': currentGame.move(1, 0); break;
            case 'ArrowDown':  currentGame.move(0, 1); break;
            case 'ArrowUp':    currentGame.rotate(); break;
            case ' ':          currentGame.drop(); e.preventDefault(); break;
        }
        currentGame.draw();
    });

    // Мобильное управление через кнопки (можно добавить)
    // Также можно добавить свайпы, но для простоты оставим так.

    // Кнопка "Смотреть рекламу"
    document.getElementById('watch-ad').addEventListener('click', () => {
        showRewardedAd();
    });

    // Кнопка "Начать заново" в модалке
    document.getElementById('restart').addEventListener('click', () => {
        document.getElementById('game-over').classList.add('hidden');
        startNewGame(canvas);
    });

    // Telegram BackButton – закрыть приложение
    tg.BackButton.onClick(() => tg.close());
});

function startNewGame(canvas) {
    if (currentGame) {
        currentGame.stop();
    }
    currentGame = new Game(canvas, (score) => {
        // Показываем модалку Game Over
        document.getElementById('final-score').textContent = score;
        document.getElementById('game-over').classList.remove('hidden');
        // Загружаем рекламу заранее (если ещё не загружена)
        loadRewardedAd();
    });
    currentGame.start();
    currentGame.draw();
}