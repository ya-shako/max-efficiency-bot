class EfficiencyApp {
    constructor() {
        this.tasks = [];
        this.currentTab = 'checklist';
        this.timerInterval = null;
        this.timerTime = 25 * 60;
        this.isTimerRunning = false;
        this.isBreakTime = false;
        this.sessionsCount = 0;

        // Используем асинхронную инициализацию
        this.initAsync();
    }

    async initAsync() {
        console.log('🚀 App initialization started');
        await this.loadTasks();
        this.setupEventListeners();
        this.renderTasks();
        this.showNextUnprioritizedTask();
        this.updateTimerDisplay();

        // Сообщаем MAX, что приложение готово
        if (window.WebApp) {
            window.WebApp.ready();
            console.log('✅ MAX Bridge ready');
        }
        
        console.log('✅ App initialized successfully');
    }

    // Хранение задач
    async loadTasks() {
        try {
            let saved = null;
            
            if (window.WebApp && window.WebApp.DeviceStorage) {
                // Для MAX Bridge - получаем значение (может быть Promise)
                const result = window.WebApp.DeviceStorage.getItem('efficiency_tasks');
                
                // Обрабатываем как Promise, если это Promise
                if (result && typeof result.then === 'function') {
                    saved = await result;
                } else {
                    saved = result;
                }
                console.log('📦 Loaded from MAX Storage:', saved);
            } else {
                // Fallback для локального хранилища
                saved = localStorage.getItem('efficiency_tasks');
                console.log('📦 Loaded from Local Storage:', saved);
            }
            
            if (saved && saved !== 'null' && saved !== 'undefined' && saved !== '[object Promise]') {
                this.tasks = JSON.parse(saved);
                console.log('✅ Tasks loaded:', this.tasks.length);
            } else {
                this.tasks = [];
                console.log('✅ No saved tasks, using empty array');
            }
        } catch (error) {
            console.error('❌ Error loading tasks:', error);
            this.tasks = [];
        }
    }

    async saveTasks() {
        try {
            const data = JSON.stringify(this.tasks);
            
            if (window.WebApp && window.WebApp.DeviceStorage) {
                const result = window.WebApp.DeviceStorage.setItem('efficiency_tasks', data);
                
                // Обрабатываем как Promise, если это Promise
                if (result && typeof result.then === 'function') {
                    await result;
                }
                console.log('💾 Saved to MAX Storage');
            } else {
                localStorage.setItem('efficiency_tasks', data);
                console.log('💾 Saved to Local Storage');
            }
        } catch (error) {
            console.error('❌ Error saving tasks:', error);
        }
    }

    // Навигация
    setupEventListeners() {
        console.log('🔧 Setting up event listeners');
        
        // Переключение вкладок
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                console.log('🎯 Tab clicked:', e.target.dataset.tab);
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Чеклист
        const addTaskBtn = document.getElementById('addTaskBtn');
        const saveTaskBtn = document.getElementById('saveTaskBtn');
        const cancelTaskBtn = document.getElementById('cancelTaskBtn');

        if (addTaskBtn) {
            addTaskBtn.addEventListener('click', () => {
                console.log('🎯 Add task button clicked');
                this.showTaskForm();
            });
        }

        if (saveTaskBtn) {
            saveTaskBtn.addEventListener('click', async () => {
                console.log('🎯 Save task button clicked');
                await this.saveNewTask();
            });
        }

        if (cancelTaskBtn) {
            cancelTaskBtn.addEventListener('click', () => {
                console.log('🎯 Cancel task button clicked');
                this.hideTaskForm();
            });
        }

        // Помодоро таймер
        const startTimerBtn = document.getElementById('startTimerBtn');
        const pauseTimerBtn = document.getElementById('pauseTimerBtn');
        const resetTimerBtn = document.getElementById('resetTimerBtn');
        const workTimeInput = document.getElementById('workTime');

        if (startTimerBtn) {
            startTimerBtn.addEventListener('click', () => {
                console.log('🎯 Start timer clicked');
                this.startTimer();
            });
        }

        if (pauseTimerBtn) {
            pauseTimerBtn.addEventListener('click', () => {
                console.log('🎯 Pause timer clicked');
                this.pauseTimer();
            });
        }

        if (resetTimerBtn) {
            resetTimerBtn.addEventListener('click', () => {
                console.log('🎯 Reset timer clicked');
                this.resetTimer();
            });
        }

        if (workTimeInput) {
            workTimeInput.addEventListener('change', (e) => {
                if (!this.isTimerRunning) {
                    this.timerTime = parseInt(e.target.value) * 60;
                    this.updateTimerDisplay();
                }
            });
        }

        // GTD свайпы
        this.setupSwipeEvents();
        
        console.log('✅ All event listeners set up');
    }

    switchTab(tabName) {
        console.log('🔄 Switching to tab:', tabName);
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
        const taskForm = document.getElementById('taskForm');
        const taskInput = document.getElementById('taskInput');
        
        if (taskForm && taskInput) {
            taskForm.style.display = 'block';
            taskInput.focus();
            console.log('📝 Task form shown');
        }
    }

    hideTaskForm() {
        const taskForm = document.getElementById('taskForm');
        const taskInput = document.getElementById('taskInput');
        const taskDeadline = document.getElementById('taskDeadline');
        const taskPriority = document.getElementById('taskPriority');
        
        if (taskForm) taskForm.style.display = 'none';
        if (taskInput) taskInput.value = '';
        if (taskDeadline) taskDeadline.value = '';
        if (taskPriority) taskPriority.value = '';
        
        console.log('📝 Task form hidden');
    }

    async saveNewTask() {
        const taskInput = document.getElementById('taskInput');
        const taskDeadline = document.getElementById('taskDeadline');
        const taskPriority = document.getElementById('taskPriority');

        if (!taskInput) return;

        const text = taskInput.value.trim();
        const deadline = taskDeadline ? taskDeadline.value : '';
        const priority = taskPriority ? taskPriority.value : '';

        if (!text) {
            console.log('⚠️ Task text is empty');
            return;
        }

        const task = {
            id: Date.now(),
            text: text,
            deadline: deadline,
            priority: priority,
            completed: false,
            createdAt: new Date().toISOString()
        };

        this.tasks.push(task);
        await this.saveTasks();
        this.renderTasks();
        this.hideTaskForm();

        console.log('✅ New task saved:', task.text);

        // Вибрация при успешном добавлении
        if (window.WebApp && window.WebApp.HapticFeedback) {
            window.WebApp.HapticFeedback.impactOccurred('light');
        }
    }

    renderTasks() {
        const tasksList = document.getElementById('tasksList');
        if (!tasksList) {
            console.log('❌ Tasks list container not found');
            return;
        }

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
        console.log('✅ Tasks rendered:', this.tasks.length);
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
                    ${!task.completed ? `<button class="complete-btn" data-task-id="${task.id}">✓</button>` : ''}
                    <button class="delete-btn" data-task-id="${task.id}">×</button>
                </div>
            </div>
        `;
    }

    async completeTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = true;
            await this.saveTasks();
            this.renderTasks();
            console.log('✅ Task completed:', task.text);

            if (window.WebApp && window.WebApp.HapticFeedback) {
                window.WebApp.HapticFeedback.notificationOccurred('success');
            }
        }
    }

    async deleteTask(taskId) {
        this.tasks = this.tasks.filter(t => t.id !== taskId);
        await this.saveTasks();
        this.renderTasks();
        this.showNextUnprioritizedTask();
        console.log('🗑️ Task deleted:', taskId);
    }

    // GTD функционал
    setupSwipeEvents() {
        const currentTaskEl = document.getElementById('currentTask');
        if (!currentTaskEl) {
            console.log('❌ Current task element not found');
            return;
        }

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
                        console.log('🎯 Priority assigned:', priority);
                    }
                }
            }
            
            startX = startY = null;
        });
        
        console.log('✅ Swipe events set up');
    }

    getCurrentUnprioritizedTask() {
        return this.tasks.find(task => !task.completed && !task.priority);
    }

    showNextUnprioritizedTask() {
        const currentTaskEl = document.getElementById('currentTask');
        if (!currentTaskEl) return;

        const currentTask = this.getCurrentUnprioritizedTask();
        
        if (currentTask) {
            currentTaskEl.innerHTML = `
                <div class="task-card">${currentTask.text}</div>
                <div class="swipe-hint">Свайпните в нужный угол для приоритета</div>
            `;
            const noTasksMessage = document.getElementById('noTasksMessage');
            if (noTasksMessage) noTasksMessage.style.display = 'none';
        } else {
            currentTaskEl.innerHTML = '<p id="noTasksMessage">Все задачи расставлены! 🎉</p>';
        }
    }

    async assignPriority(taskId, priority) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.priority = priority;
            await this.saveTasks();
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
        const startBtn = document.getElementById('startTimerBtn');
        const pauseBtn = document.getElementById('pauseTimerBtn');
        
        if (startBtn) startBtn.disabled = true;
        if (pauseBtn) pauseBtn.disabled = false;

        this.timerInterval = setInterval(() => {
            this.timerTime--;
            this.updateTimerDisplay();

            if (this.timerTime <= 0) {
                this.timerComplete();
            }
        }, 1000);
        
        console.log('⏰ Timer started');
    }

    pauseTimer() {
        this.isTimerRunning = false;
        clearInterval(this.timerInterval);
        
        const startBtn = document.getElementById('startTimerBtn');
        const pauseBtn = document.getElementById('pauseTimerBtn');
        
        if (startBtn) startBtn.disabled = false;
        if (pauseBtn) pauseBtn.disabled = true;
        
        console.log('⏰ Timer paused');
    }

    resetTimer() {
        this.pauseTimer();
        const workTimeInput = document.getElementById('workTime');
        const workTime = workTimeInput ? parseInt(workTimeInput.value) : 25;
        
        this.timerTime = workTime * 60;
        this.isBreakTime = false;
        this.updateTimerDisplay();
        
        console.log('⏰ Timer reset');
    }

    timerComplete() {
        this.pauseTimer();
        this.sessionsCount++;
        
        const sessionsCountEl = document.getElementById('sessionsCount');
        if (sessionsCountEl) sessionsCountEl.textContent = this.sessionsCount;

        // Переключаем между работой и отдыхом
        this.isBreakTime = !this.isBreakTime;
        const workTimeInput = document.getElementById('workTime');
        const breakTimeInput = document.getElementById('breakTime');
        
        const workTime = workTimeInput ? parseInt(workTimeInput.value) : 25;
        const breakTime = breakTimeInput ? parseInt(breakTimeInput.value) : 5;
        
        const time = this.isBreakTime ? breakTime : workTime;
        this.timerTime = time * 60;
        this.updateTimerDisplay();

        console.log('⏰ Timer complete, sessions:', this.sessionsCount);

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
        
        const minutesEl = document.getElementById('timerMinutes');
        const secondsEl = document.getElementById('timerSeconds');
        
        if (minutesEl) minutesEl.textContent = minutes;
        if (secondsEl) secondsEl.textContent = seconds;

        // Изменяем цвет в зависимости от режима
        const display = minutesEl ? minutesEl.parentElement : null;
        if (display) {
            display.style.color = this.isBreakTime ? '#28a745' : '#dc3545';
        }
    }
}

// Глобальные обработчики для кнопок задач
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('complete-btn')) {
        const taskId = parseInt(e.target.getAttribute('data-task-id'));
        app.completeTask(taskId);
    } else if (e.target.classList.contains('delete-btn')) {
        const taskId = parseInt(e.target.getAttribute('data-task-id'));
        app.deleteTask(taskId);
    }
});

// Инициализация приложения когда DOM готов
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM fully loaded');
    window.app = new EfficiencyApp();
});

// Fallback на случай если DOM уже загружен
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        window.app = new EfficiencyApp();
    });
} else {
    window.app = new EfficiencyApp();
}
