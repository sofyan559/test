document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('todo-form');
    const input = document.getElementById('new-task');
    const list = document.getElementById('todo-list');

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const taskText = input.value.trim();
        if (taskText !== '') {
            const li = document.createElement('li');
            const span = document.createElement('span');
            span.textContent = taskText;
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', () => {
                list.removeChild(li);
            });
            li.appendChild(span);
            li.appendChild(deleteBtn);
            li.addEventListener('click', () => {
                li.classList.toggle('completed');
            });
            list.appendChild(li);
            input.value = '';
        }
    });
});
