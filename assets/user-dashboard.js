import { db, ref, get, child, push, update } from "./firebase.js";

document.addEventListener("DOMContentLoaded", async () => {
    // === 1. SEGURANÇA ===
    const sessionUser = JSON.parse(localStorage.getItem("fitUser"));
    if (!sessionUser) { window.location.href = "index.html"; return; }
    const userId = sessionUser.email.replace(/\./g, '-').replace(/@/g, '-at-');

    // === 2. DADOS DO USUÁRIO ===
    try {
        const dbRef = ref(db);
        const snapshot = await get(child(dbRef, `users/${userId}`));
        
        if (!snapshot.exists()) {
            document.getElementById("workoutCardsContainer").innerHTML = "<p style='color:white'>Usuário não encontrado.</p>";
            return;
        }
        
        const userData = snapshot.val();

        // Preenche Header e Sidebar
        const firstName = userData.name ? userData.name.split(" ")[0] : "Atleta";
        const avatar = userData.avatar || `https://ui-avatars.com/api/?name=${firstName}`;
        
        document.getElementById("userName").innerText = firstName;
        if(document.getElementById("headerAvatar")) document.getElementById("headerAvatar").src = avatar;
        if(document.getElementById("sidebarAvatar")) document.getElementById("sidebarAvatar").src = avatar;
        if(document.getElementById("sidebarName")) document.getElementById("sidebarName").innerText = userData.name;
        if(document.getElementById("sidebarEmail")) document.getElementById("sidebarEmail").innerText = userData.email;

        // === 3. CARREGAR CARDS DE TREINO ===
        renderHomeCards(userData);

        // Configurar Menu e Navegação
        setupNavigation(userData);

    } catch (error) {
        console.error("Erro fatal:", error);
        alert("Erro ao carregar o sistema: " + error.message);
    }

    // --- FUNÇÃO DE RENDERIZAR CARDS ---
    function renderHomeCards(userData) {
        const cardsContainer = document.getElementById("workoutCardsContainer");
        cardsContainer.innerHTML = ""; // Limpa o "Carregando..."

        // Prioridade 1: Estrutura Nova (Workouts A, B, C...)
        if (userData.workouts) {
            Object.keys(userData.workouts).forEach(key => {
                // CORREÇÃO: Garante que os dados sejam tratados, mesmo se vierem como Objeto
                let workoutData = userData.workouts[key];
                // Se não for array, transforma em array de valores
                if (!Array.isArray(workoutData)) {
                    workoutData = Object.values(workoutData);
                }
                createWorkoutCard(key, workoutData);
            });
        } 
        // Prioridade 2: Estrutura Antiga (Treino Único)
        else if (userData.customWorkout) {
            let workoutData = userData.customWorkout;
            if (!Array.isArray(workoutData)) workoutData = Object.values(workoutData);
            createWorkoutCard("Treino Atual", workoutData);
        } 
        // Caso: Nenhum treino
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

    // --- CONFIGURAÇÃO DE NAVEGAÇÃO E MENU ---
    function setupNavigation(userData) {
        const menuBtn = document.getElementById("openMenuBtn");
        const sidebar = document.getElementById("mobileSidebar");
        const overlay = document.getElementById("sidebarOverlay");
        const navLinks = document.querySelectorAll(".nav-link");
        const sections = document.querySelectorAll(".view-section");

        function toggleMenu() {
            sidebar.classList.toggle("active");
            overlay.classList.toggle("active");
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
                document.getElementById(targetId).classList.remove("hidden");
                toggleMenu();
            });
        });

        document.getElementById("logoutBtnSide").addEventListener("click", () => {
            localStorage.removeItem("fitUser");
            window.location.href = "index.html";
        });

        // Configurar Anamnese
        // === 4. LÓGICA DA ANAMNESE (Atualizada e Completa) ===
    
    // CARREGAR DADOS
    if (userData.anamnese) {
        const a = userData.anamnese;
        
        // Campos de Texto Simples
        if(document.getElementById("anm_occupation")) document.getElementById("anm_occupation").value = a.occupation || "";
        if(document.getElementById("anm_work_posture")) document.getElementById("anm_work_posture").value = a.workPosture || "sentado";
        if(document.getElementById("anm_meds")) document.getElementById("anm_meds").value = a.meds || "";
        if(document.getElementById("anm_smoker")) document.getElementById("anm_smoker").value = a.smoker || "nao";
        if(document.getElementById("anm_injuries")) document.getElementById("anm_injuries").value = a.injuries || "";
        if(document.getElementById("anm_allergies")) document.getElementById("anm_allergies").value = a.allergies || "";

        // Checkboxes (Arrays)
        // Função auxiliar para marcar checkboxes salvos
        const checkBoxes = (className, savedArray) => {
            if(savedArray) {
                document.querySelectorAll(`.${className}`).forEach(cb => {
                    if (savedArray.includes(cb.value)) cb.checked = true;
                });
            }
        };

        checkBoxes('med-check', a.medicalHistory); // Histórico Médico
        checkBoxes('sym-check', a.symptoms);       // Sintomas
        checkBoxes('goal-check', a.goals);         // Objetivos
    }

    // SALVAR DADOS
    document.getElementById("saveAnamneseBtn").addEventListener("click", async () => {
        const btn = document.getElementById("saveAnamneseBtn");
        btn.innerText = "SALVANDO...";
        
        // Função auxiliar para pegar checkboxes marcados em Array
        const getChecked = (className) => {
            return Array.from(document.querySelectorAll(`.${className}:checked`)).map(cb => cb.value);
        };

        const anamneseData = {
            // Seção 1
            occupation: document.getElementById("anm_occupation").value,
            workPosture: document.getElementById("anm_work_posture").value,
            
            // Seção 2 (Arrays)
            medicalHistory: getChecked('med-check'),
            symptoms: getChecked('sym-check'),
            meds: document.getElementById("anm_meds").value,

            // Seção 3
            smoker: document.getElementById("anm_smoker").value,
            injuries: document.getElementById("anm_injuries").value,
            allergies: document.getElementById("anm_allergies").value,

            // Seção 4 (Array)
            goals: getChecked('goal-check'),
            
            updatedAt: new Date().toISOString()
        };

        try {
            await update(ref(db, `users/${userId}/anamnese`), anamneseData);
            alert("Ficha de saúde atualizada com sucesso! O treinador irá analisar.");
        } catch (e) {
            alert("Erro ao salvar: " + e.message);
        } finally {
            btn.innerText = "SALVAR FICHA COMPLETA";
        }
    });


    // --- FUNÇÕES DE EXECUÇÃO DE TREINO (MODO FOCO) ---
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
        list.innerHTML = "";
        
        // CORREÇÃO CRÍTICA: Garante array para o forEach
        const safeWorkout = Array.isArray(workout) ? workout : Object.values(workout);

        safeWorkout.forEach((ex, idx) => {
            if (!ex) return; // Pula itens vazios se houver

            const card = document.createElement("div");
            card.style.cssText = "background:var(--surface-color); padding:1rem; border-radius:12px; margin-bottom:1rem; border:1px solid rgba(255,255,255,0.05);";
            
            let icon = '<i class="ph ph-barbell"></i>';
            if(ex.type === 'cardio') icon = '<i class="ph ph-sneaker-move"></i>';
            if(ex.type === 'crossfit') icon = '<i class="ph ph-fire"></i>';

            card.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                    <span style="color:var(--primary-color); font-size:1.2rem;">${icon}</span>
                    <div>
                        <h3 style="font-size:1rem; color:white;">${ex.exercise}</h3>
                        <span style="font-size:0.8rem; color:#888;">${ex.displayString || ''}</span>
                    </div>
                </div>
                <div id="sets-container-${idx}"></div>
            `;
            list.appendChild(card);

            const container = card.querySelector(`#sets-container-${idx}`);
            
            // Renderização condicional baseada no tipo
            if(ex.type === 'cardio' || ex.type === 'crossfit') {
                 container.innerHTML = `
                    <div style="display:flex; gap:10px; align-items:center; background:rgba(0,0,0,0.3); padding:10px; border-radius:8px;">
                        <input type="text" placeholder="Resultado (ex: 5km)" style="flex:1; background:#000; border:1px solid #333; color:white; padding:8px; border-radius:6px;">
                        <div class="check-box" onclick="window.toggleCheck(this)" style="width:40px; height:40px; background:#222; border:1px solid #444; border-radius:6px; display:flex; align-items:center; justify-content:center;">
                            <i class="ph ph-check" style="display:none; color:black;"></i>
                        </div>
                    </div>`;
            } else {
                // Musculação
                const sets = parseInt(ex.val1) || 3;
                for(let i=1; i<=sets; i++) {
                    const row = document.createElement("div");
                    row.style.cssText = "display:grid; grid-template-columns: 20px 1fr 1fr 40px; gap:10px; align-items:center; margin-bottom:8px;";
                    row.innerHTML = `
                        <span style="color:#555; font-size:0.8rem;">${i}</span>
                        <input type="number" placeholder="kg" style="background:#000; border:1px solid #333; color:white; padding:8px; border-radius:6px; width:100%;">
                        <input type="number" value="${ex.val2 || 12}" style="background:#000; border:1px solid #333; color:white; padding:8px; border-radius:6px; width:100%;">
                        <div class="check-box" onclick="window.toggleCheck(this)" style="width:40px; height:35px; background:#222; border:1px solid #444; border-radius:6px; display:flex; align-items:center; justify-content:center;">
                            <i class="ph ph-check" style="display:none; color:black;"></i>
                        </div>
                    `;
                    container.appendChild(row);
                }
            }
        });
    }

    // --- FUNÇÕES GLOBAIS (Check, Timer, Feedback) ---
    window.toggleCheck = (el) => {
        const icon = el.querySelector("i");
        if(icon.style.display === "none") {
            el.style.background = "var(--primary-color)";
            icon.style.display = "block";
            startRestTimer(60);
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
        timerDiv.classList.add("active");
        timerInterval = setInterval(() => {
            rem--;
            const m = Math.floor(rem/60).toString().padStart(2,'0');
            const s = (rem%60).toString().padStart(2,'0');
            if(timerDisplay) timerDisplay.innerText = `${m}:${s}`;
            if(rem <= 0) { clearInterval(timerInterval); timerDiv.classList.remove("active"); }
        }, 1000);
    }
    
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
            timerDiv.classList.remove("active"); 
        });
    }

    // Feedback
    document.getElementById("finishBtn").addEventListener("click", () => {
        document.getElementById("view-feedback").classList.remove("hidden");
    });

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

    document.getElementById("submitFeedbackBtn").addEventListener("click", async () => {
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
});
