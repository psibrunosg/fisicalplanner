import { db, ref, get, child, update, push } from "./firebase.js";

document.addEventListener("DOMContentLoaded", async () => {
    // === 1. VERIFICAÇÃO DE SESSÃO ===
    const sessionUser = JSON.parse(localStorage.getItem("fitUser"));
    if (!sessionUser) { window.location.href = "index.html"; return; }

    const userId = sessionUser.email.replace(/\./g, '-').replace(/@/g, '-at-');
    
    // Variáveis de Estado
    let currentWorkoutData = []; // O treino carregado (Array de exercícios)
    let activeTimer = null;
    let timeRemaining = 0;

    // === 2. CARREGAR DADOS DO FIREBASE ===
    const dbRef = ref(db);
    const snapshot = await get(child(dbRef, `users/${userId}`));
    
    if (!snapshot.exists()) {
        alert("Erro ao carregar usuário.");
        return;
    }

    const userData = snapshot.val();
    const workoutSelector = document.getElementById("workoutSelector");

    // Lógica para suportar Treinos Divididos (A, B, C) vs Treino Único
    // Por enquanto, o Admin salva em 'customWorkout'. Vamos usar isso como padrão.
    // Futuramente, se o Admin salvar em 'workouts: { A: [], B: [] }', este código já suportará.
    
    if (userData.workouts && typeof userData.workouts === 'object') {
        // Se existirem múltiplos treinos salvos
        workoutSelector.innerHTML = '<option value="">Selecione o treino de hoje...</option>';
        Object.keys(userData.workouts).forEach(key => {
            const opt = document.createElement("option");
            opt.value = key;
            opt.innerText = key; // Ex: "Treino A - Peito"
            workoutSelector.appendChild(opt);
        });
        
        // Listener para mudar o treino
        workoutSelector.addEventListener("change", (e) => {
            if(e.target.value) renderWorkout(userData.workouts[e.target.value]);
        });

    } else if (userData.customWorkout) {
        // Modo Padrão (Compatibilidade com o Admin atual)
        workoutSelector.innerHTML = '<option value="default" selected>Treino Atual</option>';
        renderWorkout(userData.customWorkout);
    } else {
        document.getElementById("workoutList").innerHTML = "<p style='text-align:center; padding:20px; color:#777;'>Nenhum treino encontrado.</p>";
    }

    // === 3. RENDERIZAR EXERCÍCIOS E SÉRIES ===
    function renderWorkout(workout) {
        currentWorkoutData = workout; // Salva para uso no final
        const container = document.getElementById("workoutList");
        container.innerHTML = "";

        workout.forEach((ex, exIndex) => {
            const card = document.createElement("div");
            card.className = "exercise-card";
            card.innerHTML = `
                <div style="width:100%; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h3 style="color:var(--primary-color); font-size:1.1rem;">${ex.exercise}</h3>
                        <span style="font-size:0.8rem; color:#888;">${ex.target || 'Geral'}</span>
                    </div>
                    <button class="btn-skip" onclick="toggleSkip(${exIndex})">Pular Exercício</button>
                </div>
                
                <div id="sets-container-${exIndex}" style="width:100%; margin-top:10px;">
                    </div>
            `;
            container.appendChild(card);

            // Renderizar as Séries (Linhas)
            const setsContainer = card.querySelector(`#sets-container-${exIndex}`);
            const numSets = parseInt(ex.sets) || 3; // Padrão 3 se não tiver

            for (let i = 1; i <= numSets; i++) {
                const row = document.createElement("div");
                row.className = "set-row";
                row.innerHTML = `
                    <span style="color:#555; font-size:0.9rem; font-weight:bold;">${i}</span>
                    <input type="number" class="set-input" placeholder="kg" id="weight-${exIndex}-${i}">
                    <input type="number" class="set-input" placeholder="Reps" value="${ex.reps}" id="reps-${exIndex}-${i}">
                    <div class="check-box" id="check-${exIndex}-${i}">
                        <i class="ph ph-check" style="font-size:1.2rem; display:none;"></i>
                    </div>
                `;

                // Evento de Check (Concluir série)
                const checkBox = row.querySelector(".check-box");
                checkBox.addEventListener("click", () => {
                    if (checkBox.classList.contains("checked")) {
                        // Desmarcar
                        checkBox.classList.remove("checked");
                        checkBox.querySelector("i").style.display = "none";
                    } else {
                        // Marcar
                        checkBox.classList.add("checked");
                        checkBox.querySelector("i").style.display = "block";
                        startRestTimer(60); // Inicia descanso de 60s (Pode personalizar depois)
                    }
                });

                setsContainer.appendChild(row);
            }
        });
    }

    // Função Global para Pular (Skip)
    window.toggleSkip = (index) => {
        const card = document.querySelectorAll(".exercise-card")[index];
        if (card.style.opacity === "0.4") {
            card.style.opacity = "1";
            card.style.textDecoration = "none";
        } else {
            card.style.opacity = "0.4";
            card.style.textDecoration = "line-through"; // Risco visual
        }
    };

    // === 4. SISTEMA DE TIMER ===
    const timerOverlay = document.getElementById("restTimer");
    const timerDisplay = document.getElementById("timerDisplay");
    
    function startRestTimer(seconds) {
        clearInterval(activeTimer);
        timeRemaining = seconds;
        timerOverlay.classList.add("active");
        updateTimerVisual();

        activeTimer = setInterval(() => {
            timeRemaining--;
            updateTimerVisual();
            
            if (timeRemaining <= 0) {
                clearInterval(activeTimer);
                // Opcional: Tocar som aqui
                timerDisplay.innerText = "BORA!";
                setTimeout(() => timerOverlay.classList.remove("active"), 3000);
            }
        }, 1000);
    }

    function updateTimerVisual() {
        const m = Math.floor(timeRemaining / 60).toString().padStart(2, '0');
        const s = (timeRemaining % 60).toString().padStart(2, '0');
        timerDisplay.innerText = `${m}:${s}`;
    }

    // Botão Adicionar Tempo
    window.addTime = (s) => { timeRemaining += s; updateTimerVisual(); };
    
    // Botão Fechar Timer
    document.getElementById("closeTimerBtn").addEventListener("click", () => {
        clearInterval(activeTimer);
        timerOverlay.classList.remove("active");
    });


    // === 5. SALVAR TREINO CONCLUÍDO (HISTÓRICO) ===
    document.getElementById("finishWorkoutBtn").addEventListener("click", async () => {
        if (!confirm("Finalizar treino e salvar histórico?")) return;

        const btn = document.getElementById("finishWorkoutBtn");
        btn.innerText = "Salvando...";
        
        // Coletar dados da tela
        const finishedWorkout = {
            date: new Date().toISOString(),
            workoutName: workoutSelector.value || "Treino Padrão",
            exercises: []
        };

        const cards = document.querySelectorAll(".exercise-card");
        cards.forEach((card, exIndex) => {
            // Se estiver pulado (opacity 0.4), ignora ou marca como skipped
            const isSkipped = card.style.opacity === "0.4";
            const originalEx = currentWorkoutData[exIndex];
            
            const setsData = [];
            // Coleta dados de cada série
            const rows = card.querySelectorAll(".set-row");
            rows.forEach((row, setIndex) => {
                const i = setIndex + 1;
                const isDone = row.querySelector(".check-box").classList.contains("checked");
                if (isDone) {
                    setsData.push({
                        set: i,
                        weight: document.getElementById(`weight-${exIndex}-${i}`).value,
                        reps: document.getElementById(`reps-${exIndex}-${i}`).value
                    });
                }
            });

            if (setsData.length > 0) {
                finishedWorkout.exercises.push({
                    name: originalEx.exercise,
                    skipped: isSkipped,
                    setsCompleted: setsData
                });
            }
        });

        // Salvar no nó 'history' do Firebase
        try {
            await push(ref(db, `users/${userId}/history`), finishedWorkout);
            alert("Treino salvo! Bom descanso, monstro! 💪");
            window.location.reload();
        } catch (e) {
            alert("Erro ao salvar: " + e.message);
            btn.innerText = "Concluir";
        }
    });

});
