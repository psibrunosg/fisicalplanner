import { db, ref, update, get, child, remove, push } from "./firebase.js";

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

    // 2. NAVEGAÇÃO DE ABAS
    const navLinks = document.querySelectorAll(".nav-link");
    navLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove("active"));
            link.classList.add("active");

            // Esconde todas
            document.querySelector(".stats-grid").classList.add("hidden");
            document.querySelector(".recent-users").classList.add("hidden");
            document.getElementById("workout-section").classList.add("hidden");
            document.getElementById("assessment-section").classList.add("hidden");

            // Mostra alvo
            const target = link.dataset.target;
            if (target === "overview-section") {
                document.querySelector(".stats-grid").classList.remove("hidden");
                document.querySelector(".recent-users").classList.remove("hidden");
            } else if (target === "users-section") {
                 document.querySelector(".recent-users").classList.remove("hidden");
            } else {
                const el = document.getElementById(target);
                if(el) el.classList.remove("hidden");
            }
        });
    });

    // 3. DADOS
    let dbUsers = [];
    let dbExercises = [];

    async function initData() {
        try {
            const snapshot = await get(child(ref(db), 'users'));
            if (snapshot.exists()) dbUsers = Object.values(snapshot.val());
        } catch (error) { console.error(error); }

        try {
            const res = await fetch('https://psibrunosg.github.io/fisicalplanner/data/exercises.json');
            dbExercises = await res.json();
        } catch (e) { console.error(e); }

        renderOverview();
        populateAssessmentSelect();
    }

    function renderOverview() {
        const tableBody = document.getElementById("userTableBody");
        if(tableBody) {
            tableBody.innerHTML = "";
            const students = dbUsers.filter(u => u.workoutType !== 'admin_dashboard');
            document.getElementById("totalUsers").innerText = students.length;

            students.forEach(user => {
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
            
            // Preenche selects de treino também
            const studentSelect = document.getElementById("studentSelect");
            if(studentSelect) {
                studentSelect.innerHTML = '<option value="">Selecione...</option>';
                students.forEach(u => {
                    const opt = document.createElement("option");
                    opt.value = u.email; opt.innerText = u.name;
                    studentSelect.appendChild(opt);
                });
            }
        }
        if(typeof updateExerciseSelect === "function") updateExerciseSelect();
    }

    // === 4. LÓGICA DA AVALIAÇÃO FÍSICA (ATUALIZADA) ===
    function populateAssessmentSelect() {
        const select = document.getElementById("assessmentStudentSelect");
        if(!select) return;
        
        select.innerHTML = '<option value="">Selecione o Aluno...</option>';
        const students = dbUsers.filter(u => u.workoutType !== 'admin_dashboard');
        
        students.forEach(user => {
            const opt = document.createElement("option");
            opt.value = user.email; opt.innerText = user.name;
            select.appendChild(opt);
        });

        select.addEventListener("change", () => {
            const email = select.value;
            const form = document.getElementById("assessmentForm");
            const hist = document.getElementById("assessmentHistoryArea");
            
            if(!email) {
                if(form) form.style.display = "none";
                if(hist) hist.style.display = "none";
                return;
            }
            if(form) form.style.display = "block";
            if(hist) hist.style.display = "block";
            loadAssessmentHistory(email);
        });
    }

    // CÁLCULOS AUTOMÁTICOS (IMC + POLLOCK)
    const weightInput = document.getElementById("aval_weight");
    const heightInput = document.getElementById("aval_height");
    
    // Listeners para IMC
    if(weightInput && heightInput) {
        const calcAll = () => { calcBMI(); calcBodyFat(); };
        weightInput.addEventListener("input", calcAll);
        heightInput.addEventListener("input", calcAll);
    }

    // Listeners para Dobras (Pollock)
    document.querySelectorAll(".skinfold-input").forEach(input => {
        input.addEventListener("input", calcBodyFat);
    });

    function calcBMI() {
        const w = parseFloat(weightInput.value);
        const h = parseFloat(heightInput.value) / 100;
        if(w && h) document.getElementById("aval_bmi").value = (w / (h*h)).toFixed(2);
    }

    function calcBodyFat() {
        // Tenta calcular Pollock 7 dobras
        const folds = [
            "fold_triceps", "fold_subscapular", "fold_chest", "fold_axillary", 
            "fold_suprailiac", "fold_abdominal", "fold_thigh"
        ];
        
        let sum = 0;
        let allFilled = true;
        
        folds.forEach(id => {
            const val = parseFloat(document.getElementById(id).value);
            if(isNaN(val)) allFilled = false;
            else sum += val;
        });

        // Se preencheu todas as dobras, calcula!
        if(allFilled) {
            // Fórmula Genérica Jackson & Pollock 7 dobras (Para Homens como exemplo base)
            // Densidade = 1.112 - 0.00043499(Sum) + 0.00000055(Sum^2) - 0.00028826(Idade)
            // Vamos assumir idade 25 se não tiver cadastro, ou pegar do user data futuramente.
            // Para simplificar neste MVP, usaremos uma aproximação comum.
            
            // Densidade Corporal Estimada (Homem)
            const density = 1.112 - (0.00043499 * sum) + (0.00000055 * (sum * sum)) - (0.00028826 * 30); // Usando 30 anos como base
            
            // Siri Equation: %Fat = (495 / Density) - 450
            const bf = (495 / density) - 450;
            
            if(bf > 0 && bf < 60) {
                document.getElementById("aval_fat_perc").value = bf.toFixed(1);
            }
        }
    }

    // SALVAR AVALIAÇÃO
    const saveAvalBtn = document.getElementById("saveAssessmentBtn");
    if(saveAvalBtn) {
        saveAvalBtn.addEventListener("click", async () => {
            const email = document.getElementById("assessmentStudentSelect").value;
            if(!email) return alert("Selecione um aluno.");
            
            saveAvalBtn.innerText = "SALVANDO...";
            const userId = email.replace(/\./g, '-').replace(/@/g, '-at-');
            
            // Coleta TUDO
            const assessmentData = {
                date: new Date().toISOString(),
                // Bioimpedância / Dados Vitais
                bio: {
                    weight: document.getElementById("aval_weight").value,
                    height: document.getElementById("aval_height").value,
                    bmi: document.getElementById("aval_bmi").value,
                    fat: document.getElementById("aval_fat_perc").value,
                    muscle: document.getElementById("aval_muscle_kg").value,
                    visceral: document.getElementById("aval_visceral").value,
                    metabolic_age: document.getElementById("aval_metabolic_age").value
                },
                // Perímetros
                circ: {
                    shoulder: document.getElementById("circ_shoulder").value,
                    chest: document.getElementById("circ_chest").value,
                    waist: document.getElementById("circ_waist").value,
                    abdomen: document.getElementById("circ_abdomen").value,
                    hip: document.getElementById("circ_hip").value,
                    arm_r: document.getElementById("circ_arm_r").value,
                    arm_r_cont: document.getElementById("circ_arm_r_cont").value,
                    arm_l: document.getElementById("circ_arm_l").value,
                    thigh_r: document.getElementById("circ_thigh_r").value,
                    calf_r: document.getElementById("circ_calf_r").value,
                },
                // Dobras
                folds: {
                    triceps: document.getElementById("fold_triceps").value,
                    subscapular: document.getElementById("fold_subscapular").value,
                    chest: document.getElementById("fold_chest").value,
                    axillary: document.getElementById("fold_axillary").value,
                    suprailiac: document.getElementById("fold_suprailiac").value,
                    abdominal: document.getElementById("fold_abdominal").value,
                    thigh: document.getElementById("fold_thigh").value
                },
                // Postura
                posture: {
                    spine: document.getElementById("posture_spine").value,
                    shoulders: document.getElementById("posture_shoulders").value,
                    knees: document.getElementById("posture_knees").value,
                    feet: document.getElementById("posture_feet").value
                }
            };

            try {
                await push(ref(db, `users/${userId}/assessments`), assessmentData);
                alert("Avaliação Completa Salva!");
                loadAssessmentHistory(email);
            } catch (e) { alert("Erro: " + e.message); } 
            finally { saveAvalBtn.innerText = "SALVAR AVALIAÇÃO COMPLETA"; }
        });
    }

    async function loadAssessmentHistory(email) {
        const userId = email.replace(/\./g, '-').replace(/@/g, '-at-');
        const tbody = document.getElementById("assessmentHistoryBody");
        if(!tbody) return;
        tbody.innerHTML = "<tr><td colspan='4'>Carregando...</td></tr>";

        try {
            const snapshot = await get(child(ref(db), `users/${userId}/assessments`));
            tbody.innerHTML = "";
            
            if(snapshot.exists()) {
                const data = snapshot.val();
                Object.entries(data).reverse().forEach(([key, val]) => {
                    const date = new Date(val.date).toLocaleDateString('pt-BR');
                    // Mostra BF se tiver, senão traço
                    const bfDisplay = val.bio.fat ? `${val.bio.fat}%` : "-";
                    
                    tbody.innerHTML += `
                        <tr>
                            <td>${date}</td>
                            <td>${val.bio.weight} kg</td>
                            <td>${bfDisplay}</td>
                            <td><button onclick="window.deleteAssessment('${userId}', '${key}')" style="color:#ff4d4d; background:none; border:none; cursor:pointer;"><i class="ph ph-trash"></i></button></td>
                        </tr>`;
                });
            } else {
                tbody.innerHTML = "<tr><td colspan='4'>Nenhuma avaliação.</td></tr>";
            }
        } catch (e) { console.error(e); }
    }
    
    window.deleteAssessment = async (userId, key) => {
        if(confirm("Excluir avaliação?")) {
            await remove(ref(db, `users/${userId}/assessments/${key}`));
            const email = document.getElementById("assessmentStudentSelect").value;
            loadAssessmentHistory(email);
        }
    };

    // === 5. CÓDIGOS ANTERIORES (CRIADOR, EXCLUSÃO TREINO, ETC) ===
    // (Mantenha o restante do código do passo anterior aqui: toggleInputs, updateExerciseSelect, addExerciseBtn, saveWorkoutBtn)
    
    // ... CÓDIGO DO CRIADOR DE TREINOS AQUI ...
    // PARA NÃO FICAR GIGANTE, COLE AQUI O FINAL DO CÓDIGO DA RESPOSTA ANTERIOR
    // (Desde 'const muscleFilter' até o final 'initData()')
    
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

    // ADD EXERCISE
    const addBtn = document.getElementById("addExerciseBtn");
    if(addBtn) {
        addBtn.addEventListener("click", () => {
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

            currentWorkoutBuild.push({
                id: fullExercise.id,
                exercise: fullExercise.name,
                target: fullExercise.target || 'Geral',
                type: type,
                displayString: displayString,
                val1: meta1, val2: meta2
            });
            renderWorkoutPreview();
        });
    }

    let currentWorkoutBuild = [];
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

    // SALVAR TREINO
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
            });
        });
    }
    
    // Gerenciador de Exclusão de Treinos
    const studentSelect = document.getElementById("studentSelect");
    if (studentSelect) {
        studentSelect.addEventListener("change", async () => {
            const email = studentSelect.value;
            const container = document.getElementById("activeWorkoutsArea"); // Se você não criou essa div no HTML ainda, pode ignorar
            if(container) container.style.display = "none";
            // Lógica de mostrar treinos ativos para excluir (do passo anterior)
        });
    }

    initData();
    // ===============================================
    // === NOVO: LÓGICA DE CADASTRO DE ALUNOS ===
    // ===============================================
    
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

            if(!name || !email || !password) return alert("Preencha todos os campos!");

            createBtn.innerText = "CRIANDO...";
            
            // Sanitiza email para usar como chave no Firebase
            const userId = email.replace(/\./g, '-').replace(/@/g, '-at-');

            try {
                // Cria o usuário na base de dados
                await set(ref(db, 'users/' + userId), {
                    name: name,
                    email: email,
                    password: password, // Em app real, não salvar senha assim! (MVP only)
                    createdAt: new Date().toISOString(),
                    workoutType: "Personalizado", // Padrão
                    avatar: `https://ui-avatars.com/api/?name=${name.replace(" ", "+")}&background=random`
                });

                alert("Aluno cadastrado com sucesso!");
                modal.classList.remove("active");
                
                // Limpa campos
                document.getElementById("new_name").value = "";
                document.getElementById("new_email").value = "";
                
                // Recarrega lista
                // Se você tiver a função initData() acessível, chame-a. 
                // Senão, reload na página:
                window.location.reload(); 

            } catch (e) {
                alert("Erro ao criar: " + e.message);
            } finally {
                createBtn.innerText = "Criar Aluno";
            }
        });
    }

    // ===============================================
    // === NOVO: LÓGICA DE CONFIGURAÇÕES (SETTINGS) ===
    // ===============================================

    // 1. Carregar Configurações Salvas
    const adminUser = JSON.parse(localStorage.getItem("fitUser"));
    if(document.getElementById("conf_adminName")) document.getElementById("conf_adminName").value = adminUser.name;
    if(document.getElementById("conf_adminAvatar")) document.getElementById("conf_adminAvatar").value = adminUser.avatar || "";
    
    // Tema Salvo?
    const savedTheme = localStorage.getItem("fitTheme");
    if(savedTheme === 'light') {
        document.body.classList.add("light-theme");
        if(document.getElementById("themeSwitch")) {
            document.getElementById("themeSwitch").checked = true;
            document.getElementById("themeIndicator").style.transform = 'translateX(20px)';
        }
    }

    // 2. Botão Salvar Perfil
    const saveProfileBtn = document.getElementById("saveProfileBtn");
    if(saveProfileBtn) {
        saveProfileBtn.addEventListener("click", () => {
            const newName = document.getElementById("conf_adminName").value;
            const newAvatar = document.getElementById("conf_adminAvatar").value;
            
            // Atualiza LocalStorage
            adminUser.name = newName;
            if(newAvatar) adminUser.avatar = newAvatar;
            localStorage.setItem("fitUser", JSON.stringify(adminUser));

            // Atualiza Visual
            document.getElementById("adminName").innerText = newName.split(" ")[0];
            if(newAvatar) document.getElementById("topAvatar").src = newAvatar;

            alert("Perfil atualizado!");
        });
    }

    // 3. Botão Salvar Sistema (Tema)
    const themeSwitch = document.getElementById("themeSwitch");
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
});
