import { db, ref, update, get, child, remove } from "./firebase.js";

document.addEventListener("DOMContentLoaded", async () => {
    // 1. SEGURANÇA
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
        } catch (error) { console.error("Erro users:", error); }

        // Carrega Exercícios
        try {
            const res = await fetch('https://psibrunosg.github.io/fisicalplanner/data/exercises.json');
            dbExercises = await res.json();
        } catch (e) { console.error("Erro exercises:", e); }

        renderDashboard();
    }

    // 3. RENDER DASHBOARD
    function renderDashboard() {
        const tableBody = document.getElementById("userTableBody");
        if(tableBody) {
            tableBody.innerHTML = "";
            const studentSelect = document.getElementById("studentSelect");
            studentSelect.innerHTML = '<option value="">Selecione um aluno...</option>';
            
            const students = dbUsers.filter(u => u.workoutType !== 'admin_dashboard');
            document.getElementById("totalUsers").innerText = students.length;

            students.forEach(user => {
                const hasWorkout = user.workouts || user.customWorkout;
                const statusBadge = hasWorkout 
                    ? '<span class="status-badge status-active">COM TREINO</span>' 
                    : '<span class="status-badge" style="background:#333;color:#aaa">SEM TREINO</span>';

                const avatar = user.avatar || `https://ui-avatars.com/api/?name=${user.name}`;

                const row = `
                    <tr>
                        <td style="display:flex;align-items:center;gap:10px;">
                            <img src="${avatar}" style="width:30px;border-radius:50%"> ${user.name}
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

    // === NOVA FUNÇÃO: CARREGAR TREINOS DO ALUNO SELECIONADO ===
    const studentSelect = document.getElementById("studentSelect");
    
    if (studentSelect) {
        studentSelect.addEventListener("change", async () => {
            const email = studentSelect.value;
            const container = document.getElementById("activeWorkoutsArea");
            const list = document.getElementById("activeWorkoutsList");
            
            if (!email) {
                container.style.display = "none";
                return;
            }

            // Busca dados frescos do aluno no Firebase
            const userId = email.replace(/\./g, '-').replace(/@/g, '-at-');
            const snapshot = await get(child(ref(db), `users/${userId}`));
            
            if (snapshot.exists()) {
                const userData = snapshot.val();
                list.innerHTML = "";
                let hasTreinos = false;

                // Verifica treinos novos (sistema de pastas A, B, C)
                if (userData.workouts) {
                    hasTreinos = true;
                    Object.keys(userData.workouts).forEach(workoutName => {
                        const badge = document.createElement("div");
                        badge.style.cssText = "background: #330000; color: #ff6666; padding: 5px 10px; border-radius: 4px; border: 1px solid #660000; font-size: 0.85rem; display: flex; align-items: center; gap: 8px;";
                        badge.innerHTML = `
                            ${workoutName}
                            <button onclick="deleteWorkout('${userId}', '${workoutName}')" style="background: none; border: none; color: white; cursor: pointer; font-weight: bold;">✕</button>
                        `;
                        list.appendChild(badge);
                    });
                }
                
                // Verifica treino legado (customWorkout)
                if (userData.customWorkout) {
                    hasTreinos = true;
                    const badge = document.createElement("div");
                    badge.style.cssText = "background: #333; color: #aaa; padding: 5px 10px; border-radius: 4px; font-size: 0.85rem; display: flex; align-items: center; gap: 8px;";
                    badge.innerHTML = `
                        Treino Antigo (Legado)
                        <button onclick="deleteLegacyWorkout('${userId}')" style="background: none; border: none; color: white; cursor: pointer; font-weight: bold;">✕</button>
                    `;
                    list.appendChild(badge);
                }

                container.style.display = hasTreinos ? "block" : "none";
            }
        });
    }

    // === FUNÇÕES GLOBAIS DE DELETAR (Para funcionar no onclick do HTML) ===
    window.deleteWorkout = async (userId, workoutName) => {
        if(confirm(`Tem certeza que deseja EXCLUIR o "${workoutName}"? Essa ação não pode ser desfeita.`)) {
            try {
                await remove(ref(db, `users/${userId}/workouts/${workoutName}`));
                alert("Treino excluído!");
                // Simula evento de change para recarregar a lista
                studentSelect.dispatchEvent(new Event('change'));
            } catch(e) { alert("Erro: " + e.message); }
        }
    };

    window.deleteLegacyWorkout = async (userId) => {
        if(confirm("Excluir o treino antigo?")) {
            try {
                await remove(ref(db, `users/${userId}/customWorkout`));
                alert("Treino antigo excluído!");
                studentSelect.dispatchEvent(new Event('change'));
            } catch(e) { alert("Erro: " + e.message); }
        }
    };


    // 4. INPUTS E MONTAGEM (Mantém igual)
    const muscleFilter = document.getElementById("muscleFilter");
    const exerciseSelect = document.getElementById("exerciseSelect");
    if(muscleFilter) muscleFilter.addEventListener("change", updateExerciseSelect);
    
    if(exerciseSelect) {
        exerciseSelect.addEventListener("change", () => {
            const exId = exerciseSelect.value;
            if(!exId) return;
            const fullExercise = dbExercises.find(ex => ex.id === exId);
            const type = fullExercise.type || 'strength'; 
            toggleInputs(type);
        });
    }

    function toggleInputs(type) {
        document.getElementById("strength-inputs").style.display = "none";
        document.getElementById("cardio-inputs").style.display = "none";
        document.getElementById("crossfit-inputs").style.display = "none";

        if (type === 'cardio') document.getElementById("cardio-inputs").style.display = "block";
        else if (type === 'crossfit') document.getElementById("crossfit-inputs").style.display = "block";
        else document.getElementById("strength-inputs").style.display = "block";
    }

    function updateExerciseSelect() {
        const filter = muscleFilter.value;
        exerciseSelect.innerHTML = '<option value="">Selecione...</option>';
        let filtered;
        if (filter === 'Cardio') filtered = dbExercises.filter(ex => ex.muscleGroup === 'Cardio' || ex.type === 'cardio');
        else filtered = filter === 'all' ? dbExercises : dbExercises.filter(ex => ex.muscleGroup === filter);

        filtered.forEach(ex => {
            const opt = document.createElement("option");
            opt.value = ex.id; opt.innerText = ex.name;
            exerciseSelect.appendChild(opt);
        });
    }

    // ADD EXERCISE
    document.getElementById("addExerciseBtn").addEventListener("click", () => {
        const exId = exerciseSelect.value;
        if (!exId) return alert("Escolha um exercício!");

        const fullExercise = dbExercises.find(ex => ex.id === exId);
        const type = fullExercise.type || 'strength';

        let displayString = "", meta1 = "", meta2 = "";

        if (type === 'cardio') {
            const dist = document.getElementById("distance").value;
            const time = document.getElementById("duration").value;
            if(!dist && !time) return alert("Preencha dados!");
            displayString = `${dist}km • ${time}`;
            meta1 = dist; meta2 = time;
        } else if (type === 'crossfit') {
            const wod = document.getElementById("wod-details").value;
            if(!wod) return alert("Preencha WOD!");
            displayString = "Ver instruções";
            meta1 = wod; meta2 = "WOD";
        } else {
            const s = document.getElementById("sets").value;
            const r = document.getElementById("reps").value;
            displayString = `${s} x ${r}`;
            meta1 = s; meta2 = r;
        }

        currentWorkoutBuild.push({
            id: fullExercise.id,
            exercise: fullExercise.name,
            target: fullExercise.target || 'Geral',
            type: type,
            displayString: displayString,
            val1: meta1,
            val2: meta2
        });
        renderWorkoutPreview();
        
        document.getElementById("wod-details").value = "";
        document.getElementById("distance").value = "";
        document.getElementById("duration").value = "";
    });

    function renderWorkoutPreview() {
        const ul = document.getElementById("workoutPreview");
        if(!ul) return; 
        ul.innerHTML = "";
        const workoutName = document.getElementById("workoutNameInput")?.value || "";
        const titleEl = document.getElementById("previewTitle");
        if(titleEl) titleEl.innerText = workoutName;

        if (currentWorkoutBuild.length === 0) {
            ul.innerHTML = '<li style="color: var(--text-muted);">Nenhum exercício...</li>';
            return;
        }

        currentWorkoutBuild.forEach((item, index) => {
            const li = document.createElement("li");
            li.style.cssText = "padding:12px; margin-bottom:8px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:8px; display:flex; justify-content:space-between; align-items:center;";
            
            let icon = '<i class="ph ph-barbell"></i>';
            if(item.type === 'cardio') icon = '<i class="ph ph-sneaker-move"></i>';
            if(item.type === 'crossfit') icon = '<i class="ph ph-fire"></i>';

            li.innerHTML = `
                <div style="display:flex; gap:12px; align-items:center;">
                    <div style="color:var(--primary-color); font-size:1.2rem;">${icon}</div>
                    <div>
                        <div style="font-weight: bold; color: white;">${item.exercise}</div>
                        <div style="font-size: 0.9rem; color: #aaa; margin-top: 2px;">${item.displayString}</div>
                    </div>
                </div>
                <button onclick="window.removeExercise(${index})" style="color:#ff4d4d; background:none; border:none; cursor:pointer;"><i class="ph ph-trash"></i></button>
            `;
            ul.appendChild(li);
        });
    }

    window.removeExercise = (index) => {
        currentWorkoutBuild.splice(index, 1);
        renderWorkoutPreview();
    };
    
    const nameInput = document.getElementById("workoutNameInput");
    if(nameInput) nameInput.addEventListener("input", renderWorkoutPreview);

    // 5. SALVAR NO FIREBASE
    document.getElementById("saveWorkoutBtn").addEventListener("click", () => {
        const selectedEmail = document.getElementById("studentSelect").value;
        const workoutName = document.getElementById("workoutNameInput").value;
        
        if (!selectedEmail) return alert("Selecione um aluno!");
        if (!workoutName) return alert("Dê um nome ao treino!");
        if (currentWorkoutBuild.length === 0) return alert("Treino vazio!");

        const btn = document.getElementById("saveWorkoutBtn");
        const originalText = btn.innerText;
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
            if(nameInput) nameInput.value = "";
            renderWorkoutPreview();
            // Atualiza a lista de exclusão
            studentSelect.dispatchEvent(new Event('change'));
        })
        .catch(e => alert("Erro ao salvar: " + e.message))
        .finally(() => { 
            btn.innerText = originalText; 
            btn.disabled = false; 
        });
    });

    initData();
});
