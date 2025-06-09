// Basic Kanban functionality with drag and drop

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('todo-form');
    const input = document.getElementById('new-task');
    const todoList = document.getElementById('todo-list');
    const progressList = document.getElementById('progress-list');
    const doneList = document.getElementById('done-list');

    const lists = [todoList, progressList, doneList];

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        const task = createTask(text);
        todoList.appendChild(task);
        input.value = '';
    });

    ['Research project', 'Prepare slides', 'Team meeting'].forEach(text => {
        todoList.appendChild(createTask(text));
    });

    function createTask(text) {
        const li = document.createElement('li');
        li.className = 'task';
        li.setAttribute('draggable', 'true');
        li.addEventListener('dragstart', () => li.classList.add('dragging'));
        li.addEventListener('dragend', () => li.classList.remove('dragging'));

        const span = document.createElement('span');
        span.textContent = text;

        const delBtn = document.createElement('button');
        delBtn.textContent = '✖';
        delBtn.className = 'delete';
        delBtn.addEventListener('click', () => li.remove());

        li.appendChild(span);
        li.appendChild(delBtn);
        return li;
    }

    lists.forEach(list => {
        list.addEventListener('dragover', e => {
            e.preventDefault();
            const dragging = document.querySelector('.dragging');
            if (dragging && dragging.parentElement !== list) {
                list.appendChild(dragging);
            }
        });
        list.addEventListener('dragenter', () => list.classList.add('highlight'));
        list.addEventListener('dragleave', () => list.classList.remove('highlight'));
        list.addEventListener('drop', () => list.classList.remove('highlight'));
    });
});
