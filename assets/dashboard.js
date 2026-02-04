// IMPORTANTE: Importando a conexão com o banco de dados
import { db, ref, update } from "./firebase.js";

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


    // === 2. GERENCIAMENTO DE DADOS ===
    let dbUsers = [];
    let dbExercises = [];
    let currentWorkoutBuild = []; // Lista temporária do treino

    async function initData() {
        // Carrega USUÁRIOS do seu JSON no GitHub (Para preencher a lista de opções)
        try {
            const res = await fetch('https://psibrunosg.github.io/fisicalplanner/user/users.json');
            dbUsers = await res.json();
        } catch (e) { 
            console.error("Erro ao carregar users.json:", e); 
            alert("Erro ao carregar lista de alunos. Verifique o console.");
        }

        // Carrega EXERCÍCIOS do seu JSON no GitHub
        try {
            const res = await fetch('https://psibrunosg.github.io/fisicalplanner/data/exercises.json');
            dbExercises = await res.json();
        } catch (e) { 
            console.error("Erro ao carregar exercises.json:", e); 
        }

        renderDashboard();
    }

    // === 3. RENDERIZAÇÃO DA TELA ===
    function renderDashboard() {
        // Atualiza Cards
        const totalEl = document.getElementById("totalUsers");
        if(totalEl) totalEl.innerText = dbUsers.length;

        // Preenche Tabela de Usuários
        const tableBody = document.getElementById("userTableBody");
        if(tableBody) {
            tableBody.innerHTML = "";
            
            // Preenche Select de Alunos (No criador de treinos)
            const studentSelect = document.getElementById("studentSelect");
            studentSelect.innerHTML = '<option value="">Selecione um aluno...</option>';

            dbUsers.forEach(user => {
                // Tabela (Ignora admin)
                const isAdm = user.workoutType === 'admin_dashboard';
                if(isAdm) return; 

                const row = `
                    <tr>
                        <td style="display: flex; align-items: center; gap: 10px;">
                            <img src="${user.avatar || 'https://ui-avatars.com/api/?name=User'}" style="width: 30px; border-radius: 50%;">
                            ${user.name}
                        </td>
                        <td>${user.email}</td>
                        <td>${user.workoutType || 'Padrão'}</td>
                        <td><span class="status-badge status-active">ATIVO</span></td>
                    </tr>
                `;
                tableBody.innerHTML += row;

                // Select Dropdown
                const option = document.createElement("option");
                option.value = user.email; // O e-mail será a chave
                option.innerText = user.name;
                studentSelect.appendChild(option);
            });
        }

        updateExerciseSelect(); // Carrega lista de exercícios no dropdown
    }

    // === 4. LÓGICA DO CRIADOR DE TREINOS ===
    
    // Filtro de Grupo Muscular
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
                <button onclick="window.removeExercise(${index})" style="color:#ff4d4d; background:none; border:none; cursor:pointer;">
                    <i class="ph ph-trash"></i>
                </button>
            `;
            ul.appendChild(li);
        });
    }

    // Função global para remover itens da lista
    window.removeExercise = (index) => {
        currentWorkoutBuild.splice(index, 1);
        renderWorkoutPreview();
    };

    // === 5. SALVAR NO FIREBASE (AQUI ESTÁ A MUDANÇA) ===
    document.getElementById("saveWorkoutBtn").addEventListener("click", () => {
        const selectedEmail = document.getElementById("studentSelect").value;
        
        if (!selectedEmail) return alert("Selecione um aluno para salvar o treino!");
        if (currentWorkoutBuild.length === 0) return alert("O treino está vazio!");

        // Feedback visual
        const btnSave = document.getElementById("saveWorkoutBtn");
        const originalText = btnSave.innerText;
        btnSave.innerText = "SALVANDO NA NUVEM...";
        btnSave.disabled = true;

        // Criamos uma ID segura para o Firebase (sem pontos ou @)
        // Ex: joao@email.com vira joao-at-email-com
        const userId = selectedEmail.replace(/\./g, '-').replace(/@/g, '-at-');

        // Manda pro Firebase
        update(ref(db, 'users/' + userId), {
            customWorkout: currentWorkoutBuild,
            lastUpdate: new Date().toISOString()
        })
        .then(() => {
            alert("Treino salvo na Nuvem com sucesso! O aluno já pode ver no app.");
            currentWorkoutBuild = [];
            renderWorkoutPreview();
        })
        .catch((error) => {
            alert("Erro ao salvar: " + error.message);
        })
        .finally(() => {
            btnSave.innerText = originalText;
            btnSave.disabled = false;
        });
    });

    // Inicializa tudo
    initData();
});
