class EfficiencyApp {
    constructor() {
        this.tasks = [];
        this.currentTab = 'checklist';
        this.timerInterval = null;
        this.timerTime = 25 * 60;
        this.isTimerRunning = false;
        this.isBreakTime = false;
        this.sessionsCount = 0;

        this.init();
    }

    init() {
        this.loadTasks();
        this.setupEventListeners();
        this.renderTasks();
        this.showNextUnprioritizedTask();
        this.updateTimerDisplay();

        // Сообщаем MAX, что приложение готово
        if (window.WebApp) {
            window.WebApp.ready();
        }
    }

    // Хранение задач
    loadTasks() {
        if (window.WebApp && window.WebApp.DeviceStorage) {
            const saved = window.WebApp.DeviceStorage.getItem('efficiency_tasks');
            this.tasks = saved ? JSON.parse(saved) : [];
        } else {
            // Fallback для локального хранилища
            const saved = localStorage.getItem('efficiency_tasks');
            this.tasks = saved ? JSON.parse(saved) : [];
        }
    }

    saveTasks() {
        const data = JSON.stringify(this.tasks);
        if (window.WebApp && window.WebApp.DeviceStorage) {
            window.WebApp.DeviceStorage.setItem('efficiency_tasks', data);
        } else {
            localStorage.setItem('efficiency_tasks', data);
        }
    }

    // Навигация
    setupEventListeners() {
        // Переключение вкладок
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Чеклист
        document.getElementById('addTaskBtn').addEventListener('click', () => {
            this.showTaskForm();
        });

        document.getElementById('saveTaskBtn').addEventListener('click', () => {
            this.saveNewTask();
        });

        document.getElementById('cancelTaskBtn').addEventListener('click', () => {
            this.hideTaskForm();
        });

        // Помодоро таймер
        document.getElementById('startTimerBtn').addEventListener('click', () => {
            this.startTimer();
        });

        document.getElementById('pauseTimerBtn').addEventListener('click', () => {
            this.pauseTimer();
        });

        document.getElementById('resetTimerBtn').addEventListener('click', () => {
            this.resetTimer();
        });

        document.getElementById('workTime').addEventListener('change', (e) => {
            if (!this.isTimerRunning) {
                this.timerTime = parseInt(e.target.value) * 60;
                this.updateTimerDisplay();
            }
        });

        // GTD свайпы
        this.setupSwipeEvents();
    }

    switchTab(tabName) {
        this.currentTab = tabName;
        
        // Обновляем активные кнопки
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Показываем активный контент
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabName);
        });

        if (tabName === 'gtd') {
            this.showNextUnprioritizedTask();
        }
    }

    // Чеклист функционал
    showTaskForm() {
        document.getElementById('taskForm').style.display = 'block';
        document.getElementById('taskInput').focus();
    }

    hideTaskForm() {
        document.getElementById('taskForm').style.display = 'none';
        document.getElementById('taskInput').value = '';
        document.getElementById('taskDeadline').value = '';
        document.getElementById('taskPriority').value = '';
    }

    saveNewTask() {
        const text = document.getElementById('taskInput').value.trim();
        const deadline = document.getElementById('taskDeadline').value;
        const priority = document.getElementById('taskPriority').value;

        if (!text) return;

        const task = {
            id: Date.now(),
            text: text,
            deadline: deadline,
            priority: priority,
            completed: false,
            createdAt: new Date().toISOString()
        };

        this.tasks.push(task);
        this.saveTasks();
        this.renderTasks();
        this.hideTaskForm();

        // Вибрация при успешном добавлении
        if (window.WebApp && window.WebApp.HapticFeedback) {
            window.WebApp.HapticFeedback.impactOccurred('light');
        }
    }

    renderTasks() {
        const tasksList = document.getElementById('tasksList');
        const uncompletedTasks = this.tasks.filter(task => !task.completed);
        const completedTasks = this.tasks.filter(task => task.completed);

        let html = '';

        // Невыполненные задачи
        uncompletedTasks.forEach(task => {
            html += this.renderTaskItem(task);
        });

        // Выполненные задачи
        if (completedTasks.length > 0) {
            html += '<div class="completed-header">Выполнено:</div>';
            completedTasks.forEach(task => {
                html += this.renderTaskItem(task);
            });
        }

        tasksList.innerHTML = html || '<p class="no-tasks">Задач пока нет</p>';

        // Добавляем обработчики для новых элементов
        this.attachTaskEventListeners();
    }

    renderTaskItem(task) {
        const deadline = task.deadline ? new Date(task.deadline).toLocaleString('ru-RU') : 'Без срока';
        const priorityClass = task.priority ? task.priority : '';
        
        return `
            <div class="task-item ${priorityClass} ${task.completed ? 'completed' : ''}" data-id="${task.id}">
                <div class="task-info">
                    <div class="task-text">${task.text}</div>
                    <div class="task-deadline">${deadline}</div>
                </div>
                <div class="task-actions">
                    ${!task.completed ? `<button class="complete-btn" onclick="app.completeTask(${task.id})">✓</button>` : ''}
                    <button class="delete-btn" onclick="app.deleteTask(${task.id})">×</button>
                </div>
            </div>
        `;
    }

    attachTaskEventListeners() {
        // Обработчики уже встроены в HTML через onclick
    }

    completeTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = true;
            this.saveTasks();
            this.renderTasks();

            if (window.WebApp && window.WebApp.HapticFeedback) {
                window.WebApp.HapticFeedback.notificationOccurred('success');
            }
        }
    }

    deleteTask(taskId) {
        this.tasks = this.tasks.filter(t => t.id !== taskId);
        this.saveTasks();
        this.renderTasks();
        this.showNextUnprioritizedTask();
    }

    // GTD функционал
    setupSwipeEvents() {
        const currentTaskEl = document.getElementById('currentTask');
        let startX, startY;

        currentTaskEl.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        });

        currentTaskEl.addEventListener('touchend', (e) => {
            if (!startX || !startY) return;

            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            
            const diffX = endX - startX;
            const diffY = endY - startY;
            
            // Определяем направление свайпа
            if (Math.abs(diffX) > 50 || Math.abs(diffY) > 50) {
                const currentTask = this.getCurrentUnprioritizedTask();
                if (currentTask) {
                    let priority = '';
                    
                    if (diffY < -50 && Math.abs(diffX) < Math.abs(diffY)) {
                        // Свайп вверх
                        priority = diffX < 0 ? 'important-urgent' : 'important-not-urgent';
                    } else if (diffY > 50 && Math.abs(diffX) < Math.abs(diffY)) {
                        // Свайп вниз
                        priority = diffX < 0 ? 'urgent-not-important' : 'not-important-not-urgent';
                    }
                    
                    if (priority) {
                        this.assignPriority(currentTask.id, priority);
                    }
                }
            }
            
            startX = startY = null;
        });
    }

    getCurrentUnprioritizedTask() {
        return this.tasks.find(task => !task.completed && !task.priority);
    }

    showNextUnprioritizedTask() {
        const currentTask = this.getCurrentUnprioritizedTask();
        const currentTaskEl = document.getElementById('currentTask');
        
        if (currentTask) {
            currentTaskEl.innerHTML = `
                <div class="task-card">${currentTask.text}</div>
                <div class="swipe-hint">Свайпните в нужный угол для приоритета</div>
            `;
            document.getElementById('noTasksMessage').style.display = 'none';
        } else {
            currentTaskEl.innerHTML = '<p id="noTasksMessage">Все задачи расставлены! 🎉</p>';
        }
    }

    assignPriority(taskId, priority) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.priority = priority;
            this.saveTasks();
            this.renderTasks();
            this.showNextUnprioritizedTask();

            // Тактильная обратная связь
            if (window.WebApp && window.WebApp.HapticFeedback) {
                window.WebApp.HapticFeedback.impactOccurred('medium');
            }
        }
    }

    // Помодоро таймер
    startTimer() {
        if (this.isTimerRunning) return;
        
        this.isTimerRunning = true;
        document.getElementById('startTimerBtn').disabled = true;
        document.getElementById('pauseTimerBtn').disabled = false;

        this.timerInterval = setInterval(() => {
            this.timerTime--;
            this.updateTimerDisplay();

            if (this.timerTime <= 0) {
                this.timerComplete();
            }
        }, 1000);
    }

    pauseTimer() {
        this.isTimerRunning = false;
        clearInterval(this.timerInterval);
        document.getElementById('startTimerBtn').disabled = false;
        document.getElementById('pauseTimerBtn').disabled = true;
    }

    resetTimer() {
        this.pauseTimer();
        const workTime = parseInt(document.getElementById('workTime').value);
        this.timerTime = workTime * 60;
        this.isBreakTime = false;
        this.updateTimerDisplay();
    }

    timerComplete() {
        this.pauseTimer();
        this.sessionsCount++;
        document.getElementById('sessionsCount').textContent = this.sessionsCount;

        // Переключаем между работой и отдыхом
        this.isBreakTime = !this.isBreakTime;
        const time = this.isBreakTime ? 
            parseInt(document.getElementById('breakTime').value) : 
            parseInt(document.getElementById('workTime').value);
        
        this.timerTime = time * 60;
        this.updateTimerDisplay();

        // Уведомление
        if (window.WebApp && window.WebApp.HapticFeedback) {
            window.WebApp.HapticFeedback.notificationOccurred(this.isBreakTime ? 'success' : 'warning');
        }

        // Автозапуск перерыва
        if (this.isBreakTime) {
            setTimeout(() => this.startTimer(), 2000);
        }
    }

    updateTimerDisplay() {
        const minutes = Math.floor(this.timerTime / 60).toString().padStart(2, '0');
        const seconds = (this.timerTime % 60).toString().padStart(2, '0');
        
        document.getElementById('timerMinutes').textContent = minutes;
        document.getElementById('timerSeconds').textContent = seconds;

        // Изменяем цвет в зависимости от режима
        const display = document.getElementById('timerMinutes').parentElement;
        display.style.color = this.isBreakTime ? '#28a745' : '#dc3545';
    }
}

// Инициализация приложения
const app = new EfficiencyApp();