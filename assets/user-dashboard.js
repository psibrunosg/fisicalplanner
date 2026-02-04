import { db, ref, get, child, push } from "./firebase.js";

document.addEventListener("DOMContentLoaded", async () => {
    // === 1. SEGURANÇA E INICIALIZAÇÃO ===
    const sessionUser = JSON.parse(localStorage.getItem("fitUser"));
    if (!sessionUser) { window.location.href = "index.html"; return; }
    const userId = sessionUser.email.replace(/\./g, '-').replace(/@/g, '-at-');
    
    // Elementos das Telas
    const viewHome = document.getElementById("view-home");
    const viewWorkout = document.getElementById("view-workout");
    const viewFeedback = document.getElementById("view-feedback");
    
    // Dados globais para salvar depois
    let currentWorkoutData = [];
    let activeWorkoutName = "";
    let startTime = null;

    // === 2. CARREGAR DADOS ===
    const dbRef = ref(db);
    const snapshot = await get(child(dbRef, `users/${userId}`));
    
    if (!snapshot.exists()) return alert("Erro ao carregar usuário.");
    const userData = snapshot.val();

    // Preenche Nome
    document.getElementById("userName").innerText = userData.name.split(" ")[0];

    // === 3. RENDERIZAR CARDS DA HOME ===
    const cardsContainer = document.getElementById("workoutCardsContainer");
    cardsContainer.innerHTML = "";

    // Verifica se tem treinos múltiplos ou único
    if (userData.workouts) {
        // Múltiplos (A, B, C)
        Object.keys(userData.workouts).forEach(key => {
            createWorkoutCard(key, userData.workouts[key]);
        });
    } else if (userData.customWorkout) {
        // Único (Legado)
        createWorkoutCard("Meu Treino", userData.customWorkout);
    } else {
        cardsContainer.innerHTML = "<p>Nenhum treino disponível. Fale com seu treinador.</p>";
    }

    function createWorkoutCard(name, workoutData) {
        const card = document.createElement("div");
        card.className = "workout-card-select";
        card.innerHTML = `
            <div class="card-icon"><i class="ph ph-barbell"></i></div>
            <h3 style="color:white; font-size:1.1rem; margin-bottom:5px;">${name}</h3>
            <p style="color:#777; font-size:0.85rem;">${workoutData.length} Exercícios</p>
        `;
        
        card.addEventListener("click", () => {
            openWorkout(name, workoutData);
        });
        cardsContainer.appendChild(card);
    }

    // === 4. LÓGICA DE ABRIR TREINO ===
    function openWorkout(name, data) {
        currentWorkoutData = data;
        activeWorkoutName = name;
        startTime = new Date(); // Marca hora de início

        // Troca de Tela
        viewHome.classList.add("hidden");
        viewWorkout.classList.remove("hidden");
        document.getElementById("activeWorkoutTitle").innerText = name;

        // Renderiza Exercícios
        renderExercises(data);
    }

    // Voltar para Home
    document.getElementById("backBtn").addEventListener("click", () => {
        if(confirm("Sair do treino atual? O progresso não salvo será perdido.")) {
            viewWorkout.classList.add("hidden");
            viewHome.classList.remove("hidden");
        }
    });

    function renderExercises(workout) {
        const list = document.getElementById("workoutList");
        list.innerHTML = "";

        workout.forEach((ex, exIndex) => {
            // Card do Exercício
            const card = document.createElement("div");
            card.className = "exercise-card";
            // Adicione styles inline para garantir visual se o CSS não pegar
            card.style.cssText = "background:var(--surface-color); padding:1rem; border-radius:12px; margin-bottom:1rem; border:1px solid rgba(255,255,255,0.05);";
            
            // Ícone baseado no tipo
            let icon = '<i class="ph ph-barbell"></i>';
            if(ex.type === 'cardio') icon = '<i class="ph ph-sneaker-move"></i>';
            
            // Renderiza cabeçalho do card
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <div style="display:flex; gap:10px; align-items:center;">
                        <span style="color:var(--primary-color); font-size:1.2rem;">${icon}</span>
                        <div>
                            <h3 style="font-size:1rem; color:white;">${ex.exercise}</h3>
                            <span style="font-size:0.8rem; color:#888;">${ex.displayString || ''}</span>
                        </div>
                    </div>
                </div>
                <div id="sets-container-${exIndex}"></div>
            `;
            list.appendChild(card);

            // Renderiza as Séries ou Check de Cardio
            const setsContainer = card.querySelector(`#sets-container-${exIndex}`);
            
            if (ex.type === 'cardio' || ex.type === 'crossfit') {
                // Cardio/Crossfit: Apenas um check de "Concluído" e campo de anotação
                setsContainer.innerHTML = `
                    <div style="display:flex; gap:10px; align-items:center; background:rgba(0,0,0,0.3); padding:10px; border-radius:8px;">
                        <input type="text" class="set-input" id="result-${exIndex}" placeholder="Resultado (ex: 5km em 25min)" style="flex:1; background:#000; border:1px solid #333; color:white; padding:8px; border-radius:6px;">
                        <div class="check-box" onclick="toggleCheck(this)" style="width:40px; height:40px; background:#222; border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer; border:1px solid #444;">
                            <i class="ph ph-check" style="display:none; color:black;"></i>
                        </div>
                    </div>
                `;
            } else {
                // Musculação: Loop de séries
                const numSets = parseInt(ex.val1) || 3; // Tenta pegar sets, senão 3
                for (let i = 1; i <= numSets; i++) {
                    const row = document.createElement("div");
                    row.style.cssText = "display:grid; grid-template-columns: 20px 1fr 1fr 40px; gap:10px; align-items:center; margin-bottom:8px;";
                    row.innerHTML = `
                        <span style="color:#555; font-size:0.8rem;">${i}</span>
                        <input type="number" id="weight-${exIndex}-${i}" placeholder="kg" style="background:#000; border:1px solid #333; color:white; padding:8px; border-radius:6px; width:100%;">
                        <input type="number" value="${ex.val2 || 12}" style="background:#000; border:1px solid #333; color:white; padding:8px; border-radius:6px; width:100%;">
                        <div class="check-box" onclick="toggleCheck(this)" style="width:40px; height:35px; background:#222; border-radius:6px; display:flex; align-items:center; justify-content:center; cursor:pointer; border:1px solid #444;">
                            <i class="ph ph-check" style="display:none; color:black;"></i>
                        </div>
                    `;
                    setsContainer.appendChild(row);
                }
            }
        });
    }

    // Função Global para Checks (precisa estar no window para o onclick inline funcionar ou usar addEventListener no loop)
    window.toggleCheck = (el) => {
        const icon = el.querySelector("i");
        if (icon.style.display === "none") {
            // Marcar
            el.style.background = "var(--primary-color)";
            el.style.borderColor = "var(--primary-color)";
            icon.style.display = "block";
            startRestTimer(60); // Inicia timer
        } else {
            // Desmarcar
            el.style.background = "#222";
            el.style.borderColor = "#444";
            icon.style.display = "none";
        }
    };


    // === 5. TIMER FLUTUANTE ===
    let timerInterval;
    const timerDiv = document.getElementById("restTimer");
    const timerDisplay = document.getElementById("timerDisplay");

    function startRestTimer(seconds) {
        clearInterval(timerInterval);
        let remaining = seconds;
        timerDiv.classList.add("active");
        
        timerInterval = setInterval(() => {
            remaining--;
            const m = Math.floor(remaining / 60).toString().padStart(2,'0');
            const s = (remaining % 60).toString().padStart(2,'0');
            timerDisplay.innerText = `${m}:${s}`;

            if(remaining <= 0) {
                clearInterval(timerInterval);
                timerDisplay.innerText = "BORA!";
                setTimeout(() => timerDiv.classList.remove("active"), 3000);
            }
        }, 1000);
    }
    
    window.addTime = (s) => { clearInterval(timerInterval); startRestTimer(parseInt(timerDisplay.innerText.split(':')[1]) + s); }; // Simplificado
    document.getElementById("closeTimerBtn").addEventListener("click", () => {
        clearInterval(timerInterval);
        timerDiv.classList.remove("active");
    });


    // === 6. FINALIZAR E FEEDBACK ===
    document.getElementById("finishBtn").addEventListener("click", () => {
        viewFeedback.classList.remove("hidden"); // Abre Modal
    });

    // Lógica da Escala RPE (Borg adaptada 1-5)
    let selectedRpe = 0;
    document.querySelectorAll(".rpe-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            // Reseta visual
            document.querySelectorAll(".rpe-btn").forEach(b => {
                b.style.transform = "scale(1)";
                b.style.border = "none";
            });
            // Ativa atual
            btn.style.transform = "scale(1.1)";
            btn.style.border = "2px solid white";
            selectedRpe = btn.dataset.val;

            // Feedback de texto
            const texts = ["Muito Fácil", "Fácil", "Moderado", "Difícil", "Exaustivo"];
            document.getElementById("rpeText").innerText = texts[selectedRpe - 1];
            document.getElementById("rpeText").style.color = "var(--primary-color)";
        });
    });

    // === 7. SALVAR TUDO NO FIREBASE ===
    document.getElementById("submitFeedbackBtn").addEventListener("click", async () => {
        if (selectedRpe === 0) return alert("Por favor, avalie a intensidade do treino.");

        const btn = document.getElementById("submitFeedbackBtn");
        btn.innerText = "SALVANDO...";
        
        // Coleta dados dos exercícios realizados
        // (Nota: Em um app real, coletaríamos peso x rep de cada input.
        // Aqui vamos salvar um resumo simples para não complicar demais o código agora)
        const workoutSummary = {
            date: new Date().toISOString(),
            workoutName: activeWorkoutName,
            duration: Math.round((new Date() - startTime) / 60000) + " min", // Tempo total em minutos
            rpe: selectedRpe,
            comment: document.getElementById("feedbackComment").value
        };

        try {
            // Salva no histórico
            await push(ref(db, `users/${userId}/history`), workoutSummary);
            
            alert("Treino salvo! Bom descanso! 💪");
            window.location.reload(); // Recarrega para voltar à Home limpa
        } catch (e) {
            alert("Erro: " + e.message);
            btn.innerText = "SALVAR TUDO";
        }
    });

    // Logout
    document.getElementById("logoutBtn").addEventListener("click", () => {
        localStorage.removeItem("fitUser");
        window.location.href = "index.html";
    });
});
