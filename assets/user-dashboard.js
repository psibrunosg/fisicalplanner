import { db, ref, get, child, push, update } from "./firebase.js";

document.addEventListener("DOMContentLoaded", async () => {
    // === 1. SEGURANÇA ===
    const sessionUser = JSON.parse(localStorage.getItem("fitUser"));
    if (!sessionUser) { window.location.href = "index.html"; return; }
    const userId = sessionUser.email.replace(/\./g, '-').replace(/@/g, '-at-');

    // === 2. DADOS DO USUÁRIO ===
    const dbRef = ref(db);
    const snapshot = await get(child(dbRef, `users/${userId}`));
    if (!snapshot.exists()) return alert("Erro ao carregar usuário.");
    const userData = snapshot.val();

    // Preenche Header e Sidebar
    const firstName = userData.name.split(" ")[0];
    const avatar = userData.avatar || `https://ui-avatars.com/api/?name=${firstName}`;
    
    document.getElementById("userName").innerText = firstName;
    document.getElementById("headerAvatar").src = avatar;
    document.getElementById("sidebarAvatar").src = avatar;
    document.getElementById("sidebarName").innerText = userData.name;
    document.getElementById("sidebarEmail").innerText = userData.email;

    // === 3. LÓGICA DO MENU LATERAL ===
    const menuBtn = document.getElementById("openMenuBtn");
    const sidebar = document.getElementById("mobileSidebar");
    const overlay = document.getElementById("sidebarOverlay");
    const navLinks = document.querySelectorAll(".nav-link");
    const sections = document.querySelectorAll(".view-section");

    function toggleMenu() {
        sidebar.classList.toggle("active");
        overlay.classList.toggle("active");
    }

    menuBtn.addEventListener("click", toggleMenu);
    overlay.addEventListener("click", toggleMenu);

    // Navegação entre Telas
    navLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            if(link.classList.contains("locked")) return; // Ignora links bloqueados

            // Remove active de todos e adiciona no atual
            navLinks.forEach(l => l.classList.remove("active"));
            link.classList.add("active");

            // Esconde todas as seções e mostra a alvo
            const targetId = link.dataset.target;
            sections.forEach(sec => sec.classList.add("hidden"));
            document.getElementById(targetId).classList.remove("hidden");

            toggleMenu(); // Fecha o menu
        });
    });

    // Logout Sidebar
    document.getElementById("logoutBtnSide").addEventListener("click", () => {
        localStorage.removeItem("fitUser");
        window.location.href = "index.html";
    });

    // === 4. LÓGICA DA ANAMNESE ===
    // Carregar dados existentes
    if (userData.anamnese) {
        document.getElementById("anamneseGoal").value = userData.anamnese.goal || "saude";
        document.getElementById("anamneseInjuries").value = userData.anamnese.injuries || "";
        document.getElementById("anamneseMeds").value = userData.anamnese.meds || "";
    }

    // Salvar Anamnese
    document.getElementById("saveAnamneseBtn").addEventListener("click", async () => {
        const btn = document.getElementById("saveAnamneseBtn");
        btn.innerText = "SALVANDO...";
        
        const anamneseData = {
            goal: document.getElementById("anamneseGoal").value,
            injuries: document.getElementById("anamneseInjuries").value,
            meds: document.getElementById("anamneseMeds").value,
            updatedAt: new Date().toISOString()
        };

        try {
            await update(ref(db, `users/${userId}/anamnese`), anamneseData);
            alert("Anamnese atualizada com sucesso!");
        } catch (e) {
            alert("Erro: " + e.message);
        } finally {
            btn.innerText = "SALVAR DADOS";
        }
    });

    // === 5. CARDS DA HOME E TREINO (Mantém lógica anterior adaptada) ===
    const cardsContainer = document.getElementById("workoutCardsContainer");
    cardsContainer.innerHTML = "";

    if (userData.workouts) {
        Object.keys(userData.workouts).forEach(key => createWorkoutCard(key, userData.workouts[key]));
    } else if (userData.customWorkout) {
        createWorkoutCard("Treino Atual", userData.customWorkout);
    } else {
        cardsContainer.innerHTML = "<p>Sem treinos ainda.</p>";
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

    // --- FUNÇÕES DE EXECUÇÃO DE TREINO ---
    let activeWorkoutName = "";
    let startTime = null;

    function openWorkout(name, data) {
        activeWorkoutName = name;
        startTime = new Date();
        
        // Troca visual para tela de treino
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
        
        workout.forEach((ex, idx) => {
            const card = document.createElement("div");
            card.style.cssText = "background:var(--surface-color); padding:1rem; border-radius:12px; margin-bottom:1rem; border:1px solid rgba(255,255,255,0.05);";
            
            // Ícone
            let icon = '<i class="ph ph-barbell"></i>';
            if(ex.type === 'cardio') icon = '<i class="ph ph-sneaker-move"></i>';

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
            
            if(ex.type === 'cardio' || ex.type === 'crossfit') {
                 container.innerHTML = `
                    <div style="display:flex; gap:10px; align-items:center; background:rgba(0,0,0,0.3); padding:10px; border-radius:8px;">
                        <input type="text" placeholder="Resultado" style="flex:1; background:#000; border:1px solid #333; color:white; padding:8px; border-radius:6px;">
                        <div class="check-box" onclick="window.toggleCheck(this)" style="width:40px; height:40px; background:#222; border:1px solid #444; border-radius:6px; display:flex; align-items:center; justify-content:center;">
                            <i class="ph ph-check" style="display:none; color:black;"></i>
                        </div>
                    </div>`;
            } else {
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

    // Função Global de Check (Necessária para o HTML injetado)
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

    // --- TIMER E FEEDBACK (Igual ao anterior) ---
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
            timerDisplay.innerText = `${m}:${s}`;
            if(rem <= 0) { clearInterval(timerInterval); timerDiv.classList.remove("active"); }
        }, 1000);
    }
    
    window.addTime = (s) => { clearInterval(timerInterval); startRestTimer(parseInt(timerDisplay.innerText.split(':')[1])+s); };
    document.getElementById("closeTimerBtn").addEventListener("click", () => { clearInterval(timerInterval); timerDiv.classList.remove("active"); });

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
            alert("Treino salvo! 💪");
            window.location.reload();
        } catch(e) { alert("Erro: " + e.message); }
    });
});
