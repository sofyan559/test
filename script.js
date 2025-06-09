// Enhanced Kanban functionality with drag and drop

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
        updateButtons(task);
    });

    // Sample tasks to show the board on first load
    ['Research project', 'Prepare slides', 'Team meeting'].forEach(text => {
        const task = createTask(text);
        todoList.appendChild(task);
        updateButtons(task);
    });

    function createTask(text) {
        const li = document.createElement('li');
        li.className = 'task';
        li.setAttribute('draggable', 'true');
        li.addEventListener('dragstart', () => li.classList.add('dragging'));
        li.addEventListener('dragend', () => li.classList.remove('dragging'));

        const span = document.createElement('span');
        span.textContent = text;
        const prevBtn = document.createElement('button');
        prevBtn.textContent = '<';
        prevBtn.className = 'prev';
        prevBtn.addEventListener('click', () => moveTask(li, -1));
        const nextBtn = document.createElement('button');
        nextBtn.textContent = '>';
        nextBtn.className = 'next';
        nextBtn.addEventListener('click', () => moveTask(li, 1));
        li.appendChild(span);
        li.appendChild(prevBtn);
        li.appendChild(nextBtn);
        return li;
    }

    // Drag and drop target handling
    lists.forEach(list => {
        list.addEventListener('dragover', (e) => {
            e.preventDefault();
            const dragging = document.querySelector('.dragging');
            if (dragging && dragging.parentElement !== list) {
                list.appendChild(dragging);
                updateButtons(dragging);
            }
        });
    });

    function moveTask(li, dir) {
        const parent = li.parentElement;
        let index = lists.indexOf(parent);
        if (dir === 1 && parent === doneList) {
            parent.removeChild(li); // delete
            return;
        }
        const targetIndex = index + dir;
        if (targetIndex >= 0 && targetIndex < lists.length) {
            lists[targetIndex].appendChild(li);
            updateButtons(li);
        }
    }

    function updateButtons(li) {
        const parent = li.parentElement;
        const prevBtn = li.querySelector('.prev');
        const nextBtn = li.querySelector('.next');
        prevBtn.disabled = parent === todoList;
        if (parent === doneList) {
            nextBtn.textContent = 'Delete';
        } else {
            nextBtn.textContent = '>';
        }
    }
});
