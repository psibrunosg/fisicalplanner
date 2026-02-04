document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const messageBox = document.getElementById("messageBox");
    const btnLogin = document.querySelector(".btn-login");

    // Estilizando a caixa de mensagem via JS para não poluir o CSS inicial
    if (messageBox) {
        messageBox.style.marginTop = "15px";
        messageBox.style.textAlign = "center";
        messageBox.style.fontSize = "0.9rem";
        messageBox.style.fontWeight = "600";
        messageBox.style.minHeight = "20px";
    }

    if(loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;

            // UI: Estado de carregamento
            const originalText = btnLogin.innerText;
            btnLogin.innerText = "VALIDANDO...";
            btnLogin.style.opacity = "0.7";
            btnLogin.disabled = true;
            if(messageBox) messageBox.innerText = "";

            try {
                // Tenta carregar o JSON. 
                // O caminho 'user/users.json' é relativo ao index.html (raiz)
                const response = await fetch('user/users.json');
                
                if (!response.ok) {
                    throw new Error("Erro ao conectar com o banco de dados (404). Verifique se a pasta 'user' e o arquivo 'users.json' existem.");
                }

                const users = await response.json();

                // Lógica de validação: Procura usuário com email e senha iguais
                const user = users.find(u => u.email === email && u.password === password);

                if (user) {
                    // SUCESSO
                    if(messageBox) {
                        messageBox.style.color = "#00ff88"; // Verde Neon
                        messageBox.innerText = "Acesso permitido! Redirecionando...";
                    }
                    
                    // Salvar sessão (removemos a senha por segurança básica)
                    const sessionUser = { ...user };
                    delete sessionUser.password;
                    localStorage.setItem("fitUser", JSON.stringify(sessionUser));

                    // Redirecionamento Inteligente
                    setTimeout(() => {
                        // Se for ADMIN, vai para o dashboard de controle
                        if (user.workoutType === "admin_dashboard") {
                            window.location.href = "dashboard.html";
                        } 
                        // Se for qualquer outra pessoa (ALUNO), vai para o app de treino
                        else {
                            window.location.href = "user-dashboard.html";
                        }
                    }, 1500);

                } else {
                    // FALHA (Senha errada)
                    throw new Error("E-mail ou senha incorretos.");
                }

            } catch (error) {
                // Tratamento de Erros (Arquivo não achado ou senha errada)
                console.error(error);
                if(messageBox) {
                    messageBox.style.color = "#ff4d4d"; // Vermelho
                    messageBox.innerText = error.message;
                }
                
                // Resetar botão para tentar de novo
                btnLogin.innerText = originalText;
                btnLogin.style.opacity = "1";
                btnLogin.disabled = false;
            }
        });
    }
});
