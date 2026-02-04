// Importa as funções necessárias do Firebase
import { db, ref, update, get, child } from "./firebase.js";

document.addEventListener("DOMContentLoaded", async () => {
    // === 1. VERIFICAÇÃO DE SEGURANÇA (Mantém igual) ===
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


    // === 2. GERENCIAMENTO DE DADOS ===
    let dbUsers = [];
    let dbExercises = [];
    let currentWorkoutBuild = [];

    async function initData() {
        // --- AQUI ESTÁ A MUDANÇA: BUSCAR DO FIREBASE ---
        try {
            const dbRef = ref(db);
            // Busca o nó "users" inteiro
            const snapshot = await get(child(dbRef, 'users'));
            
            if (snapshot.exists()) {
                // O Firebase retorna um Objeto { "id-do-usuario": {dados}, ... }
                // Precisamos transformar isso em um Array [ {dados}, ... ] para o nosso código ler
                const usersObj = snapshot.val();
                dbUsers = Object.values(usersObj); 
            } else {
                console.log("Nenhum usuário encontrado no banco.");
            }
        } catch (error) {
            console.error("Erro ao buscar usuários do Firebase:", error);
            alert("Erro ao carregar lista de alunos.");
        }

        // --- CARREGAR EXERCÍCIOS (Continua do JSON por enquanto) ---
        // Se quiser migrar os exercícios para o Firebase depois, o processo é o mesmo.
        try {
            const res = await fetch('https://psibrunosg.github.io/fisicalplanner/data/exercises.json');
            dbExercises = await res.json();
        } catch (e) { 
            console.error("Erro ao carregar exercises.json:", e); 
        }

        renderDashboard();
    }

    // === 3. RENDERIZAÇÃO DA TELA (Mantém a lógica visual) ===
    function renderDashboard() {
        // Atualiza contadores
        const totalEl = document.getElementById("totalUsers");
        // Filtra para não contar o admin como aluno
        const totalStudents = dbUsers.filter(u => u.workoutType !== 'admin_dashboard').length;
        if(totalEl) totalEl.innerText = totalStudents;

        // Preenche Tabela
        const tableBody = document.getElementById("userTableBody");
        if(tableBody) {
            tableBody.innerHTML = "";
            
            const studentSelect = document.getElementById("studentSelect");
            studentSelect.innerHTML = '<option value="">Selecione um aluno...</option>';

            dbUsers.forEach(user => {
                // Ignora o admin na lista
                if(user.workoutType === 'admin_dashboard') return; 

                // Prepara avatar
                const avatarUrl = user.avatar || `https://ui-avatars.com/api/?name=${user.name.replace(" ", "+")}`;

                const row = `
                    <tr>
                        <td style="display: flex; align-items: center; gap: 10px;">
                            <img src="${avatarUrl}" style="width: 30px; border-radius: 50%;">
                            ${user.name}
                        </td>
                        <td>${user.email}</td>
                        <td>${user.workoutType === 'iniciante' ? 'Padrão (Iniciante)' : user.workoutType}</td>
                        <td><span class="status-badge status-active">ATIVO</span></td>
                    </tr>
                `;
                tableBody.innerHTML += row;

                // Preenche o Dropdown de Seleção para criar treino
                const option = document.createElement("option");
                option.value = user.email; 
                option.innerText = user.name;
                studentSelect.appendChild(option);
            });
        }

        updateExerciseSelect();
    }

    // === 4. LÓGICA DO CRIADOR DE TREINOS (Mantém igual) ===
    
    const muscleFilter = document.getElementById("muscleFilter");
    if(muscleFilter) muscleFilter.addEventListener("change", updateExerciseSelect);

    function updateExerciseSelect() {
        const filter = document.getElementById("muscleFilter").value;
        const select = document.getElementById("exerciseSelect");
        select.innerHTML = '<option value="">Selecione...</option>';

        const filtered = filter === 'all' 
            ? dbExercises 
            : dbExercises.filter(ex => ex.muscleGroup === filter);

        filtered.forEach(ex => {
            const opt = document.createElement("option");
            opt.value = ex.name;
            opt.innerText = ex.name;
            select.appendChild(opt);
        });
    }

    // Botão Adicionar Exercício
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
                <button onclick="window.removeExercise(${index})" style="color:#ff4d4d; background:none; border:none; cursor:pointer;">
                    <i class="ph ph-trash"></i>
                </button>
            `;
            ul.appendChild(li);
        });
    }

    window.removeExercise = (index) => {
        currentWorkoutBuild.splice(index, 1);
        renderWorkoutPreview();
    };

    // === 5. SALVAR NO FIREBASE ===
    document.getElementById("saveWorkoutBtn").addEventListener("click", () => {
        const selectedEmail = document.getElementById("studentSelect").value;
        
        if (!selectedEmail) return alert("Selecione um aluno para salvar o treino!");
        if (currentWorkoutBuild.length === 0) return alert("O treino está vazio!");

        const btnSave = document.getElementById("saveWorkoutBtn");
        const originalText = btnSave.innerText;
        btnSave.innerText = "SALVANDO...";
        btnSave.disabled = true;

        // Cria ID segura (ex: joao@email.com -> joao-at-email-com)
        const userId = selectedEmail.replace(/\./g, '-').replace(/@/g, '-at-');

        // Atualiza APENAS o campo customWorkout e lastUpdate desse usuário
        update(ref(db, 'users/' + userId), {
            customWorkout: currentWorkoutBuild,
            workoutType: 'Personalizado', // Muda o status para sabermos que tem treino
            lastUpdate: new Date().toISOString()
        })
        .then(() => {
            alert("Treino enviado para o aluno com sucesso!");
            currentWorkoutBuild = [];
            renderWorkoutPreview();
            
            // Recarrega a lista para atualizar o status na tabela visualmente
            initData();
        })
        .catch((error) => {
            alert("Erro ao salvar: " + error.message);
        })
        .finally(() => {
            btnSave.innerText = originalText;
            btnSave.disabled = false;
        });
    });

    // Inicia tudo
    initData();
});
