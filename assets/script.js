// Importa a conexão com o banco
import { db, ref, get, child } from "./firebase.js";

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const messageBox = document.getElementById("messageBox");
    const btnLogin = document.querySelector(".btn-login");

    // Estilo da caixa de mensagem
    if (messageBox) {
        messageBox.style.marginTop = "15px";
        messageBox.style.textAlign = "center";
        messageBox.style.fontSize = "0.9rem";
        messageBox.style.fontWeight = "600";
    }

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;

            // UI: Feedback de carregamento
            const originalText = btnLogin.innerText;
            btnLogin.innerText = "AUTENTICANDO...";
            btnLogin.style.opacity = "0.7";
            btnLogin.disabled = true;
            if(messageBox) messageBox.innerText = "";

            try {
                // 1. Formata o email para o padrão de chave do Firebase
                // (ex: joao@email.com vira joao-at-email-com)
                const userId = email.replace(/\./g, '-').replace(/@/g, '-at-');

                // 2. Busca o usuário específico no Firebase
                const dbRef = ref(db);
                const snapshot = await get(child(dbRef, `users/${userId}`));

                if (snapshot.exists()) {
                    const user = snapshot.val();

                    // 3. Verifica a senha
                    if (user.password === password) {
                        // SUCESSO!
                        if(messageBox) {
                            messageBox.style.color = "#00ff88"; 
                            messageBox.innerText = "Login autorizado! Entrando...";
                        }

                        // Salva sessão no navegador (remove senha por segurança)
                        const sessionUser = { ...user };
                        delete sessionUser.password;
                        localStorage.setItem("fitUser", JSON.stringify(sessionUser));

                        // 4. Redirecionamento
                        setTimeout(() => {
                            if (user.workoutType === "admin_dashboard") {
                                window.location.href = "dashboard.html";
                            } else {
                                window.location.href = "user-dashboard.html";
                            }
                        }, 1500);

                    } else {
                        throw new Error("Senha incorreta.");
                    }

                } else {
                    throw new Error("Usuário não encontrado. Crie uma conta.");
                }

            } catch (error) {
                console.error(error);
                if(messageBox) {
                    messageBox.style.color = "#ff4d4d";
                    messageBox.innerText = error.message;
                }
                
                // Reseta botão
                btnLogin.innerText = originalText;
                btnLogin.style.opacity = "1";
                btnLogin.disabled = false;
            }
        });
    }
});
