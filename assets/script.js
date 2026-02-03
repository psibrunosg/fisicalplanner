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
                setTimeout(() => {
                    // Aqui você mudaria para a página de treinos. 
                    // Exemplo: window.location.href = "dashboard.html";
                    alert("Login realizado! O sistema agora carregaria o treino: " + user.workoutType);
                    // window.location.href = "treinos.html"; // Descomente quando criar a pag
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