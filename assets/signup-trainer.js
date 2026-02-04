import { db, ref, set, get, child } from "./firebase.js";

// === 1. VERIFICAÇÃO DE SEGURANÇA (GATEKEEPER) ===
// Antes de qualquer coisa, verifica se quem está na página é um ADMIN logado.
document.addEventListener("DOMContentLoaded", () => {
    const sessionUser = JSON.parse(localStorage.getItem("fitUser"));
    
    // Se não tem usuário OU se o usuário não é admin...
    if (!sessionUser || sessionUser.workoutType !== "admin_dashboard") {
        alert("🔒 Acesso Negado!\nEsta página é restrita para administradores.");
        window.location.href = "index.html"; // Chuta para o login
    }
});

// === 2. LÓGICA DE CADASTRO ===
document.getElementById("trainerSignupForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("t_name").value;
    const email = document.getElementById("t_email").value;
    const password = document.getElementById("t_password").value;
    const btn = document.getElementById("signupBtn");

    if (password.length < 6) {
        alert("A senha deve ter pelo menos 6 caracteres.");
        return;
    }

    btn.innerText = "CRIANDO...";
    btn.disabled = true;

    // Sanitiza o email para usar como ID
    const userId = email.replace(/\./g, '-').replace(/@/g, '-at-');

    try {
        // Verifica se já existe
        const snapshot = await get(child(ref(db), `users/${userId}`));
        if (snapshot.exists()) {
            throw new Error("Este e-mail já está cadastrado no sistema.");
        }

        // CRIA O TREINADOR
        await set(ref(db, `users/${userId}`), {
            name: name,
            email: email,
            password: password,
            workoutType: "admin_dashboard", // <--- Ouro: Isso define ele como Treinador
            role: "trainer",
            createdAt: new Date().toISOString(),
            avatar: `https://ui-avatars.com/api/?name=${name.replace(" ", "+")}&background=00ff88&color=000`
        });

        alert(`✅ Sucesso!\nTreinador ${name} cadastrado.\nEnvie o email e senha para ele acessar.`);
        
        // Limpa o formulário
        document.getElementById("trainerSignupForm").reset();

    } catch (error) {
        console.error(error);
        alert("Erro: " + error.message);
    } finally {
        btn.innerText = "CRIAR CONTA";
        btn.disabled = false;
    }
});
