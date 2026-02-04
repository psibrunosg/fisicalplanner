import { db, ref, set, get, child } from "./firebase.js";

// === CONFIGURAÇÃO DE SEGURANÇA ===
const MASTER_KEY = "SOU_PRO_2026"; // Defina sua senha mestra aqui

document.getElementById("trainerSignupForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("t_name").value;
    const email = document.getElementById("t_email").value;
    const password = document.getElementById("t_password").value;
    const secret = document.getElementById("t_secret").value;
    const btn = document.getElementById("signupBtn");

    if (secret !== MASTER_KEY) {
        alert("⛔ CHAVE MESTRA INCORRETA!\nVocê não tem permissão para criar contas de treinador.");
        return;
    }

    if (password.length < 6) {
        alert("A senha deve ter pelo menos 6 caracteres.");
        return;
    }

    btn.innerText = "CRIANDO CONTA...";
    btn.disabled = true;

    const userId = email.replace(/\./g, '-').replace(/@/g, '-at-');

    try {
        const snapshot = await get(child(ref(db), `users/${userId}`));
        if (snapshot.exists()) {
            throw new Error("Este e-mail já está cadastrado no sistema.");
        }

        await set(ref(db, `users/${userId}`), {
            name: name,
            email: email,
            password: password,
            workoutType: "admin_dashboard", // Define como treinador
            role: "trainer",
            createdAt: new Date().toISOString(),
            avatar: `https://ui-avatars.com/api/?name=${name.replace(" ", "+")}&background=00ff88&color=000`
        });

        alert(`✅ Bem-vindo, Treinador ${name}!\nSua conta foi criada. Faça login para acessar seu painel.`);
        window.location.href = "index.html"; 

    } catch (error) {
        console.error(error);
        alert("Erro ao criar conta: " + error.message);
        btn.innerText = "CADASTRAR ACESSO";
        btn.disabled = false;
    }
});
