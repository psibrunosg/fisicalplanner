document.addEventListener("DOMContentLoaded", () => {
    
    // 1. Verifica quem está logado na sessão
    const sessionUser = JSON.parse(localStorage.getItem("fitUser"));

    if (!sessionUser) {
        window.location.href = "index.html";
        return;
    }

    // 2. Busca os dados mais recentes do "Banco de Dados" (LocalStorage)
    // Se o Admin atualizou o treino, estará aqui em 'db_users'
    const dbUsers = JSON.parse(localStorage.getItem("db_users")) || [];
    
    // Encontra o usuário atual no banco para pegar o treino novo
    const currentUser = dbUsers.find(u => u.email === sessionUser.email) || sessionUser;

    // 3. Preenche Header
    document.getElementById("userName").innerText = currentUser.name.split(" ")[0];
    document.getElementById("userAvatar").src = currentUser.avatar || "https://ui-avatars.com/api/?name=User";

    // 4. Renderiza o Treino
    const workoutList = document.getElementById("workoutList");
    const progressBar = document.getElementById("progressBar");
    const progressText = document.getElementById("progressText");

    // Verifica se existe um treino personalizado
    const myWorkout = currentUser.customWorkout;

    if (myWorkout && myWorkout.length > 0) {
        renderExercises(myWorkout);
    } else {
        workoutList.innerHTML = `
            <div class="empty-state">
                <i class="ph ph-barbell" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                <p>Nenhum treino específico montado.</p>
                <p style="font-size: 0.8rem; margin-top:0.5rem">Fale com seu treinador para atualizar sua ficha.</p>
            </div>
        `;
    }

    // Função para desenhar os cards
    function renderExercises(exercises) {
        workoutList.innerHTML = ""; // Limpa

        exercises.forEach((item, index) => {
            const card = document.createElement("div");
            card.className = "exercise-card";
            // Adiciona ID único para saber qual card foi clicado
            card.dataset.index = index; 

            card.innerHTML = `
                <div class="exercise-info">
                    <h3>${item.exercise}</h3>
                    <p>${item.sets} Séries x ${item.reps}</p>
                </div>
                <div class="check-circle">
                    <i class="ph ph-check" style="font-weight: bold;"></i>
                </div>
            `;

            // Evento de Clique (Marcar como feito)
            card.addEventListener("click", function() {
                this.classList.toggle("done");
                updateProgress();
            });

            workoutList.appendChild(card);
        });
    }

    // Função para calcular a barra de progresso
    function updateProgress() {
        const total = document.querySelectorAll(".exercise-card").length;
        const done = document.querySelectorAll(".exercise-card.done").length;
        
        const percent = total === 0 ? 0 : Math.round((done / total) * 100);
        
        progressBar.style.width = `${percent}%`;
        progressText.innerText = `${percent}% Concluído`;

        if(percent === 100) {
            progressText.innerText = "TREINO CONCLUÍDO! 🔥";
            progressText.style.color = "var(--primary-color)";
        }
    }

    // Logout
    document.getElementById("logoutBtn").addEventListener("click", () => {
        localStorage.removeItem("fitUser");
        window.location.href = "index.html";
    });
});
