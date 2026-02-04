document.addEventListener("DOMContentLoaded", async () => {
    // === 1. VERIFICAÇÃO DE SEGURANÇA ===
    const adminUser = JSON.parse(localStorage.getItem("fitUser"));
    if (!adminUser || adminUser.workoutType !== "admin_dashboard") {
        window.location.href = "index.html";
        return;
    }

    // Preenche dados do admin na tela
    document.getElementById("adminName").innerText = adminUser.name.split(" ")[0];
    
    // Logout
    document.getElementById("logoutBtn").addEventListener("click", () => {
        localStorage.removeItem("fitUser");
        window.location.href = "index.html";
    });


    // === 2. GERENCIAMENTO DE DADOS (DATABASE SIMULADO) ===
    let dbUsers = [];
    let dbExercises = [];
    let currentWorkoutBuild = []; // Lista temporária do treino que estamos criando

    async function initData() {
        // Tenta pegar do LocalStorage (Edições salvas)
        const localUsers = localStorage.getItem("db_users");
        const localExercises = localStorage.getItem("db_exercises");

        if (localUsers) {
            dbUsers = JSON.parse(localUsers);
        } else {
            // Se não tem, baixa do JSON original e salva no Local
            try {
                const res = await fetch('user/users.json');
                dbUsers = await res.json();
                localStorage.setItem("db_users", JSON.stringify(dbUsers)); // Salva inicial
            } catch (e) { console.error("Erro users:", e); }
        }

        if (localExercises) {
            dbExercises = JSON.parse(localExercises);
        } else {
            try {
                const res = await fetch('data/exercises.json');
                dbExercises = await res.json();
                localStorage.setItem("db_exercises", JSON.stringify(dbExercises));
            } catch (e) { console.error("Erro exercises:", e); }
        }

        renderDashboard();
    }

    // === 3. RENDERIZAÇÃO DA TELA ===
    function renderDashboard() {
        // Atualiza Cards
        document.getElementById("totalUsers").innerText = dbUsers.length;

        // Preenche Tabela de Usuários
        const tableBody = document.getElementById("userTableBody");
        tableBody.innerHTML = "";
        
        // Preenche Select de Alunos (No criador de treinos)
        const studentSelect = document.getElementById("studentSelect");
        studentSelect.innerHTML = '<option value="">Selecione um aluno...</option>';

        dbUsers.forEach(user => {
            // Tabela
            const isAdm = user.workoutType === 'admin_dashboard';
            if(isAdm) return; // Não mostra admin na lista de alunos pra editar

            const row = `
                <tr>
                    <td style="display: flex; align-items: center; gap: 10px;">
                        <img src="${user.avatar || 'https://ui-avatars.com/api/?name=User'}" style="width: 30px; border-radius: 50%;">
                        ${user.name}
                    </td>
                    <td>${user.email}</td>
                    <td>${user.workoutType || 'Sem treino'}</td>
                    <td><span class="status-badge status-active">ATIVO</span></td>
                </tr>
            `;
            tableBody.innerHTML += row;

            // Select Dropdown
            const option = document.createElement("option");
            option.value = user.email; // Usamos email como ID único
            option.innerText = user.name;
            studentSelect.appendChild(option);
        });

        updateExerciseSelect(); // Carrega lista de exercícios
    }

    // === 4. LÓGICA DO CRIADOR DE TREINOS ===
    
    // Filtro de Grupo Muscular
    document.getElementById("muscleFilter").addEventListener("change", updateExerciseSelect);

    function updateExerciseSelect() {
        const filter = document.getElementById("muscleFilter").value;
        const select = document.getElementById("exerciseSelect");
        select.innerHTML = '<option value="">Selecione...</option>';

        const filtered = filter === 'all' 
            ? dbExercises 
            : dbExercises.filter(ex => ex.muscleGroup === filter);

        filtered.forEach(ex => {
            const opt = document.createElement("option");
            opt.value = ex.name; // Salvamos o nome do exercício
            opt.innerText = ex.name;
            select.appendChild(opt);
        });
    }

    // Adicionar Exercício à Lista Temporária
    document.getElementById("addExerciseBtn").addEventListener("click", () => {
        const exName = document.getElementById("exerciseSelect").value;
        const sets = document.getElementById("sets").value;
        const reps = document.getElementById("reps").value;

        if (!exName) return alert("Escolha um exercício!");

        const exerciseItem = {
            exercise: exName,
            sets: sets,
            reps: reps
        };

        currentWorkoutBuild.push(exerciseItem);
        renderWorkoutPreview();
    });

    function renderWorkoutPreview() {
        const ul = document.getElementById("workoutPreview");
        ul.innerHTML = "";

        if (currentWorkoutBuild.length === 0) {
            ul.innerHTML = '<li style="color: var(--text-muted);">Nenhum exercício...</li>';
            return;
        }

        currentWorkoutBuild.forEach((item, index) => {
            const li = document.createElement("li");
            li.style.padding = "10px";
            li.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
            li.style.display = "flex";
            li.style.justifyContent = "space-between";
            
            li.innerHTML = `
                <span><strong>${item.exercise}</strong> - ${item.sets}x ${item.reps}</span>
                <button onclick="removeExercise(${index})" style="color:#ff4d4d; background:none; border:none; cursor:pointer;">
                    <i class="ph ph-trash"></i>
                </button>
            `;
            ul.appendChild(li);
        });
    }

    // Função global para remover itens da lista (precisa estar no window)
    window.removeExercise = (index) => {
        currentWorkoutBuild.splice(index, 1);
        renderWorkoutPreview();
    };

    // === 5. SALVAR TUDO (A MÁGICA) ===
    document.getElementById("saveWorkoutBtn").addEventListener("click", () => {
        const selectedEmail = document.getElementById("studentSelect").value;
        
        if (!selectedEmail) return alert("Selecione um aluno para salvar o treino!");
        if (currentWorkoutBuild.length === 0) return alert("O treino está vazio!");

        // 1. Acha o usuário no nosso "banco" local
        const userIndex = dbUsers.findIndex(u => u.email === selectedEmail);
        
        if (userIndex > -1) {
            // 2. Atualiza o usuário com o novo treino
            // Criamos uma propriedade 'customWorkout' no usuário
            dbUsers[userIndex].customWorkout = currentWorkoutBuild;
            dbUsers[userIndex].workoutType = "Personalizado"; // Muda o status na tabela

            // 3. PERSISTÊNCIA: Salva no LocalStorage
            localStorage.setItem("db_users", JSON.stringify(dbUsers));

            alert(`Treino salvo com sucesso para ${dbUsers[userIndex].name}!`);
            
            // Limpa o form
            currentWorkoutBuild = [];
            renderWorkoutPreview();
            renderDashboard(); // Atualiza a tabela lá em cima
        } else {
            alert("Erro: Usuário não encontrado.");
        }
    });

    // Inicializa tudo
    initData();
});
