import { db, ref, update, get, child, remove, push, set } from "./firebase.js";

document.addEventListener("DOMContentLoaded", async () => {
    
    // === CONFIGURAÇÃO: ID DO TREINADOR PRINCIPAL (TREINADOR A) ===
    // IMPORTANTE: Substitua pelo ID do admin principal (ex: 'admin-at-fitlife-com')
    // Isso garante que o Treinador A veja os alunos que se cadastraram sozinhos no site.
    const MASTER_TRAINER_ID = "admin-at-fitlife-com"; 

    // 1. SEGURANÇA
    const sessionUser = JSON.parse(localStorage.getItem("fitUser"));
    if (!sessionUser || sessionUser.workoutType !== "admin_dashboard") {
        window.location.href = "index.html";
        return;
    }

    // ID do Treinador Logado agora
    const currentTrainerId = sessionUser.email.replace(/\./g, '-').replace(/@/g, '-at-');

    document.getElementById("adminName").innerText = sessionUser.name.split(" ")[0];
    document.getElementById("logoutBtn").addEventListener("click", () => {
        localStorage.removeItem("fitUser");
        window.location.href = "index.html";
    });

    // 2. NAVEGAÇÃO DE ABAS
    const navLinks = document.querySelectorAll(".nav-link");
    const sections = document.querySelectorAll(".view-section");

    navLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove("active"));
            link.classList.add("active");

            // Esconde todas as seções
            sections.forEach(sec => sec.classList.add("hidden"));

            // Mostra apenas a selecionada
            const targetId = link.dataset.target;
            const targetEl = document.getElementById(targetId);
            if(targetEl) targetEl.classList.remove("hidden");
        });
    });

    // 3. CARREGAR DADOS E MÉTRICAS
    let dbUsers = [];
    let dbExercises = [];

    async function initData() {
        try {
            // Pega todos os usuários
            const snapshot = await get(child(ref(db), 'users'));
            if (snapshot.exists()) {
                const allUsers = Object.values(snapshot.val());
                
                // === FILTRO DE TREINADORES ===
                dbUsers = allUsers.filter(user => {
                    // Ignora outros admins/treinadores na lista de alunos
                    if (user.workoutType === 'admin_dashboard') return false;

                    // 1. É aluno deste treinador?
                    if (user.trainerId === currentTrainerId) return true;

                    // 2. É o Treinador A (Master) e o aluno não tem treinador (veio do site)?
                    if (currentTrainerId === MASTER_TRAINER_ID && !user.trainerId) return true;

                    return false;
                });
            }
        } catch (error) { console.error("Erro users:", error); }

        try {
            const res = await fetch('data/exercises.json'); // Ajustado para caminho local padrão se necessário
            dbExercises = await res.json();
        } catch (e) { console.error("Erro exercises:", e); }

        renderOverview();
        populateAssessmentSelect();
        setupSettings();
    }

    function renderOverview() {
        const tableBody = document.getElementById("userTableBody");
        if(!tableBody) return;
        
        tableBody.innerHTML = "";
        // dbUsers já está filtrado aqui
        const students = dbUsers;
        
        // --- CÁLCULO DE MÉTRICAS ---
        let totalUsers = students.length;
        let totalProtocols = 0;
        let weeklyWorkouts = 0;
        
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        students.forEach(user => {
            // 1. Conta Protocolos (Pastas de treino criadas)
            if (user.workouts) totalProtocols += Object.keys(user.workouts).length;
            if (user.customWorkout) totalProtocols += 1;

            // 2. Conta Treinos Realizados (Histórico da última semana)
            if (user.history) {
                Object.values(user.history).forEach(h => {
                    const workoutDate = new Date(h.date);
                    if (workoutDate >= oneWeekAgo) {
                        weeklyWorkouts++;
                    }
                });
            }

            // Tabela
            const hasWorkout = user.workouts || user.customWorkout;
            const statusBadge = hasWorkout 
                ? '<span class="status-badge status-active">COM TREINO</span>' 
                : '<span class="status-badge" style="background:#333;color:#aaa">SEM TREINO</span>';
            const avatar = user.avatar || `https://ui-avatars.com/api/?name=${user.name}`;

            tableBody.innerHTML += `
                <tr>
                    <td style="display:flex;align-items:center;gap:10px;">
                        <img src="${avatar}" style="width:30px;border-radius:50%"> ${user.name}
                    </td>
                    <td>${user.email}</td>
                    <td>${statusBadge}</td>
                    <td><span style="color:#00ff88;font-size:0.8rem">Ativo</span></td>
                </tr>`;
        });

        // Atualiza Cards
        document.getElementById("totalUsers").innerText = totalUsers;
        document.getElementById("totalProtocols").innerText = totalProtocols;
        document.getElementById("weeklyWorkouts").innerText = weeklyWorkouts;

        // Preenche Dropdowns
        const studentSelect = document.getElementById("studentSelect");
        if(studentSelect) {
            studentSelect.innerHTML = '<option value="">Selecione...</option>';
            students.forEach(u => {
                const opt = document.createElement("option");
                opt.value = u.email; opt.innerText = u.name;
                studentSelect.appendChild(opt);
            });
        }
        if(typeof updateExerciseSelect === "function") updateExerciseSelect();
    }

    // 4. LÓGICA DE AVALIAÇÃO FÍSICA
    function populateAssessmentSelect() {
        const select = document.getElementById("assessmentStudentSelect");
        if(!select) return;
        select.innerHTML = '<option value="">Selecione...</option>';
        // Usa a lista já filtrada
        dbUsers.forEach(u => {
            const opt = document.createElement("option");
            opt.value = u.email; opt.innerText = u.name;
            select.appendChild(opt);
        });
        
        select.addEventListener("change", () => {
            const email = select.value;
            const form = document.getElementById("assessmentForm");
            const hist = document.getElementById("assessmentHistoryArea");
            if(!email) { form.style.display="none"; hist.style.display="none"; return; }
            form.style.display="block"; hist.style.display="block";
            loadAssessmentHistory(email);
        });
    }

    // Cálculos de Avaliação
    const weightInput = document.getElementById("aval_weight");
    const heightInput = document.getElementById("aval_height");
    
    if(weightInput && heightInput) {
        const calcAll = () => {
            const w = parseFloat(weightInput.value);
            const h = parseFloat(heightInput.value) / 100;
            if(w && h) document.getElementById("aval_bmi").value = (w / (h*h)).toFixed(2);
            
            // Lógica Pollock simplificada
            const triceps = parseFloat(document.getElementById("fold_triceps")?.value || 0);
            const abd = parseFloat(document.getElementById("fold_abdominal")?.value || 0);
            const supra = parseFloat(document.getElementById("fold_suprailiac")?.value || 0);
            if(triceps && abd && supra) {
                const sum = triceps + abd + supra;
                document.getElementById("aval_fat_perc").value = (sum * 0.2 + 5).toFixed(1);
            }
        };
        weightInput.addEventListener("input", calcAll);
        heightInput.addEventListener("input", calcAll);
        document.querySelectorAll(".skinfold-input").forEach(i => i.addEventListener("input", calcAll));
    }

    document.getElementById("saveAssessmentBtn")?.addEventListener("click", async () => {
        const email = document.getElementById("assessmentStudentSelect").value;
        if(!email) return alert("Selecione um aluno.");
        const btn = document.getElementById("saveAssessmentBtn");
        btn.innerText = "SALVANDO...";
        const userId = email.replace(/\./g, '-').replace(/@/g, '-at-');
        
        const assessmentData = {
            date: new Date().toISOString(),
            bio: {
                weight: document.getElementById("aval_weight").value,
                height: document.getElementById("aval_height").value,
                bmi: document.getElementById("aval_bmi").value,
                fat: document.getElementById("aval_fat_perc").value,
                muscle: document.getElementById("aval_muscle_kg").value
            },
            circ: {
                shoulder: document.getElementById("circ_shoulder")?.value,
                waist: document.getElementById("circ_waist")?.value,
                hip: document.getElementById("circ_hip")?.value,
                arm_r: document.getElementById("circ_arm_r")?.value,
                thigh_r: document.getElementById("circ_thigh_r")?.value
            }
        };

        try {
            await push(ref(db, `users/${userId}/assessments`), assessmentData);
            alert("Salvo!");
            loadAssessmentHistory(email);
        } catch(e) { alert("Erro: " + e.message); }
        finally { btn.innerText = "SALVAR AVALIAÇÃO"; }
    });

    async function loadAssessmentHistory(email) {
        const userId = email.replace(/\./g, '-').replace(/@/g, '-at-');
        const tbody = document.getElementById("assessmentHistoryBody");
        tbody.innerHTML = "<tr><td colspan='4'>Carregando...</td></tr>";
        try {
            const snapshot = await get(child(ref(db), `users/${userId}/assessments`));
            tbody.innerHTML = "";
            if(snapshot.exists()) {
                const data = snapshot.val();
                Object.entries(data).reverse().forEach(([key, val]) => {
                    const date = new Date(val.date).toLocaleDateString('pt-BR');
                    tbody.innerHTML += `<tr><td>${date}</td><td>${val.bio?.weight || '-'} kg</td><td>${val.bio?.fat || '-'}%</td><td><button onclick="window.deleteAssessment('${userId}','${key}')" style="color:red;border:none;background:none;">✕</button></td></tr>`;
                });
            } else tbody.innerHTML = "<tr><td colspan='4'>Nada encontrado.</td></tr>";
        } catch(e) { console.error(e); }
    }
    
    window.deleteAssessment = async (uid, key) => {
        if(confirm("Apagar?")) { await remove(ref(db, `users/${uid}/assessments/${key}`)); loadAssessmentHistory(document.getElementById("assessmentStudentSelect").value); }
    };


    // 5. NOVO ALUNO & SETTINGS
    const modal = document.getElementById("newStudentModal");
    const openBtn = document.getElementById("openNewStudentBtn");
    const closeBtn = document.getElementById("closeModalBtn");
    const createBtn = document.getElementById("createNewUserBtn");

    if(openBtn) openBtn.addEventListener("click", () => modal.classList.add("active"));
    if(closeBtn) closeBtn.addEventListener("click", () => modal.classList.remove("active"));

    if(createBtn) {
        createBtn.addEventListener("click", async () => {
            const name = document.getElementById("new_name").value;
            const email = document.getElementById("new_email").value;
            const password = document.getElementById("new_password").value;
            if(!name || !email || !password) return alert("Preencha tudo!");

            createBtn.innerText = "CRIANDO...";
            const newUserId = email.replace(/\./g, '-').replace(/@/g, '-at-');

            try {
                await set(ref(db, 'users/' + newUserId), {
                    name: name,
                    email: email,
                    password: password,
                    createdAt: new Date().toISOString(),
                    workoutType: "Personalizado",
                    
                    // === ATRIBUIÇÃO DE TREINADOR ===
                    trainerId: currentTrainerId, // O aluno pertence a quem criou
                    // ==============================

                    avatar: `https://ui-avatars.com/api/?name=${name.replace(" ", "+")}&background=random`
                });
                alert("Criado!");
                modal.classList.remove("active");
                window.location.reload();
            } catch(e) { alert("Erro: " + e.message); }
            finally { createBtn.innerText = "Criar Aluno"; }
        });
    }

    function setupSettings() {
        const themeSwitch = document.getElementById("themeSwitch");
        if(localStorage.getItem("fitTheme") === "light") {
            document.body.classList.add("light-theme");
            if(themeSwitch) themeSwitch.checked = true;
        }
        
        if(themeSwitch) {
            themeSwitch.addEventListener("change", (e) => {
                if(e.target.checked) {
                    document.body.classList.add("light-theme");
                    localStorage.setItem("fitTheme", "light");
                } else {
                    document.body.classList.remove("light-theme");
                    localStorage.setItem("fitTheme", "dark");
                }
            });
        }

        const saveProfileBtn = document.getElementById("saveProfileBtn");
        if(saveProfileBtn) {
            saveProfileBtn.addEventListener("click", () => {
                const newName = document.getElementById("conf_adminName").value;
                const newAvatar = document.getElementById("conf_adminAvatar").value;
                const adm = JSON.parse(localStorage.getItem("fitUser"));
                if(newName) adm.name = newName;
                if(newAvatar) adm.avatar = newAvatar;
                localStorage.setItem("fitUser", JSON.stringify(adm));
                location.reload();
            });
        }
        
        const adm = JSON.parse(localStorage.getItem("fitUser"));
        if(adm && document.getElementById("conf_adminName")) {
            document.getElementById("conf_adminName").value = adm.name;
            document.getElementById("conf_adminAvatar").value = adm.avatar || "";
        }
    }

    // 6. CRIADOR DE TREINOS (Lógica de Inputs)
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
        const s = document.getElementById("strength-inputs");
        const c = document.getElementById("cardio-inputs");
        const w = document.getElementById("crossfit-inputs");
        if(s) s.style.display = "none";
        if(c) c.style.display = "none";
        if(w) w.style.display = "none";

        if (type === 'cardio' && c) c.style.display = "block";
        else if (type === 'crossfit' && w) w.style.display = "block";
        else if (s) s.style.display = "block";
    }

    function updateExerciseSelect() {
        if(!muscleFilter || !exerciseSelect) return;
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

    let currentWorkoutBuild = [];
    const addExBtn = document.getElementById("addExerciseBtn");
    if(addExBtn) {
        addExBtn.addEventListener("click", () => {
            const exId = exerciseSelect.value;
            if (!exId) return alert("Escolha um exercício!");

            const fullExercise = dbExercises.find(ex => ex.id === exId);
            const type = fullExercise.type || 'strength';
            let displayString = "", meta1 = "", meta2 = "";

            if (type === 'cardio') {
                const dist = document.getElementById("distance").value;
                const time = document.getElementById("duration").value;
                displayString = `${dist}km • ${time}`; meta1 = dist; meta2 = time;
            } else if (type === 'crossfit') {
                const wod = document.getElementById("wod-details").value;
                displayString = "Ver instruções"; meta1 = wod; meta2 = "WOD";
            } else {
                const s = document.getElementById("sets").value;
                const r = document.getElementById("reps").value;
                displayString = `${s} x ${r}`; meta1 = s; meta2 = r;
            }

            // BLOCO ÚNICO DE PUSH (Corrigido para não duplicar)
            currentWorkoutBuild.push({
                id: fullExercise.id, 
                exercise: fullExercise.name, 
                target: fullExercise.target || 'Geral',
                
                // Salva Imagem e Instrução
                img: fullExercise.img || "", 
                instructions: fullExercise.instructions || "Siga a orientação do treinador.",
                
                type: type, 
                displayString: displayString, 
                val1: meta1, 
                val2: meta2
            });

            renderWorkoutPreview();
        });
    }

    function renderWorkoutPreview() {
        const ul = document.getElementById("workoutPreview");
        if(!ul) return; 
        ul.innerHTML = "";
        const workoutName = document.getElementById("workoutNameInput")?.value || "";
        const titleEl = document.getElementById("previewTitle");
        if(titleEl) titleEl.innerText = workoutName;

        currentWorkoutBuild.forEach((item, index) => {
            const li = document.createElement("li");
            li.style.cssText = "padding:12px; margin-bottom:8px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:8px; display:flex; justify-content:space-between; align-items:center;";
            li.innerHTML = `<span>${item.exercise} - ${item.displayString}</span> <button onclick="window.removeExercise(${index})" style="color:red;background:none;border:none;cursor:pointer;">✕</button>`;
            ul.appendChild(li);
        });
    }
    window.removeExercise = (i) => { currentWorkoutBuild.splice(i, 1); renderWorkoutPreview(); };

    const saveWorkoutBtn = document.getElementById("saveWorkoutBtn");
    if(saveWorkoutBtn) {
        saveWorkoutBtn.addEventListener("click", () => {
            const email = document.getElementById("studentSelect").value;
            const name = document.getElementById("workoutNameInput").value;
            if(!email || !name) return alert("Preencha Aluno e Nome do Treino");
            const userId = email.replace(/\./g, '-').replace(/@/g, '-at-');
            
            const updates = {};
            updates[`users/${userId}/workouts/${name}`] = currentWorkoutBuild;
            updates[`users/${userId}/lastUpdate`] = new Date().toISOString();
            update(ref(db), updates).then(() => {
                alert("Treino Salvo!");
                currentWorkoutBuild = [];
                renderWorkoutPreview();
                studentSelect.dispatchEvent(new Event('change'));
            });
        });
    }
    
    const studSel = document.getElementById("studentSelect");
    if (studSel) {
        studSel.addEventListener("change", async () => {
            const email = studSel.value;
            const container = document.getElementById("activeWorkoutsArea");
            const list = document.getElementById("activeWorkoutsList");
            if(!email) { if(container) container.style.display="none"; return; }

            const userId = email.replace(/\./g, '-').replace(/@/g, '-at-');
            const snapshot = await get(child(ref(db), `users/${userId}`));
            
            if(snapshot.exists() && container) {
                const userData = snapshot.val();
                list.innerHTML = "";
                let hasTreinos = false;

                if (userData.workouts) {
                    hasTreinos = true;
                    Object.keys(userData.workouts).forEach(workoutName => {
                        const badge = document.createElement("div");
                        badge.style.cssText = "background: #330000; color: #ff6666; padding: 5px 10px; border-radius: 4px; border: 1px solid #660000; font-size: 0.85rem; display: flex; align-items: center; gap: 8px;";
                        badge.innerHTML = `${workoutName} <button onclick="deleteWorkout('${userId}', '${workoutName}')" style="background: none; border: none; color: white; cursor: pointer; font-weight: bold;">✕</button>`;
                        list.appendChild(badge);
                    });
                }
                container.style.display = hasTreinos ? "block" : "none";
            }
        });
    }
    
    window.deleteWorkout = async (uid, name) => {
        if(confirm("Excluir "+name+"?")) {
            await remove(ref(db, `users/${uid}/workouts/${name}`));
            alert("Excluído!");
            studSel.dispatchEvent(new Event('change'));
        }
    };

    initData();
});
