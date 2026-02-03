document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.querySelector("form");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    
    // Cria um elemento para mensagens de erro/sucesso dinamicamente
    const messageBox = document.createElement("div");
    messageBox.style.marginTop = "15px";
    messageBox.style.textAlign = "center";
    messageBox.style.fontSize = "0.9rem";
    messageBox.style.fontWeight = "bold";
    loginForm.appendChild(messageBox);

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault(); // Impede a página de recarregar

        const email = emailInput.value;
        const password = passwordInput.value;

        // Feedback visual de carregamento
        const btnLogin = document.querySelector(".btn-login");
        const originalBtnText = btnLogin.innerText;
        btnLogin.innerText = "Verificando...";
        btnLogin.disabled = true;

        try {
            // 1. Busca a lista de usuários
            const response = await fetch('./users.json');
            const users = await response.json();

            // 2. Verifica se existe alguém com esse email e senha
            const user = users.find(u => u.email === email && u.password === password);

            if (user) {
                // SUCESSO!
                messageBox.style.color = "#00ff88"; // Verde Neon
                messageBox.innerText = `Bem-vindo, ${user.name}! Redirecionando...`;
                
                // 3. Salva a sessão no navegador para a próxima página usar
                // Removemos a senha antes de salvar por boas práticas (mesmo sendo protótipo)
                delete user.password; 
                localStorage.setItem("fitUser", JSON.stringify(user));

                // Aguarda 1.5s para o usuário ver a mensagem e redireciona
                // Dentro do if (user) { ... }
                
                setTimeout(() => {
                    // VERIFICA SE É ADMIN
                    if (user.workoutType === "admin_dashboard") {
                        window.location.href = "dashboard.html";
                    } else {
                        // Se for aluno comum (criaremos user-dashboard.html depois)
                        alert("Login de Aluno! (Página em construção, indo para admin por enquanto para teste)");
                        // Por enquanto, mande para dashboard também para você ver funcionando, 
                        // ou deixe um alert.
                        window.location.href = "dashboard.html"; 
                    }
                }, 1500);

            } else {
                // ERRO
                messageBox.style.color = "#ff4d4d"; // Vermelho
                messageBox.innerText = "E-mail ou senha incorretos.";
                btnLogin.innerText = originalBtnText;
                btnLogin.disabled = false;
            }

        } catch (error) {
            console.error("Erro ao carregar banco de dados:", error);
            messageBox.style.color = "#ff4d4d";
            messageBox.innerText = "Erro no sistema. Tente novamente.";
            btnLogin.innerText = originalBtnText;
            btnLogin.disabled = false;
        }
    });
});