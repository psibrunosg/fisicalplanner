import { db, ref, update, get, child } from "./firebase.js";

document.addEventListener("DOMContentLoaded", async () => {
    // === 1. VERIFICAÇÃO DE SEGURANÇA ===
    const adminUser = JSON.parse(localStorage.getItem("fitUser"));
    // Se não tiver user logado ou não for admin, chuta pro login
    if (!adminUser || adminUser.workoutType !== "admin_dashboard") {
        window.location.href = "index.html";
        return;
    }

    document.getElementById("adminName").innerText = adminUser.name.split(" ")[0];
    
    document.getElementById("logoutBtn").addEventListener("click", () => {
        localStorage.removeItem("fitUser");
        window.location.href = "index.html";
    });

    // === 2. GERENCIAMENTO DE DADOS ===
    let dbUsers = [];
    let dbExercises = [];
    let currentWorkoutBuild = [];

    async function initData() {
        // Carrega Usuários do Firebase Realtime Database
        try {
            const dbRef = ref(db);
            const snapshot = await get(child(dbRef, 'users'));
            if (snapshot.exists()) {
                dbUsers = Object.values(snapshot.val()); 
            }
        } catch (error) {
            console.error("Erro ao buscar usuários:", error);
            alert("Erro de conexão com o banco de dados.");
        }

        // Carrega Exercícios do JSON Estático (GitHub)
        try {
            const res = await fetch('https://psibrunosg.github.io/fisicalplanner/data/exercises.json');
            dbExercises = await res.json();
        } catch (e) { 
            console.error("Erro exercises:", e); 
        }

        renderDashboard();
    }

    // === 3. RENDERIZAÇÃO DA TELA ===
    function renderDashboard() {
        // Atualiza contadores
        const totalStudents = dbUsers.filter(u => u.workoutType !== 'admin_dashboard').length;
        const totalEl = document.getElementById("totalUsers");
        if(totalEl) totalEl.innerText = totalStudents;

        // Preenche Tabela
        const tableBody = document.getElementById("userTableBody");
        if(tableBody) {
            tableBody.innerHTML = "";
            const studentSelect = document.getElementById("studentSelect");
            studentSelect.innerHTML = '<option value="">Selecione um aluno...</option>';

            dbUsers.forEach(user => {
                if(user.workoutType === 'admin_dashboard') return; 

                const avatarUrl = user.avatar || `https://ui-avatars.com/api/?name=${user.name.replace(" ", "+")}`;
                
                // Badge de Status (Verifica se já tem treinos criados)
                let statusBadge = '<span class="status-badge" style="background: #333; color: #aaa;">SEM TREINO</span>';
                if (user.workouts || user.customWorkout) {
                    statusBadge = '<span class="status-badge status-active">COM TREINO</span>';
                }

                const row = `
                    <tr>
                        <td style="display: flex; align-items: center; gap: 10px;">
                            <img src="${avatarUrl}" style="width: 30px; border-radius: 50%;">
                            ${user.name}
                        </td>
                        <td>${user.email}</td>
                        <td>${statusBadge}</td>
                        <td><span style="font-size: 0.8rem; color: #00ff88;">Ativo</span></td>
                    </tr>
                `;
                tableBody.innerHTML += row;

                // Preenche o Dropdown de Seleção
                const option = document.createElement("option");
                option.value = user.email; 
                option.innerText = user.name;
                studentSelect.appendChild(option);
            });
        }
        updateExerciseSelect();
    }

    // === 4. LÓGICA DE MONTAGEM DE TREINO ===
    
    // Filtro de Músculo
    const muscleFilter = document.getElementById("muscleFilter");
    if(muscleFilter) muscleFilter.addEventListener("change", updateExerciseSelect);

    function updateExerciseSelect() {
        const filter = document.getElementById("muscleFilter").value;
        const select = document.getElementById("exerciseSelect");
        select.innerHTML = '<option value="">Selecione...</option>';

        const filtered = filter === 'all' ? dbExercises : dbExercises.filter(ex => ex.muscleGroup === filter);

        filtered.forEach(ex => {
            const opt = document.createElement("option");
            opt.value = ex.id; 
            // Mostra nome + equipamento para facilitar
            opt.innerText = `${ex.name} (${ex.target || 'Geral'} - ${ex.equipment})`;
            select.appendChild(opt);
        });
    }

    // Botão Adicionar Exercício
    document.getElementById("addExerciseBtn").addEventListener("click", () => {
        const exId = document.getElementById("exerciseSelect").value;
        const sets = document.getElementById("sets").value;
        const reps = document.getElementById("reps").value;

        if (!exId) return alert("Escolha um exercício!");

        const fullExercise = dbExercises.find(ex => ex.id === exId);

        const exerciseItem = {
            id: fullExercise.id,
            exercise: fullExercise.name,
            target: fullExercise.target,
            equipment: fullExercise.equipment,
            sets: sets,
            reps: reps
        };

        currentWorkoutBuild.push(exerciseItem);
        renderWorkoutPreview();
    });

    function renderWorkoutPreview() {
        const ul = document.getElementById("workoutPreview");
        ul.innerHTML = "";
        
        // Mostra o nome do treino sendo editado
        const workoutName = document.getElementById("workoutNameInput").value || "Sem nome";
        document.getElementById("previewTitle").innerText = workoutName;

        if (currentWorkoutBuild.length === 0) {
            ul.innerHTML = '<li style="color: var(--text-muted);">Lista vazia...</li>';
            return;
        }

        currentWorkoutBuild.forEach((item, index) => {
            const li = document.createElement("li");
            li.style.padding = "12px";
            li.style.marginBottom = "8px";
            li.style.background = "rgba(255,255,255,0.02)";
            li.style.borderRadius = "8px";
            li.style.border = "1px solid rgba(255,255,255,0.05)";
            li.style.display = "flex";
            li.style.justifyContent = "space-between";
            li.style.alignItems = "center";
            
            li.innerHTML = `
                <div>
                    <div style="font-weight: bold; color: white;">${item.exercise}</div>
                    <div style="font-size: 0.85rem; color: #888; margin-top: 2px;">
                        <span style="color: var(--primary-color);">${item.sets} x ${item.reps}</span> 
                        • ${item.target}
                    </div>
                </div>
                <button onclick="window.removeExercise(${index})" style="color:#ff4d4d; background:none; border:none; cursor:pointer;">
                    <i class="ph ph-trash" style="font-size: 1.2rem;"></i>
                </button>
            `;
            ul.appendChild(li);
        });
    }

    // Função Global para remover item da lista visual
    window.removeExercise = (index) => {
        currentWorkoutBuild.splice(index, 1);
        renderWorkoutPreview();
    };
    
    // Atualiza título do preview ao digitar
    document.getElementById("workoutNameInput").addEventListener("input", renderWorkoutPreview);


    // === 5. SALVAR NO FIREBASE (MÚLTIPLOS TREINOS) ===
    document.getElementById("saveWorkoutBtn").addEventListener("click", () => {
        const selectedEmail = document.getElementById("studentSelect").value;
        const workoutName = document.getElementById("workoutNameInput").value;
        
        if (!selectedEmail) return alert("Selecione um aluno!");
        if (!workoutName) return alert("Dê um nome ao treino (Ex: Treino A)!");
        if (currentWorkoutBuild.length === 0) return alert("O treino está vazio!");

        const btnSave = document.getElementById("saveWorkoutBtn");
        const originalText = btnSave.innerText;
        btnSave.innerText = "ENVIANDO...";
        btnSave.disabled = true;

        const userId = selectedEmail.replace(/\./g, '-').replace(/@/g, '-at-');

        // Cria o update para salvar dentro de 'workouts'
        const updates = {};
        updates[`users/${userId}/workouts/${workoutName}`] = currentWorkoutBuild;
        updates[`users/${userId}/lastUpdate`] = new Date().toISOString();
        updates[`users/${userId}/workoutType`] = "Personalizado";

        update(ref(db), updates)
        .then(() => {
            alert(`Sucesso! O "${workoutName}" foi salvo para o aluno.`);
            currentWorkoutBuild = [];
            document.getElementById("workoutNameInput").value = ""; 
            renderWorkoutPreview();
            initData(); // Recarrega a tabela
        })
        .catch((error) => {
            alert("Erro: " + error.message);
        })
        .finally(() => {
            btnSave.innerText = originalText;
            btnSave.disabled = false;
        });
    });

    // Inicia tudo
    initData();
});
