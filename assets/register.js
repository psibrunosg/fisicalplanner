import { db, ref, set, get, child } from "./firebase.js";

document.addEventListener("DOMContentLoaded", () => {
    const registerForm = document.getElementById("registerForm");
    const msgBox = document.getElementById("regMessage");
    const btnSubmit = document.querySelector(".btn-login");

    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = document.getElementById("regName").value;
        const email = document.getElementById("regEmail").value;
        const password = document.getElementById("regPassword").value;

        // UI: Loading
        const originalText = btnSubmit.innerText;
        btnSubmit.innerText = "CRIANDO...";
        btnSubmit.disabled = true;
        msgBox.innerText = "";

        // Cria ID única baseada no email (ex: bruno@gmail.com -> bruno-at-gmail-com)
        const userId = email.replace(/\./g, '-').replace(/@/g, '-at-');

        try {
            // 1. Verifica se o usuário já existe no Firebase
            const dbRef = ref(db);
            const snapshot = await get(child(dbRef, `users/${userId}`));

            if (snapshot.exists()) {
                throw new Error("Este e-mail já está cadastrado.");
            }

            // 2. Salva o novo usuário
            await set(ref(db, 'users/' + userId), {
                name: name,
                email: email,
                password: password, // Em app real, nunca salve senha pura! (Mas serve pro protótipo)
                workoutType: "iniciante", // Padrão
                avatar: `https://ui-avatars.com/api/?name=${name.replace(" ", "+")}&background=random`,
                createdAt: new Date().toISOString()
            });

            // Sucesso!
            msgBox.style.color = "#00ff88";
            msgBox.innerText = "Conta criada com sucesso! Redirecionando...";
            
            setTimeout(() => {
                window.location.href = "index.html";
            }, 2000);

        } catch (error) {
            console.error(error);
            msgBox.style.color = "#ff4d4d";
            msgBox.innerText = error.message || "Erro ao criar conta.";
            
            btnSubmit.innerText = originalText;
            btnSubmit.disabled = false;
        }
    });
});
