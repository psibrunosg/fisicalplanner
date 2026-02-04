import { db, ref, update, get, child } from "./firebase.js";

document.addEventListener("DOMContentLoaded", async () => {
    // 1. SEGURANÇA (Igual)
    const adminUser = JSON.parse(localStorage.getItem("fitUser"));
    if (!adminUser || adminUser.workoutType !== "admin_dashboard") {
        window.location.href = "index.html";
        return;
    }

    document.getElementById("adminName").innerText = adminUser.name.split(" ")[0];
    document.getElementById("logoutBtn").addEventListener("click", () => {
        localStorage.removeItem("fitUser");
        window.location.href = "index.html";
    });

    // 2. DADOS
    let dbUsers = [];
    let dbExercises = [];
    let currentWorkoutBuild = [];

    async function initData() {
        // Carrega Users
        try {
            const snapshot = await get(child(ref(db), 'users'));
            if (snapshot.exists()) dbUsers = Object.values(snapshot.val());
        } catch (error) { console.error(error); }

        // Carrega Exercícios
        try {
            const res = await fetch('https://psibrunosg.github.io/fisicalplanner/data/exercises.json');
            dbExercises = await res.json();
        } catch (e) { console.error(e); }

        renderDashboard();
    }

    // 3. RENDER DASHBOARD
    function renderDashboard() {
        // Atualiza Tabela de Alunos (Código igual ao anterior, omitido para brevidade mas mantenha a lógica da tabela)
        const tableBody = document.getElementById("userTableBody");
        if(tableBody) {
            tableBody.innerHTML = "";
            const studentSelect = document.getElementById("studentSelect");
            studentSelect.innerHTML = '<option value="">Selecione um aluno...</option>';
            
            // Total Users Count
            const totalStudents = dbUsers.filter(u => u.workoutType !== 'admin_dashboard').length;
            document.getElementById("totalUsers").innerText = totalStudents;

            dbUsers.forEach(user => {
                if(user.workoutType === 'admin_dashboard') return; 
                
                const hasWorkout = user.workouts || user.customWorkout;
                const statusBadge = hasWorkout 
                    ? '<span class="status-badge status-active">COM TREINO</span>' 
                    : '<span class="status-badge" style="background:#333;color:#aaa">SEM TREINO</span>';

                const row = `
                    <tr>
                        <td style="display:flex;align-items:center;gap:10px;">
                            <img src="${user.avatar || 'https://ui-avatars.com/api/?name=' + user.name}" style="width:30px;border-radius:50%"> ${user.name}
                        </td>
                        <td>${user.email}</td>
                        <td>${statusBadge}</td>
                        <td><span style="color:#00ff88;font-size:0.8rem">Ativo</span></td>
                    </tr>`;
                tableBody.innerHTML += row;

                const opt = document.createElement("option");
                opt.value = user.email; opt.innerText = user.name;
                studentSelect.appendChild(opt);
            });
        }
        updateExerciseSelect();
    }

    // 4. LÓGICA INTELIGENTE DE INPUTS
    const muscleFilter = document.getElementById("muscleFilter");
    const exerciseSelect = document.getElementById("exerciseSelect");
    
    if(muscleFilter) muscleFilter.addEventListener("change", updateExerciseSelect);
    
    // Quando muda o exercício, muda os inputs!
    if(exerciseSelect) {
        exerciseSelect.addEventListener("change", () => {
            const exId = exerciseSelect.value;
            if(!exId) return;

            const fullExercise = dbExercises.find(ex => ex.id === exId);
            toggleInputs(fullExercise.type || 'strength'); // Padrão é strength
        });
    }

    function toggleInputs(type) {
        // Esconde tudo primeiro
        document.getElementById("strength-inputs").style.display = "none";
        document.getElementById("cardio-inputs").style.display = "none";
        document.getElementById("crossfit-inputs").style.display = "none";

        // Mostra o certo
        if (type === 'cardio') {
            document.getElementById("cardio-inputs").style.display = "block";
        } else if (type === 'crossfit') {
            document.getElementById("crossfit-inputs").style.display = "block";
        } else {
            document.getElementById("strength-inputs").style.display = "block";
        }
    }

    function updateExerciseSelect() {
        const filter = muscleFilter.value;
        exerciseSelect.innerHTML = '<option value="">Selecione...</option>';
        
        // Filtro especial para Cardio
        let filtered;
        if (filter === 'Cardio') {
            filtered = dbExercises.filter(ex => ex.muscleGroup === 'Cardio' || ex.type === 'cardio');
        } else {
            filtered = filter === 'all' ? dbExercises : dbExercises.filter(ex => ex.muscleGroup === filter);
        }

        filtered.forEach(ex => {
            const opt = document.createElement("option");
            opt.value = ex.id;
            opt.innerText = `${ex.name}`;
            exerciseSelect.appendChild(opt);
        });
    }

    // ADICIONAR EXERCÍCIO (Agora suporta todos os tipos)
    document.getElementById("addExerciseBtn").addEventListener("click", () => {
        const exId = exerciseSelect.value;
        if (!exId) return alert("Escolha um exercício!");

        const fullExercise = dbExercises.find(ex => ex.id === exId);
        const type = fullExercise.type || 'strength';

        let details = "";
        let meta1 = "", meta2 = "";

        // Pega os valores corretos baseados no tipo
        if (type === 'cardio') {
            const dist = document.getElementById("distance").value;
            const time = document.getElementById("duration").value;
            if(!dist && !time) return alert("Preencha distância ou tempo!");
            details = `${dist}km em ${time}`;
            meta1 = dist + "km";
            meta2 = time;
        } 
        else if (type === 'crossfit') {
            const wod = document.getElementById("wod-details").value;
            if(!wod) return alert("Escreva as instruções do WOD!");
            details = wod;
            meta1 = "WOD";
            meta2 = "Info";
        } 
        else {
            const s = document.getElementById("sets").value;
            const r = document.getElementById("reps").value;
            details = `${s} x ${r}`;
            meta1 = s;
            meta2 = r;
        }

        const exerciseItem = {
            id: fullExercise.id,
            exercise: fullExercise.name,
            target: fullExercise.target || 'Geral',
            equipment: fullExercise.equipment,
            type: type,
            // Salva dados genéricos para exibição
            displayString: details, 
            val1: meta1, // Pode ser Sets ou Km
            val2: meta2  // Pode ser Reps ou Tempo
        };

        currentWorkoutBuild.push(exerciseItem);
        renderWorkoutPreview();
        
        // Limpa inputs
        document.getElementById("wod-details").value = "";
        document.getElementById("distance").value = "";
        document.getElementById("duration").value = "";
    });

    function renderWorkoutPreview() {
        const ul = document.getElementById("workoutPreview");
        ul.innerHTML = "";
        
        if (currentWorkoutBuild.length === 0) {
            ul.innerHTML = '<li style="color: var(--text-muted);">Lista vazia...</li>';
            return;
        }

        currentWorkoutBuild.forEach((item, index) => {
            const li = document.createElement("li");
            li.style.padding = "12px";
            li.style.marginBottom = "8px";
            li.style.background = "rgba(255,255,255,0.02)";
            li.style.border = "1px solid rgba(255,255,255,0.05)";
            li.style.borderRadius = "8px";
            li.style.display = "flex";
            li.style.justifyContent = "space-between";
            li.style.alignItems = "center";
            
            // Ícone baseado no tipo
            let icon = '<i class="ph ph-barbell"></i>';
            if(item.type === 'cardio') icon = '<i class="ph ph-sneaker-move"></i>';
            if(item.type === 'crossfit') icon = '<i class="ph ph-fire"></i>';

            li.innerHTML = `
                <div style="display:flex; gap:12px; align-items:center;">
                    <div style="color:var(--primary-color); font-size:1.2rem;">${icon}</div>
                    <div>
                        <div style="font-weight: bold; color: white;">${item.exercise}</div>
                        <div style="font-size: 0.9rem; color: #aaa; margin-top: 2px;">
                            ${item.displayString} <span style="font-size:0.75rem; border:1px solid #444; padding:2px 6px; border-radius:4px; margin-left:5px;">${item.target}</span>
                        </div>
                    </div>
                </div>
                <button onclick="window.removeExercise(${index})" style="color:#ff4d4d; background:none; border:none; cursor:pointer;">
                    <i class="ph ph-trash" style="font-size: 1.2rem;"></i>
                </button>
            `;
            ul.appendChild(li);
        });
    }

    window.removeExercise = (index) => {
        currentWorkoutBuild.splice(index, 1);
        renderWorkoutPreview();
    };

    // 5. SALVAR (Igual, só que agora salva objetos mais ricos)
    document.getElementById("saveWorkoutBtn").addEventListener("click", () => {
        const selectedEmail = document.getElementById("studentSelect").value;
        const workoutName = document.getElementById("workoutNameInput").value;
        
        if (!selectedEmail) return alert("Selecione um aluno!");
        if (!workoutName) return alert("Dê um nome ao treino!");
        if (currentWorkoutBuild.length === 0) return alert("Treino vazio!");

        const btn = document.getElementById("saveWorkoutBtn");
        btn.innerText = "ENVIANDO...";
        btn.disabled = true;

        const userId = selectedEmail.replace(/\./g, '-').replace(/@/g, '-at-');
        const updates = {};
        updates[`users/${userId}/workouts/${workoutName}`] = currentWorkoutBuild;
        updates[`users/${userId}/lastUpdate`] = new Date().toISOString();

        update(ref(db), updates)
        .then(() => {
            alert(`Treino "${workoutName}" salvo!`);
            currentWorkoutBuild = [];
            document.getElementById("workoutNameInput").value = "";
            renderWorkoutPreview();
        })
        .catch(e => alert("Erro: " + e.message))
        .finally(() => { btn.innerText = "ENVIAR TREINO"; btn.disabled = false; });
    });

    initData();
});
