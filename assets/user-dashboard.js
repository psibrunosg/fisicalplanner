import { db, ref, get, child, push, update } from "./firebase.js";

document.addEventListener("DOMContentLoaded", async () => {
    // === 1. SEGURANÇA E INICIALIZAÇÃO ===
    const sessionUser = JSON.parse(localStorage.getItem("fitUser"));
    if (!sessionUser) { window.location.href = "index.html"; return; }
    const userId = sessionUser.email.replace(/\./g, '-').replace(/@/g, '-at-');

    // === 2. CARREGAR DADOS DO USUÁRIO (FIREBASE) ===
    try {
        const dbRef = ref(db);
        const snapshot = await get(child(dbRef, `users/${userId}`));
        
        if (!snapshot.exists()) {
            document.getElementById("workoutCardsContainer").innerHTML = "<p style='color:white'>Usuário não encontrado.</p>";
            return;
        }
        
        const userData = snapshot.val();

        // --- PREENCHE HEADER E SIDEBAR ---
        const firstName = userData.name ? userData.name.split(" ")[0] : "Atleta";
        const avatar = userData.avatar || `https://ui-avatars.com/api/?name=${firstName}`;
        
        if(document.getElementById("userName")) document.getElementById("userName").innerText = firstName;
        if(document.getElementById("headerAvatar")) document.getElementById("headerAvatar").src = avatar;
        if(document.getElementById("sidebarAvatar")) document.getElementById("sidebarAvatar").src = avatar;
        if(document.getElementById("sidebarName")) document.getElementById("sidebarName").innerText = userData.name;
        if(document.getElementById("sidebarEmail")) document.getElementById("sidebarEmail").innerText = userData.email;

        // --- PREENCHE CAMPOS DE "EDITAR PERFIL" ---
        if(document.getElementById("edit_name")) {
            document.getElementById("edit_name").value = userData.name || "";
            document.getElementById("edit_email").value = userData.email || "";
            document.getElementById("edit_phone").value = userData.phone || "";
            document.getElementById("edit_avatar").value = userData.avatar || "";
            // Preview da imagem
            const preview = document.getElementById("profilePreview");
            if(preview) preview.src = userData.avatar || avatar;
        }

        // --- INICIAR MÓDULOS ---
        renderHomeCards(userData);
        setupNavigation(userData);
        loadAssessmentData(); // Carrega avaliação física
        setupAnamnese(userData); // Carrega a anamnese detalhada

    } catch (error) {
        console.error("Erro fatal:", error);
        alert("Erro ao carregar o sistema: " + error.message);
    }

    // =================================================================
    // === MÓDULO 1: RENDERIZAÇÃO DOS CARDS DE TREINO (HOME) ===
    // =================================================================
    function renderHomeCards(userData) {
        const cardsContainer = document.getElementById("workoutCardsContainer");
        if(!cardsContainer) return;
        cardsContainer.innerHTML = ""; 

        // Prioridade 1: Estrutura Nova (Pastas A, B, C)
        if (userData.workouts) {
            Object.keys(userData.workouts).forEach(key => {
                let workoutData = userData.workouts[key];
                if (!Array.isArray(workoutData)) workoutData = Object.values(workoutData);
                createWorkoutCard(key, workoutData);
            });
        } 
        // Prioridade 2: Estrutura Antiga (Treino Único)
        else if (userData.customWorkout) {
            let workoutData = userData.customWorkout;
            if (!Array.isArray(workoutData)) workoutData = Object.values(workoutData);
            createWorkoutCard("Treino Atual", workoutData);
        } 
        else {
            cardsContainer.innerHTML = "<p style='color:#777; width:100%; text-align:center;'>Nenhum treino disponível. Fale com seu treinador.</p>";
        }

        function createWorkoutCard(name, data) {
            const card = document.createElement("div");
            card.className = "workout-card-select";
            card.innerHTML = `
                <div style="font-size:2rem; color:var(--primary-color); margin-bottom:10px;"><i class="ph ph-barbell"></i></div>
                <h3 style="color:white; font-size:1.1rem;">${name}</h3>
                <p style="color:#777; font-size:0.85rem;">${data.length} Exercícios</p>
            `;
            card.addEventListener("click", () => openWorkout(name, data));
            cardsContainer.appendChild(card);
        }
    }

    // =================================================================
    // === MÓDULO 2: NAVEGAÇÃO, MENU E PERFIL ===
    // =================================================================
    function setupNavigation(userData) {
        const menuBtn = document.getElementById("openMenuBtn");
        const sidebar = document.getElementById("mobileSidebar");
        const overlay = document.getElementById("sidebarOverlay");
        const navLinks = document.querySelectorAll(".nav-link");
        const sections = document.querySelectorAll(".view-section");

        function toggleMenu() {
            if(sidebar) sidebar.classList.toggle("active");
            if(overlay) overlay.classList.toggle("active");
        }

        if(menuBtn) menuBtn.addEventListener("click", toggleMenu);
        if(overlay) overlay.addEventListener("click", toggleMenu);

        navLinks.forEach(link => {
            link.addEventListener("click", (e) => {
                e.preventDefault();
                if(link.classList.contains("locked")) return;

                navLinks.forEach(l => l.classList.remove("active"));
                link.classList.add("active");

                const targetId = link.dataset.target;
                sections.forEach(sec => sec.classList.add("hidden"));
                const targetEl = document.getElementById(targetId);
                if(targetEl) targetEl.classList.remove("hidden");
                
                // Fecha menu no mobile ao clicar
                if(window.innerWidth < 768) toggleMenu();
            });
        });

        const logoutBtn = document.getElementById("logoutBtnSide");
        if(logoutBtn) {
            logoutBtn.addEventListener("click", () => {
                localStorage.removeItem("fitUser");
                window.location.href = "index.html";
            });
        }

        // --- SALVAR PERFIL (NOVO) ---
        const saveProfileBtn = document.getElementById("saveProfileBtn");
        if(saveProfileBtn) {
            saveProfileBtn.addEventListener("click", async () => {
                const btn = document.getElementById("saveProfileBtn");
                btn.innerText = "Atualizando...";
                
                const newName = document.getElementById("edit_name").value;
                const newAvatar = document.getElementById("edit_avatar").value;
                const newPhone = document.getElementById("edit_phone").value;

                if(!newName) {
                    alert("O nome é obrigatório.");
                    btn.innerText = "Atualizar Perfil";
                    return;
                }

                try {
                    await update(ref(db, `users/${userId}`), {
                        name: newName,
                        avatar: newAvatar,
                        phone: newPhone
                    });
                    
                    // Atualiza sessão local para refletir na hora
                    const session = JSON.parse(localStorage.getItem("fitUser"));
                    session.name = newName;
                    session.avatar = newAvatar;
                    localStorage.setItem("fitUser", JSON.stringify(session));

                    alert("Perfil atualizado com sucesso!");
                    window.location.reload();
                } catch(e) {
                    alert("Erro ao atualizar: " + e.message);
                } finally {
                    btn.innerText = "Atualizar Perfil";
                }
            });
        }
    }

    // =================================================================
    // === MÓDULO 3: ANAMNESE COMPLETA (NOVO) ===
    // =================================================================
    function setupAnamnese(userData) {
        if (userData.anamnese) {
            const a = userData.anamnese;
            // Função auxiliar para preencher valor com segurança
            const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ""; };
            
            setVal("anm_birth", a.birthDate);
            setVal("anm_gender", a.gender);
            setVal("anm_occupation", a.occupation);
            setVal("anm_work_posture", a.workPosture);
            setVal("anm_smoker", a.smoker);
            setVal("anm_alcohol", a.alcohol);
            setVal("anm_sleep", a.sleep);
            setVal("anm_water", a.water);
            setVal("anm_meds", a.meds);
            setVal("anm_injuries", a.injuries);
            setVal("anm_surgeries", a.surgeries);
            setVal("anm_days", a.daysAvailable);

            // Preenche checkboxes
            const checkBoxes = (className, savedArray) => {
                if(savedArray) {
                    document.querySelectorAll(`.${className}`).forEach(cb => {
                        if (savedArray.includes(cb.value)) cb.checked = true;
                    });
                }
            };
            checkBoxes('med-check', a.diagnostics);
            checkBoxes('goal-check', a.goals);
        }

        const saveAnmBtn = document.getElementById("saveAnamneseBtn");
        if(saveAnmBtn) {
            saveAnmBtn.addEventListener("click", async () => {
                const btn = document.getElementById("saveAnamneseBtn");
                btn.innerText = "SALVANDO...";
                
                // Helper para pegar valor
                const getVal = (id) => document.getElementById(id)?.value || "";
                const getChecked = (className) => Array.from(document.querySelectorAll(`.${className}:checked`)).map(cb => cb.value);

                const anamneseData = {
                    birthDate: getVal("anm_birth"),
                    gender: getVal("anm_gender"),
                    occupation: getVal("anm_occupation"),
                    workPosture: getVal("anm_work_posture"),
                    smoker: getVal("anm_smoker"),
                    alcohol: getVal("anm_alcohol"),
                    sleep: getVal("anm_sleep"),
                    water: getVal("anm_water"),
                    meds: getVal("anm_meds"),
                    injuries: getVal("anm_injuries"),
                    surgeries: getVal("anm_surgeries"),
                    daysAvailable: getVal("anm_days"),
                    diagnostics: getChecked('med-check'),
                    goals: getChecked('goal-check'),
                    updatedAt: new Date().toISOString()
                };

                try {
                    await update(ref(db, `users/${userId}/anamnese`), anamneseData);
                    alert("Ficha de saúde atualizada com sucesso!");
                } catch (e) { alert("Erro: " + e.message); }
                finally { btn.innerText = "SALVAR FICHA COMPLETA"; }
            });
        }
    }


    // =================================================================
    // === MÓDULO 4: EXECUÇÃO DO TREINO (MODO FOCO) ===
    // =================================================================
    let activeWorkoutName = "";
    let startTime = null;

    function openWorkout(name, data) {
        activeWorkoutName = name;
        startTime = new Date();
        
        document.getElementById("view-home").classList.add("hidden");
        document.getElementById("view-workout").classList.remove("hidden");
        document.getElementById("activeWorkoutTitle").innerText = name;
        
        renderExercises(data);
    }

    document.getElementById("backToHomeBtn").addEventListener("click", () => {
        if(confirm("Sair do treino?")) {
            document.getElementById("view-workout").classList.add("hidden");
            document.getElementById("view-home").classList.remove("hidden");
        }
    });

    function renderExercises(workout) {
        const list = document.getElementById("workoutList");
        if(!list) return;
        list.innerHTML = "";
        
        const safeWorkout = Array.isArray(workout) ? workout : Object.values(workout);

        safeWorkout.forEach((ex, idx) => {
            if (!ex) return; 

            // 1. TENTA PEGAR A IMAGEM DO EXERCÍCIO
            // Usa placeholder se não tiver imagem definida
            const imgSource = (ex.img && ex.img.length > 5) ? ex.img : "https://placehold.co/600x400/EEE/31343C?text=Sem+Imagem"; 
            
            // Ícones baseados no tipo
            let icon = '<i class="ph ph-barbell"></i>';
            if(ex.type === 'cardio') icon = '<i class="ph ph-sneaker-move"></i>';
            if(ex.type === 'crossfit') icon = '<i class="ph ph-fire"></i>';

            const card = document.createElement("div");
            card.style.cssText = "background:var(--surface-color); padding:1rem; border-radius:12px; margin-bottom:1rem; border:1px solid rgba(255,255,255,0.05);";
            
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; cursor:pointer;" onclick="toggleDetails('details-${idx}')">
                    <div style="display:flex; gap:12px; align-items:center; flex:1;">
                        <div style="background:rgba(255,255,255,0.1); width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:var(--primary-color);">
                            ${icon}
                        </div>
                        <div>
                            <h3 style="font-size:1rem; color:white; margin:0; line-height:1.2;">${ex.exercise}</h3>
                            <span style="font-size:0.8rem; color:#aaa;">${ex.displayString || ''}</span>
                        </div>
                    </div>
                    <i class="ph ph-caret-down" style="color:#666;"></i>
                </div>

                <div id="details-${idx}" class="hidden" style="background:#fff; border-radius:12px; margin-bottom:15px; overflow:hidden; border:1px solid #333; animation: fadeIn 0.3s;">
                    <div style="background:white; padding:10px; display:flex; justify-content:center; align-items:center; border-bottom:1px solid #eee;">
                        <img src="${imgSource}" style="max-width:100%; max-height:250px; object-fit:contain;" 
                             onerror="this.onerror=null; this.parentElement.style.background='#eee'; this.parentElement.innerHTML='<span style=\\'color:#333\\'>Sem Imagem</span>';">
                    </div>
                    <div style="padding:15px; background:var(--surface-color);">
                        <p style="font-size:0.9rem; color:#ddd; line-height:1.5; margin:0;">
                            <strong style="color:var(--primary-color);">Como fazer:</strong><br>
                            ${ex.instructions || "Siga a orientação do treinador."}
                        </p>
                    </div>
                </div>

                <div id="sets-container-${idx}" style="margin-top:10px;"></div>
            `;
            
            list.appendChild(card);

            // 3. PREENCHE AS SÉRIES DENTRO DO CARD CRIADO
            const container = card.querySelector(`#sets-container-${idx}`);
            
            if(ex.type === 'cardio' || ex.type === 'crossfit') {
                 container.innerHTML = `
                    <div style="display:flex; gap:10px; align-items:center; background:rgba(0,0,0,0.3); padding:10px; border-radius:8px;">
                        <input type="text" placeholder="Resultado (ex: 5km)" style="flex:1; background:#000; border:1px solid #333; color:white; padding:8px; border-radius:6px;">
                        <div class="check-box" onclick="window.toggleCheck(this)" style="width:40px; height:40px; background:#222; border:1px solid #444; border-radius:6px; display:flex; align-items:center; justify-content:center;">
                            <i class="ph ph-check" style="display:none; color:black;"></i>
                        </div>
                    </div>`;
            } else {
                const sets = parseInt(ex.val1 || ex.sets) || 3; 
                for(let i=1; i<=sets; i++) {
                    const row = document.createElement("div");
                    row.style.cssText = "display:grid; grid-template-columns: 20px 1fr 1fr 40px; gap:10px; align-items:center; margin-bottom:8px;";
                    row.innerHTML = `
                        <span style="color:#555; font-size:0.8rem;">${i}</span>
                        <input type="number" placeholder="kg" style="background:#000; border:1px solid #333; color:white; padding:8px; border-radius:6px; width:100%;">
                        <input type="number" value="${ex.val2 || ex.reps || 12}" style="background:#000; border:1px solid #333; color:white; padding:8px; border-radius:6px; width:100%;">
                        <div class="check-box" onclick="window.toggleCheck(this)" style="width:40px; height:35px; background:#222; border:1px solid #444; border-radius:6px; display:flex; align-items:center; justify-content:center;">
                            <i class="ph ph-check" style="display:none; color:black;"></i>
                        </div>
                    `;
                    container.appendChild(row);
                }
            }
        }); 
    }

    // =================================================================
    // === MÓDULO 5: FUNÇÕES GLOBAIS (TIMER, CHECKBOX, FEEDBACK) ===
    // =================================================================
    
    // Checkbox e Timer
    window.toggleCheck = (el) => {
        const icon = el.querySelector("i");
        if(icon.style.display === "none") {
            el.style.background = "var(--primary-color)";
            icon.style.display = "block";
            startRestTimer(60); // Inicia timer padrão
        } else {
            el.style.background = "#222";
            icon.style.display = "none";
        }
    };

    let timerInterval;
    const timerDiv = document.getElementById("restTimer");
    const timerDisplay = document.getElementById("timerDisplay");

    function startRestTimer(seconds) {
        clearInterval(timerInterval);
        let rem = seconds;
        if(timerDiv) timerDiv.classList.add("active");
        timerInterval = setInterval(() => {
            rem--;
            const m = Math.floor(rem/60).toString().padStart(2,'0');
            const s = (rem%60).toString().padStart(2,'0');
            if(timerDisplay) timerDisplay.innerText = `${m}:${s}`;
            if(rem <= 0) { clearInterval(timerInterval); if(timerDiv) timerDiv.classList.remove("active"); }
        }, 1000);
    }
    
    // Botão "+30s" no timer
    window.addTime = (s) => { 
        if(!timerDisplay) return;
        const current = timerDisplay.innerText.split(':');
        const totalSeconds = (parseInt(current[0])*60) + parseInt(current[1]);
        clearInterval(timerInterval); 
        startRestTimer(totalSeconds + s); 
    };
    
    if(document.getElementById("closeTimerBtn")) {
        document.getElementById("closeTimerBtn").addEventListener("click", () => { 
            clearInterval(timerInterval); 
            if(timerDiv) timerDiv.classList.remove("active"); 
        });
    }

    // Feedback do Treino
    const finishBtn = document.getElementById("finishBtn");
    if(finishBtn) {
        finishBtn.addEventListener("click", () => {
            document.getElementById("view-feedback").classList.remove("hidden");
        });
    }

    let selectedRpe = 0;
    document.querySelectorAll(".rpe-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".rpe-btn").forEach(b => { b.style.transform="scale(1)"; b.style.border="none"; });
            btn.style.transform="scale(1.1)"; btn.style.border="2px solid white";
            selectedRpe = btn.dataset.val;
            const texts = ["Muito Fácil", "Fácil", "Moderado", "Difícil", "Exaustivo"];
            document.getElementById("rpeText").innerText = texts[selectedRpe-1];
        });
    });

    const submitFeedback = document.getElementById("submitFeedbackBtn");
    if(submitFeedback) {
        submitFeedback.addEventListener("click", async () => {
            if(selectedRpe === 0) return alert("Selecione a intensidade.");
            try {
                await push(ref(db, `users/${userId}/history`), {
                    date: new Date().toISOString(),
                    workoutName: activeWorkoutName,
                    duration: Math.round((new Date() - startTime)/60000) + " min",
                    rpe: selectedRpe,
                    comment: document.getElementById("feedbackComment").value
                });
                alert("Treino Salvo! 💪");
                window.location.reload();
            } catch(e) { alert("Erro: " + e.message); }
        });
    }

    // === MÓDULO 6: CARREGAR AVALIAÇÃO FÍSICA ===
    async function loadAssessmentData() {
        try {
            const snapshot = await get(child(ref(db), `users/${userId}/assessments`));
            
            if (snapshot.exists()) {
                const data = snapshot.val();
                const assessments = Object.values(data);
                const latest = assessments[assessments.length - 1];

                // Card Principal
                if(latest.bio && document.getElementById("userWeight")) {
                    document.getElementById("userWeight").innerText = latest.bio.weight || "--";
                    document.getElementById("userFat").innerText = latest.bio.fat || "--";
                    document.getElementById("userBMI").innerText = latest.bio.bmi || "--";
                    document.getElementById("userMuscle").innerText = latest.bio.muscle || "--";
                }

                // Tabela de Perímetros
                if(latest.circ && document.getElementById("res_shoulder")) {
                    document.getElementById("res_shoulder").innerText = latest.circ.shoulder || "--";
                    document.getElementById("res_waist").innerText = latest.circ.waist || "--";
                    document.getElementById("res_arm").innerText = latest.circ.arm_r || "--";
                    document.getElementById("res_thigh").innerText = latest.circ.thigh_r || "--";
                }

                // Data da avaliação
                const date = new Date(latest.date).toLocaleDateString('pt-BR');
                if(document.getElementById("lastAvalDate")) document.getElementById("lastAvalDate").innerText = date;
            }
        } catch (error) {
            console.error("Erro ao carregar avaliação:", error);
        }
    }

    // Função global para abrir/fechar o card
    window.toggleDetails = (id) => {
        const el = document.getElementById(id);
        if(el) {
            el.classList.toggle('hidden');
        }
    };
});
