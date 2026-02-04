import { db, ref, update, get, child, remove, push } from "./firebase.js";

document.addEventListener("DOMContentLoaded", async () => {
    // === 1. SEGURANÇA ===
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

    // === 2. SISTEMA DE NAVEGAÇÃO (ABAS) ===
    // Agora o dashboard se comporta como um app, trocando telas sem recarregar
    const navLinks = document.querySelectorAll(".nav-link");
    const sections = document.querySelectorAll("section"); // Assume que todas as áreas principais são <section>

    // IDs das seções para mapeamento (Adicione esses IDs no seu HTML nas respectivas sections)
    // Ex: <section id="overview-section" class="stats-grid"> ...
    
    // Como seu HTML original não tinha IDs em todas as sections, vamos focar 
    // na lógica de esconder/mostrar baseado no clique.
    // Para facilitar, vou assumir que você vai colocar:
    // id="users-section" na section ".recent-users" (Tabela)
    // id="workout-section" na section de Criador de Treinos
    // id="assessment-section" na nova section
    
    navLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            
            // Visual do Menu
            navLinks.forEach(l => l.classList.remove("active"));
            link.classList.add("active");

            // Esconde todas as seções que têm classe 'view-section' (Vamos adicionar essa classe no HTML)
            document.querySelectorAll(".view-section").forEach(el => el.classList.add("hidden"));
            document.querySelectorAll("section:not(.view-section)").forEach(el => el.classList.add("hidden")); // Esconde stats tb se sair do overview

            // Lógica Específica
            const target = link.dataset.target;
            
            if (target === "overview-section") {
                // Mostra Stats e Tabela
                document.querySelector(".stats-grid").classList.remove("hidden");
                document.querySelector(".recent-users").classList.remove("hidden");
            } 
            else if (target === "users-section") {
                 document.querySelector(".recent-users").classList.remove("hidden");
            }
            else {
                // Mostra a seção alvo pelo ID
                const el = document.getElementById(target);
                if(el) el.classList.remove("hidden");
            }
        });
    });


    // === 3. CARREGAMENTO DE DADOS ===
    let dbUsers = [];
    let dbExercises = [];

    async function initData() {
        try {
            const snapshot = await get(child(ref(db), 'users'));
            if (snapshot.exists()) dbUsers = Object.values(snapshot.val());
        } catch (error) { console.error("Erro users:", error); }

        try {
            const res = await fetch('https://psibrunosg.github.io/fisicalplanner/data/exercises.json');
            dbExercises = await res.json();
        } catch (e) { console.error("Erro exercises:", e); }

        renderOverview();
        populateAssessmentSelect(); // Preenche o select da nova aba
    }

    // Renderiza a Visão Geral (Tabela Principal)
    function renderOverview() {
        const tableBody = document.getElementById("userTableBody");
        if(tableBody) {
            tableBody.innerHTML = "";
            const studentSelect = document.getElementById("studentSelect"); // Do criador de treino
            if(studentSelect) studentSelect.innerHTML = '<option value="">Selecione um aluno...</option>';
            
            const students = dbUsers.filter(u => u.workoutType !== 'admin_dashboard');
            if(document.getElementById("totalUsers")) document.getElementById("totalUsers").innerText = students.length;

            students.forEach(user => {
                const hasWorkout = user.workouts || user.customWorkout;
                const statusBadge = hasWorkout 
                    ? '<span class="status-badge status-active">COM TREINO</span>' 
                    : '<span class="status-badge" style="background:#333;color:#aaa">SEM TREINO</span>';

                const row = `
                    <tr>
                        <td style="display:flex;align-items:center;gap:10px;">
                            <img src="${user.avatar || 'https://ui-avatars.com/api/?name='+user.name}" style="width:30px;border-radius:50%"> ${user.name}
                        </td>
                        <td>${user.email}</td>
                        <td>${statusBadge}</td>
                        <td><span style="color:#00ff88;font-size:0.8rem">Ativo</span></td>
                    </tr>`;
                tableBody.innerHTML += row;

                // Popula select de treinos
                if(studentSelect) {
                    const opt = document.createElement("option");
                    opt.value = user.email; opt.innerText = user.name;
                    studentSelect.appendChild(opt);
                }
            });
        }
        if(typeof updateExerciseSelect === "function") updateExerciseSelect();
    }

    // === 4. LÓGICA DA AVALIAÇÃO FÍSICA ===
    function populateAssessmentSelect() {
        const select = document.getElementById("assessmentStudentSelect");
        if(!select) return;
        
        select.innerHTML = '<option value="">Selecione o Aluno...</option>';
        const students = dbUsers.filter(u => u.workoutType !== 'admin_dashboard');
        
        students.forEach(user => {
            const opt = document.createElement("option");
            opt.value = user.email; 
            opt.innerText = user.name;
            select.appendChild(opt);
        });

        // Quando selecionar aluno, mostrar formulário e histórico
        select.addEventListener("change", async () => {
            const email = select.value;
            if(!email) {
                document.getElementById("assessmentForm").style.display = "none";
                document.getElementById("assessmentHistoryArea").style.display = "none";
                return;
            }
            
            document.getElementById("assessmentForm").style.display = "block";
            document.getElementById("assessmentHistoryArea").style.display = "block";
            
            // Carregar histórico
            loadAssessmentHistory(email);
        });
    }

    // Cálculo automático de IMC
    const weightInput = document.getElementById("aval_weight");
    const heightInput = document.getElementById("aval_height");
    
    function calcBMI() {
        const w = parseFloat(weightInput.value);
        const h = parseFloat(heightInput.value) / 100; // cm para m
        if(w && h) {
            document.getElementById("aval_bmi").value = (w / (h*h)).toFixed(2);
        }
    }
    if(weightInput && heightInput) {
        weightInput.addEventListener("input", calcBMI);
        heightInput.addEventListener("input", calcBMI);
    }

    // SALVAR AVALIAÇÃO
    document.getElementById("saveAssessmentBtn")?.addEventListener("click", async () => {
        const email = document.getElementById("assessmentStudentSelect").value;
        if(!email) return alert("Selecione um aluno.");

        const btn = document.getElementById("saveAssessmentBtn");
        btn.innerText = "SALVANDO...";

        const userId = email.replace(/\./g, '-').replace(/@/g, '-at-');
        
        // Coleta todos os inputs que começam com 'aval_', 'circ_' ou 'fold_'
        const assessmentData = {
            date: new Date().toISOString(),
            basic: {
                weight: document.getElementById("aval_weight").value,
                height: document.getElementById("aval_height").value,
                bmi: document.getElementById("aval_bmi").value
            },
            circumferences: {
                chest: document.getElementById("circ_chest").value,
                waist: document.getElementById("circ_waist").value,
                abdomen: document.getElementById("circ_abdomen").value,
                hip: document.getElementById("circ_hip").value,
                arm_r: document.getElementById("circ_arm_r").value,
                thigh_r: document.getElementById("circ_thigh_r").value,
                calf_r: document.getElementById("circ_calf_r").value,
            },
            skinfolds: {
                triceps: document.getElementById("fold_triceps").value,
                subscapular: document.getElementById("fold_subscapular").value,
                chest: document.getElementById("fold_chest").value,
                axillary: document.getElementById("fold_axillary").value,
                suprailiac: document.getElementById("fold_suprailiac").value,
                abdominal: document.getElementById("fold_abdominal").value,
                thigh: document.getElementById("fold_thigh").value
            }
        };

        try {
            await push(ref(db, `users/${userId}/assessments`), assessmentData);
            alert("Avaliação Salva com Sucesso!");
            // Limpar form? Opcional.
            loadAssessmentHistory(email); // Recarrega tabela
        } catch (e) {
            alert("Erro: " + e.message);
        } finally {
            btn.innerText = "SALVAR AVALIAÇÃO";
        }
    });

    async function loadAssessmentHistory(email) {
        const userId = email.replace(/\./g, '-').replace(/@/g, '-at-');
        const tbody = document.getElementById("assessmentHistoryBody");
        tbody.innerHTML = "<tr><td colspan='4'>Carregando...</td></tr>";

        try {
            const snapshot = await get(child(ref(db), `users/${userId}/assessments`));
            tbody.innerHTML = ""; // Limpa
            
            if(snapshot.exists()) {
                const data = snapshot.val();
                // Transforma objeto em array e inverte (mais recente primeiro)
                const assessments = Object.entries(data).reverse();

                assessments.forEach(([key, val]) => {
                    const date = new Date(val.date).toLocaleDateString('pt-BR');
                    // Estimativa de gordura simples (Jackson & Pollock 3 dobras para homens ex)
                    // Aqui faremos apenas um placeholder se não tiver a fórmula exata ainda
                    const fat = "-"; 

                    const row = `
                        <tr>
                            <td>${date}</td>
                            <td>${val.basic.weight} kg</td>
                            <td>${val.basic.bmi} (IMC)</td>
                            <td>
                                <button onclick="deleteAssessment('${userId}', '${key}')" style="color:#ff4d4d; background:none; border:none; cursor:pointer;">
                                    <i class="ph ph-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                    tbody.innerHTML += row;
                });
            } else {
                tbody.innerHTML = "<tr><td colspan='4'>Nenhuma avaliação encontrada.</td></tr>";
            }
        } catch (e) { console.error(e); }
    }
    
    // Função global para deletar avaliação
    window.deleteAssessment = async (userId, key) => {
        if(confirm("Excluir este registro de avaliação?")) {
            await remove(ref(db, `users/${userId}/assessments/${key}`));
            // Recarrega lista
            const email = document.getElementById("assessmentStudentSelect").value;
            loadAssessmentHistory(email);
        }
    }


    // === RESTO DO CÓDIGO (CRIADOR DE TREINOS - MANTENHA IGUAL) ===
    // ... (Mantenha a lógica do updateExerciseSelect, addExerciseBtn, saveWorkoutBtn aqui)
    // Para economizar espaço, não vou repetir o código do criador de treinos que já estava funcionando,
    // mas certifique-se de que ele esteja abaixo.
    
    // 4. LÓGICA DE EXERCÍCIOS E INPUTS DINÂMICOS (Copiado do passo anterior)
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
    document.getElementById("addExerciseBtn")?.addEventListener("click", () => {
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
            li.innerHTML = `<span>${item.exercise} - ${item.displayString}</span> <button onclick="window.removeExercise(${index})" style="color:red;background:none;border:none;">✕</button>`;
            ul.appendChild(li);
        });
    }
    window.removeExercise = (i) => { currentWorkoutBuild.splice(i, 1); renderWorkoutPreview(); };

    // SALVAR TREINO
    document.getElementById("saveWorkoutBtn")?.addEventListener("click", () => {
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

    initData();
});
